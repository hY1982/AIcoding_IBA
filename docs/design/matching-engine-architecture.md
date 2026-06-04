# 匹配引擎架构设计文档

## 1. 概述

### 1.1 目的

本文档描述篮球比赛自动匹配平台的核心模块 —— 匹配引擎（Matching Engine）的架构设计。匹配引擎负责将 `pending` 状态的比赛意向按时间重叠、场地/赛制重叠、能力值动态阈值等条件自动分组匹配，生成比赛记录并分配队伍。

### 1.2 范围

- 蛇形选秀分队算法（TeamBalancerService）
- 主匹配引擎服务（MatchingEngineService）
- BullMQ 队列处理器（MatchingProcessor）
- Cron 定时调度器（MatchingScheduler）
- 匹配模块（MatchingModule）

### 1.3 术语

| 术语 | 说明 |
|------|------|
| 意向（Intention） | 球员提交的比赛意向，包含时间、场地偏好、赛制偏好等 |
| 候选集（Candidate Set） | 满足动态阈值条件的一组球员 |
| 蛇形选秀（Snake Draft） | 按能力值降序排序后，奇数轮正向、偶数轮反向分配球员的算法 |
| 双指针滑动窗口 | O(n) 时间复杂度的数组聚类算法 |
| 幂等更新 | UPDATE ... WHERE status='pending'，确保重试安全 |
| 悲观锁 | SELECT ... FOR UPDATE，防止并发冲突 |

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     MatchingScheduler                        │
│                  (@Cron */5 * * * *)                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ Redis SETNX │───→│ 检查活跃Job │───→│ 添加 BullMQ Job │  │
│  │ 分布式锁     │    │  (防拥堵)   │    │  (match-region) │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     MatchingProcessor                        │
│                    (BullMQ Worker)                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           MatchingEngineService.runMatching()          │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │  │
│  │  │参数快照 │─→│查询意向 │─→│分组聚类 │─→│事务创建 │  │  │
│  │  │         │  │         │  │         │  │ 比赛    │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块依赖

```
MatchingModule
├── TypeOrmModule.forFeature([Intention, IntentionVenue, IntentionFormat,
│                             Player, Match, MatchPlayer, MatchTeam,
│                             VenueTimeSlot, Format, SystemParam])
├── BullModule.registerQueue({ name: 'matching' })
├── ScheduleModule.forRoot()
├── MatchingEngineService
├── TeamBalancerService
├── MatchingProcessor
└── MatchingScheduler
```

## 3. 核心算法

### 3.1 蛇形选秀分队算法

**输入**：球员列表（含 totalAbilityScore）+ 赛制信息（teamSize, teamCountMin, teamCountMax）

**输出**：TeamAssignment[]（每支队伍的球员分配和平均能力值）

**算法步骤**：

1. 按 `totalAbilityScore` 降序排序（同分按 id 升序保证确定性）
2. 计算队伍数：`max(teamCountMin, min(floor(playerCount/teamSize), teamCountMax))`
3. 蛇形分配：奇数轮正向（1→N），偶数轮反向（N→1）
4. 计算每队 `avgAbility = round(sum(scores) / count, 2)`

**时间复杂度**：O(n log n)（排序主导）

**均衡性保证**：每支队伍获得的"选秀权"总和相等，能力值分布最均衡。

### 3.2 双指针滑动窗口聚类

**输入**：球员能力值列表 + 动态阈值

**输出**：满足阈值的最大候选子数组

**算法步骤**：

1. 按能力值降序 + submittedAt 升序排序
2. 用 left/right 指针维护窗口
3. 当窗口内 `maxScore - minScore <= threshold` 时右移 right
4. 否则右移 left
5. 记录所有满足条件的窗口，选择人数最多的

**时间复杂度**：O(n)（每个元素最多被访问两次）

**优势**：将候选集聚类从 O(n²) 优化到 O(n)，支持单组 500+ 人的高效处理。

### 3.3 动态阈值

```
threshold = max(min_threshold, base_threshold - intention_count * factor)
```

- 意向数量越多，阈值越宽松（更容易匹配）
- 阈值不会低于 `min_threshold`（保证匹配质量）

## 4. 关键设计决策

### 4.1 参数快照

任务开始时一次性读取 `system_params` 表中的 `match_threshold_params`，作为本次任务的上下文。确保任务执行期间参数变更不会导致行为不一致。

### 4.2 幂等更新

```sql
UPDATE intentions
SET status = 'matched', match_id = :matchId, updated_at = NOW()
WHERE id = :intentionId
  AND status = 'pending';
```

通过检查 `affectedRows` 确认是否更新成功。重试时不会重复创建比赛。

### 4.3 悲观锁场地预订

```sql
-- Step 1: 在事务内锁定时段
SELECT id FROM venue_time_slots
WHERE venue_id = :venueId
  AND is_booked = false
FOR UPDATE;

-- Step 2: 更新（乐观锁二次校验）
UPDATE venue_time_slots
SET is_booked = true, match_id = :matchId
WHERE id = :lockedSlotId
  AND is_booked = false;
```

### 4.4 异常隔离

每个分组用 `try/catch` 包裹，单个分组异常不影响其他分组。

### 4.5 分布式锁

Scheduler 使用 Redis SETNX 获取锁 `matching:scheduler:{regionCode}`，防止多实例惊群效应。

### 4.6 精细化降级

| 跳过原因 | 处理方式 |
|---------|---------|
| 无 pending 意向 | 正常跳过，不计入降级计数 |
| 队列拥堵（有活跃 job） | 记录 WARN，增加 Processor 并发或报警 |
| 连续 Job 失败 | 连续 3 次暂停调度，记录 ERROR，需人工介入 |

## 5. 数据流

### 5.1 匹配流程

```
runMatching(regionCode?) → MatchingResult
  ├─ 1. 加载阈值参数（参数快照）
  ├─ 2. 查询 pending 意向（start_time > now + 1h）
  ├─ 3. 按 (venueId, formatId, timeWindow) 分组
  ├─ 4. FOR EACH 分组:
  │     ├─ 4a. 提取球员能力值
  │     ├─ 4b. 计算动态阈值
  │     ├─ 4c. 双指针滑动窗口聚类
  │     ├─ 4d. 检查人数 >= format.teamCountMin * format.teamSize
  │     └─ 4e. 满足 → 事务内创建比赛
  │              - 创建 Match
  │              - 蛇形分队（TeamBalancerService）
  │              - 创建 MatchTeam
  │              - 创建 MatchPlayer（status='invited'）
  │              - 幂等更新意向状态
  │              - 悲观锁预订场地时段
  ├─ 5. 处理过期意向
  └─ 6. 返回 MatchingResult
```

### 5.2 调度流程

```
@Cron(*/5 * * * *)
handleMatchingSchedule()
  ├─ 1. 获取活跃地区列表
  ├─ 2. FOR EACH 地区:
  │     ├─ 2a. 检查是否已暂停
  │     ├─ 2b. Redis SETNX 获取锁
  │     ├─ 2c. 检查 pending 意向
  │     ├─ 2d. 检查队列活跃 job
  │     └─ 2e. 添加 BullMQ Job
  └─ 3. 释放锁
```

## 6. 性能指标

### 6.1 负载测试结果

| 测试用例 | 球员数 | 耗时 | 结果 |
|---------|--------|------|------|
| 蛇形选秀 | 100 | ~2ms | 通过 |
| 蛇形选秀 | 500 | ~1ms | 通过 |
| 蛇形选秀 | 1000 | ~1ms | 通过 |
| 双指针聚类 | 100 | ~1ms | 通过 |
| 双指针聚类 | 500 | ~2ms | 通过 |
| 双指针聚类 | 1000 | ~4ms | 通过 |
| 端到端流程 | 100 | ~1ms | 通过 |
| 端到端流程 | 500 | ~2ms | 通过 |
| 端到端流程 | 1000 | ~6ms | 通过 |

### 6.2 队列配置

- **concurrency**: 2（并行处理 2 个地区的匹配任务）
- **lockDuration**: 300000ms（5 分钟，防止任务被重复执行）
- **attempts**: 3（失败重试 3 次）
- **backoff**: exponential, 10s 起（指数退避）

## 7. 监控指标

| 指标名 | 类型 | 说明 |
|--------|------|------|
| `matching_job_duration_seconds` | Histogram | 单次匹配任务执行耗时 |
| `matching_intentions_scanned_total` | Counter | 扫描的意向总数 |
| `matching_success_total` | Counter | 成功匹配数（按 regionCode 标签） |
| `matching_failed_total` | Counter | 匹配失败数（按 regionCode、reason 标签） |
| `matching_expired_total` | Counter | 过期取消的意向数 |
| `matching_queue_wait_seconds` | Histogram | 队列等待时间 |
| `matching_job_retries_total` | Counter | Job 重试次数 |

### 7.1 告警规则

- 连续 2 次匹配任务失败 → ERROR 告警
- 匹配成功率持续低于 30%（1 小时内）→ WARN 告警
- 单次匹配任务耗时超过 4 分钟 → WARN 告警

## 8. 文件清单

### 8.1 新建文件

| 文件路径 | 说明 |
|---------|------|
| `server/src/modules/matching/services/team-balancer.service.ts` | 蛇形选秀分队算法服务 |
| `server/src/modules/matching/services/team-balancer.service.spec.ts` | 分队服务单元测试 |
| `server/src/modules/matching/services/matching-engine.service.ts` | 主匹配引擎服务 |
| `server/src/modules/matching/services/matching-engine.service.spec.ts` | 主服务单元测试 |
| `server/src/modules/matching/services/matching-load.spec.ts` | 纯内存负载测试 |
| `server/src/modules/matching/matching.module.ts` | 匹配模块定义 |
| `server/src/modules/matching/matching.processor.ts` | BullMQ 队列处理器 |
| `server/src/modules/matching/matching.processor.spec.ts` | 处理器单元测试 |
| `server/src/modules/matching/matching.scheduler.ts` | Cron 定时调度器 |
| `server/src/modules/matching/matching.scheduler.spec.ts` | 调度器单元测试 |
| `server/src/modules/matching/interfaces/matching-result.interface.ts` | 匹配结果类型定义 |
| `docs/design/matching-engine-architecture.md` | 架构设计文档 |

### 8.2 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `server/src/app.module.ts` | 注册 MatchingModule |
| `server/package.json` | 添加 @nestjs/bullmq 和 @nestjs/schedule 依赖 |

## 9. 测试覆盖率

| 指标 | 覆盖率 |
|------|--------|
| Statements | 89.69% |
| Branches | 84.31% |
| Functions | 88.67% |
| Lines | 91.23% |

所有指标均超过 80% 阈值。

## 10. 后续优化建议

1. **监控指标集成**：Module 7.1/7.2 实现后，集成 Prometheus 指标收集
2. **告警通知**：集成 NotificationService，实现自动告警通知
3. **动态并发调整**：根据队列长度动态调整 Processor 并发数
4. **匹配结果缓存**：缓存近期匹配结果，减少重复计算
5. **A/B 测试框架**：支持不同阈值策略的 A/B 测试
