# Module 2.8 — 赛后反馈与调节值服务 代码审核报告

> 审核日期：2026-06-04
> 审核范围：`server/src/modules/feedbacks/` 全部新增/修改文件
> 审核标准：basketball-match-platform-specs.md Module 2.8 规格要求 + 企业级代码质量规范

---

## 一、执行摘要

| 维度 | 评级 | 说明 |
|------|------|------|
| 功能完整性 | B+ | 核心功能实现完整，但规格中"必须评价所有其他球员"约束未实现 |
| 代码质量 | A- | 整体结构清晰、注释充分，存在少量类型安全与边界处理问题 |
| 测试覆盖 | A | 42个测试全部通过，单元+集成测试覆盖核心路径 |
| 架构设计 | A- | 事务边界、乐观锁、异步补偿等设计合理，N+1查询隐患需关注 |
| 安全性 | B+ | 基础校验完善，但缺少Controller层防护（JWT/权限） |
| 性能表现 | B | 存在N+1查询和逐球员循环更新问题，高并发场景需优化 |

**总体结论**：Module 2.8 核心功能已实现并通过测试，达到可交付标准。存在 **2项P1级** 和 **5项P2级** 问题需修复，建议修复后合并。

---

## 二、问题清单（按严重程度排序）

### P1 — 严重（功能缺陷 / 规格不符 / 安全隐患）

#### P1-001: 规格不符 — 未强制要求评价所有其他球员
- **文件**：`dto/create-feedback.dto.ts` 第80-83行，`feedback.service.ts` 第109-133行
- **规格要求**：specs.md 明确要求"必须评价所有其他球员"
- **现状**：`playerRatings` 允许为空数组，且未校验是否覆盖了所有其他 confirmed 球员
- **影响**：用户可跳过对某些球员的评价，导致调节值计算不完整，违背产品设计意图
- **修复建议**：
  ```typescript
  // 在 createFeedback 校验逻辑中追加：
  const otherConfirmedPlayers = await this.matchPlayerRepo.find({
    where: { matchId: dto.matchId, status: 'confirmed' },
  });
  const ratedPlayerIds = new Set(dto.playerRatings.map(r => r.ratedPlayerId));
  const requiredIds = otherConfirmedPlayers.filter(p => p.playerId !== dto.playerId).map(p => p.playerId);
  const missing = requiredIds.filter(id => !ratedPlayerIds.has(id));
  if (missing.length > 0) {
    throw new BadRequestException(`必须评价所有其他参赛球员，缺少: ${missing.join(',')}`);
  }
  ```
- **验收标准**：提交反馈时若缺少任何其他 confirmed 球员的评价，返回 400 错误

#### P1-002: 数据一致性 — 调节值更新失败后无持久化记录
- **文件**：`feedback.service.ts` 第168-182行
- **问题**：`updatePlayerMatchAdjustWithRetry` 失败后仅记录日志，未将失败信息持久化到数据库
- **影响**：服务重启或日志轮转后，无法追溯哪些调节值更新失败，异步补偿服务也无法精准定位
- **修复建议**：
  - 方案A（推荐）：新增 `adjust_update_failures` 表记录 `(match_id, player_id, created_at, retry_count, error_message)`，补偿服务优先扫描此表
  - 方案B：在 `feedback` 表中增加 `adjust_synced` 布尔字段，标记调节值是否已更新
- **验收标准**：调节值更新失败后，数据库中存在可查询的失败记录，补偿服务能精准重试

---

### P2 — 重要（性能瓶颈 / 维护性 / 潜在风险）

#### P2-001: 性能 — FeedbackAdjustSyncService N+1 查询问题
- **文件**：`feedback-adjust-sync.service.ts` 第90-109行
- **问题**：`syncPlayerAdjustValue` 中对每条 rating 都单独查询 `feedbackRepo.findOne` 获取 matchId
- **影响**：若某球员收到100条评分，将产生100次额外查询
- **修复建议**：使用单次 JOIN 查询直接获取 `feedback_id -> match_id` 映射：
  ```typescript
  const ratingsWithMatch = await this.ratingRepo
    .createQueryBuilder('rating')
    .select(['rating.id', 'rating.feedbackId', 'rating.ratedPlayerId', 'fb.matchId'])
    .innerJoin('rating.feedback', 'fb')
    .where('rating.rated_player_id = :playerId', { playerId })
    .getMany();
  ```
- **验收标准**：同步服务对单个球员的查询次数从 O(N) 降至 O(1)

#### P2-002: 性能 — 逐球员串行更新调节值
- **文件**：`feedback.service.ts` 第168-182行
- **问题**：`dto.playerRatings` 中每个 ratedPlayer 串行调用 `updatePlayerMatchAdjustWithRetry`
- **影响**：一场比赛若有10个其他球员，调节值更新将串行执行10次
- **修复建议**：使用 `Promise.allSettled` 并行执行（注意：乐观锁冲突时需重试，并行可能增加冲突率，需权衡）
- **验收标准**：多球员评价场景下调节值更新耗时减少 50%+

#### P2-003: 类型安全 — Player.matchAdjustValue 未配置 transformer
- **文件**：`entities/player.entity.ts` 第93-101行（跨模块问题）
- **问题**：`matchAdjustValue` 为 `decimal(5,2)` 类型，但实体未配置 `transformer`，TypeORM 读取时返回字符串
- **现状**：已在 `feedback.service.ts` 和 `feedback-adjust-sync.service.ts` 中通过 `parseFloat(String())` 临时修复
- **问题**：这种"事后修补"模式分散在多处，容易遗漏，且其他使用 `matchAdjustValue` 的模块也会踩坑
- **修复建议**：在 `Player` 实体中为 `matchAdjustValue` 添加 transformer（参考 `Match.depositAmount` 的实现）：
  ```typescript
  @Column({
    name: 'match_adjust_value',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: false,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: number | string) => typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  matchAdjustValue!: number;
  ```
- **验收标准**：移除 `feedback.service.ts` 和 `feedback-adjust-sync.service.ts` 中的 `parseFloat`  workaround 后，集成测试仍通过

#### P2-004: 测试覆盖 — 缺少并发冲突重试场景测试
- **文件**：`feedback.service.spec.ts`
- **问题**：单元测试覆盖了重试最终成功的场景，但未覆盖"重试3次后仍失败"的场景
- **影响**：`updatePlayerMatchAdjustWithRetry` 的异常抛出路径未经验证
- **修复建议**：添加测试用例：
  ```typescript
  it('should throw after max retries exceeded', async () => {
    playerRepo.findOne.mockRejectedValue(new Error('Persistent DB error'));
    
    await expect(service.createFeedback(createDto)).rejects.toThrow('Persistent DB error');
    expect(playerRepo.findOne).toHaveBeenCalledTimes(3);
  });
  ```
- **验收标准**：该测试通过，覆盖率报告中 `feedback.service.ts` 第245行（`throw lastError`）被覆盖

#### P2-005: 架构 — 缺少 Controller 层和 Swagger 文档
- **文件**：规格要求中未明确列出 Controller，但全局约束第7条要求"所有 Controller 必须同步维护 Swagger/OpenAPI 注解"
- **问题**：当前仅实现了 Service 层，无 Controller 和 DTO 的 Swagger 装饰器
- **影响**：API 接口无法自动生成文档，前端无法对接
- **修复建议**：新增 `feedbacks.controller.ts`：
  ```typescript
  @ApiTags('赛后反馈')
  @Controller('feedbacks')
  export class FeedbacksController {
    @Post()
    @ApiOperation({ summary: '提交赛后反馈' })
    @ApiResponse({ status: 201, description: '反馈提交成功' })
    async create(@Body() dto: CreateFeedbackDto) { ... }
    
    @Get('pending/:playerId')
    @ApiOperation({ summary: '查询待反馈比赛' })
    async findPending(@Param('playerId') playerId: number) { ... }
  }
  ```
- **验收标准**：Swagger UI (`/api/docs`) 中可见反馈相关接口

---

### P3 — 建议（代码优化 / 最佳实践）

#### P3-001: DTO 中 `playerRatings` 不应强制 `@IsArray()`
- **文件**：`dto/create-feedback.dto.ts` 第80行
- **问题**：`@IsArray()` 要求必须传数组，但业务上允许不传（空评价）
- **现状**：`@IsArray()` 与 `playerRatings!: CreateFeedbackPlayerRatingDto[]` 的必填声明矛盾
- **建议**：改为 `@IsOptional()` 或允许空数组，与 Service 层逻辑保持一致

#### P3-002: 魔法数字提取为常量
- **文件**：`feedback.service.ts` 第34-35行
- **问题**：`maxRetries = 3`、`retryDelayMs = 100` 为硬编码
- **建议**：提取为模块级常量或配置项，便于运维调整

#### P3-003: 日志中敏感信息处理
- **文件**：`feedback.service.ts` 第317-326行
- **问题**：结构化日志中直接输出 `matchId`、`playerId`，虽非敏感但建议统一使用脱敏工具
- **建议**：参考项目中已有的 `privacy.util.ts` 进行 ID 脱敏处理

#### P3-004: 集成测试数据库清理不完整
- **文件**：`feedback.integration.spec.ts` 第103-116行
- **问题**：`TRUNCATE` 未包含 `intention_venues`、`intention_formats` 等关联表
- **建议**：添加缺失表的清理，或使用 `dataSource.synchronize(true)` 重建 schema

#### P3-005: `FeedbackAdjustSyncService` 全表扫描性能隐患
- **文件**：`feedback-adjust-sync.service.ts` 第47-50行
- **问题**：`SELECT DISTINCT rated_player_id FROM feedback_player_ratings` 在大数据量时性能差
- **建议**：添加索引或分页处理，后续 Module 7 定时任务调用时限制批次大小

---

## 三、规格符合性检查

| 规格要求 | 状态 | 说明 |
|---------|------|------|
| 反馈提交（overall_rating 1-5） | 通过 | DTO 有 `@Min(1) @Max(5)` 校验 |
| 必须评价所有其他球员 | 未通过 | P1-001，当前允许空 playerRatings |
| 调节值计算（权重参数化） | 通过 | `AbilityAdjustService.getWeights()` 从 SystemParam 读取 |
| 累加上下限 [-50, 50] | 通过 | `clampAdjustValue` 实现 |
| 重复反馈拒绝 | 通过 | 预查 + 数据库唯一约束兜底 |
| 调节值应用（total_ability_score 变化） | 通过 | 数据库 `generatedType: 'STORED'` 自动计算 |
| 事务边界（反馈创建在事务内） | 通过 | `DataSource.transaction` 包裹 |
| 并发安全（乐观锁） | 通过 | `version` 列 + QueryBuilder 条件更新 |
| 异步补偿 | 通过 | `FeedbackAdjustSyncService` 已实现 |

---

## 四、安全审计

| 检查项 | 状态 | 说明 |
|--------|------|------|
| SQL 注入防护 | 通过 | 使用 TypeORM QueryBuilder，参数化查询 |
| 越权访问防护 | 未验证 | 无 Controller 层，无法验证 JWT/权限校验 |
| 输入校验 | 通过 | class-validator 覆盖基础校验 |
| 重复提交防护 | 通过 | 数据库唯一约束 `(match_id, player_id)` |
| 自评防护 | 通过 | 应用层校验 `ratedPlayerId !== playerId` |

---

## 五、测试质量评估

| 测试类型 | 数量 | 覆盖率 | 评价 |
|---------|------|--------|------|
| AbilityAdjustService 单元测试 | 22 | 100% | 优秀，覆盖所有计算路径 |
| FeedbackService 单元测试 | 14 | 93.97% | 良好，缺少重试失败路径覆盖 |
| 集成测试 | 6 | N/A | 良好，覆盖端到端流程 |
| **总计** | **42** | **92.77%** | **优秀** |

---

## 六、修复优先级与验收标准

### 必须修复（合并前）
1. **P1-001**：补充"必须评价所有其他球员"校验
2. **P2-003**：为 `Player.matchAdjustValue` 添加 transformer，移除 workaround

### 强烈建议修复（合并后1周内）
3. **P1-002**：增加调节值更新失败持久化记录
4. **P2-001**：修复 N+1 查询
5. **P2-004**：补充重试失败测试

### 建议优化（后续迭代）
6. **P2-002**：并行更新调节值
7. **P2-005**：补充 Controller 和 Swagger 文档
8. **P3-001 ~ P3-005**：代码优化项

---

## 七、审核结论

Module 2.8 整体实现质量较高，核心功能完整，测试覆盖充分，架构设计考虑了事务边界、并发安全和最终一致性。主要问题在于：

1. **规格遗漏**：未实现"必须评价所有其他球员"约束（P1-001）
2. **技术债务**：`decimal` 类型的 workaround 分散在多处，应在实体层统一处理（P2-003）

建议修复 **P1-001** 和 **P2-003** 后批准合并，其余问题可在后续迭代中逐步优化。

---

*审核人：AI Code Reviewer*
*审核日期：2026-06-04*
