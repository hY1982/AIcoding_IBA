# 篮球匹配平台 — 分模块开发计划

> 版本：v1.0
> 日期：2026-05-26
> 策略：按依赖顺序逐个模块实现，每次只分配单一模块任务，先写测试再写代码，TDD完整覆盖（目标80%+），用户逐步审查

---

## Context

根据 `basketball-match-platform-blueprint.md` 完整技术方案，本项目是一个篮球比赛自动匹配平台，技术栈为 React Native (Expo) + NestJS + PostgreSQL + Redis。由于项目复杂度高（后端12个模块、前端2个应用），为避免一次性实现导致逻辑混乱，必须按「基础设施 → 数据层 → 核心逻辑 → 接口/页面」的依赖顺序，将项目拆分为独立、可测试、可审查的小模块，逐个交付。

---

## 全局约束

1. **每次只执行一个模块任务**，完成并通过测试后，等待用户审查确认再进入下一步
2. **先写测试，再写代码**，TDD完整覆盖，覆盖率目标80%+
3. **Git版本控制**：每个模块完成后独立commit，commit message说明模块名和测试通过状态
4. **技术栈锁定**：NestJS + TypeScript + TypeORM + PostgreSQL + Redis + Jest（后端）；React Native Expo + Zustand（移动端）；React + Ant Design（管理后台）
5. **目录结构**：严格遵循 blueprint 中的 `apps/mobile/`、`apps/admin/`、`server/`、`shared/` 结构

---

## 模块清单与执行顺序

### Phase 0：项目基础设施（必须先完成）

#### Module 0.1 — Git 版本控制初始化
- **目标**：建立 Git 仓库，配置 `.gitignore`，创建初始 commit
- **交付物**：
  - `d:/AI_coding_projects/AIcoding_IBA/.git/`
  - `.gitignore`（覆盖 Node.js、Expo、React、IDE、环境变量文件）
  - 初始 commit：`init: bootstrap basketball match platform repository`
- **测试**：`git status` 无未跟踪的应忽略文件，`git log` 显示初始 commit
- **关键路径**：`d:/AI_coding_projects/AIcoding_IBA/.gitignore`

#### Module 0.2 — 后端基础依赖与项目初始化
- **目标**：初始化 NestJS 项目，配置 TypeORM + PostgreSQL 连接，配置 Redis 连接，配置 Jest 测试环境，确保能编译启动
- **依赖顺序**：Module 0.1 完成后
- **交付物**：
  - `server/package.json`（NestJS + TypeORM + pg + ioredis + class-validator + class-transformer + @nestjs/config + bcrypt + jsonwebtoken + jest + supertest + @types/*）
  - `server/tsconfig.json`
  - `server/src/main.ts`（可启动的 NestJS 应用入口）
  - `server/src/app.module.ts`（根模块，注册 ConfigModule、TypeOrmModule、Redis 连接）
  - `server/src/config/database.config.ts`（PostgreSQL 连接配置，支持环境变量）
  - `server/src/config/redis.config.ts`（Redis 连接配置）
  - `server/test/jest-e2e.json`（e2e测试配置）
  - `server/.env.example`（环境变量模板）
- **测试**：
  - `npm install` 成功
  - `npm run build` 无编译错误
  - `npm run test` Jest 运行通过（至少有一个示例测试通过）
  - `npm run start:dev` 能正常启动 NestJS 服务（端口监听成功）
  - 数据库连接池正常（TypeORM 连接成功日志）
  - Redis 连接正常（ping 成功）
- **关键路径**：`server/src/main.ts`、`server/src/app.module.ts`、`server/src/config/database.config.ts`

#### Module 0.3 — 移动端基础依赖与项目初始化
- **目标**：初始化 React Native (Expo) 项目，配置 TypeScript，确保能编译运行
- **依赖顺序**：Module 0.1 完成后（与 0.2 可并行，但建议串行）
- **交付物**：
  - `apps/mobile/package.json`（expo + react-native + typescript + @types/react + zustand + react-navigation + axios）
  - `apps/mobile/tsconfig.json`
  - `apps/mobile/App.tsx`（可运行的入口组件）
  - `apps/mobile/app.json`
  - `apps/mobile/src/api/client.ts`（axios 基础配置）
  - `apps/mobile/src/stores/index.ts`（zustand 基础 store）
- **测试**：
  - `npm install` 成功
  - `npx tsc --noEmit` 无类型错误
  - `npx expo start` 能正常启动（至少不报错）
- **关键路径**：`apps/mobile/App.tsx`、`apps/mobile/tsconfig.json`

#### Module 0.4 — 管理后台基础依赖与项目初始化
- **目标**：初始化 React + Vite + Ant Design 项目，配置 TypeScript，确保能编译运行
- **依赖顺序**：Module 0.1 完成后
- **交付物**：
  - `apps/admin/package.json`（react + vite + typescript + antd + axios + react-router-dom）
  - `apps/admin/tsconfig.json`
  - `apps/admin/vite.config.ts`
  - `apps/admin/index.html`
  - `apps/admin/src/main.tsx`（入口）
  - `apps/admin/src/App.tsx`（基础路由框架）
- **测试**：
  - `npm install` 成功
  - `npm run build` 无编译错误
  - `npm run dev` 能正常启动开发服务器
- **关键路径**：`apps/admin/src/main.tsx`、`apps/admin/vite.config.ts`

#### Module 0.5 — 共享类型包初始化
- **目标**：创建 `shared/` 目录，定义前后端共享的 DTO 类型和常量
- **依赖顺序**：Module 0.2、0.3、0.4 完成后
- **交付物**：
  - `shared/package.json`（纯类型包，可被 server/mobile/admin 引用）
  - `shared/types/auth.ts`（登录/注册 DTO 类型）
  - `shared/types/player.ts`（球员属性类型）
  - `shared/types/venue.ts`（场地类型）
  - `shared/types/common.ts`（通用响应格式、分页类型）
  - `shared/tsconfig.json`
- **测试**：
  - `npx tsc --noEmit` 无类型错误
  - 类型能被 server/mobile/admin 正确引用
- **关键路径**：`shared/types/*.ts`

---

### Phase 1：数据层与核心实体（数据表设计 → 实体定义）

#### Module 1.1 — 用户与认证实体（users + venue_managers + players + player_positions）
- **目标**：定义 TypeORM 实体，建立数据库表结构，实现加密存储（phone、real_name、id_card AES加密）
- **依赖顺序**：Module 0.2 完成后
- **交付物**：
  - `server/src/modules/users/entities/user.entity.ts`
  - `server/src/modules/users/entities/venue-manager.entity.ts`
  - `server/src/modules/players/entities/player.entity.ts`
  - `server/src/modules/players/entities/player-position.entity.ts`
  - `server/src/common/transformers/encrypt.transformer.ts`（AES-256-GCM 加解密 Transformer）
  - `server/src/common/utils/encrypt.util.ts`（加密工具函数 + 测试）
- **测试**（先写测试）：
  - 加密/解密工具函数单元测试（各种输入、边界值、异常）
  - 实体创建测试（验证字段约束、关系映射）
  - TypeORM 同步建表测试（`synchronize: true` 在测试环境验证表结构正确）
  - 敏感字段入库后查询验证为密文
- **关键路径**：`server/src/modules/users/entities/user.entity.ts`、`server/src/common/transformers/encrypt.transformer.ts`

#### Module 1.2 — 场地实体（venues + venue_time_slots）
- **目标**：定义场地和时段实体
- **依赖顺序**：Module 1.1 完成后
- **交付物**：
  - `server/src/modules/venues/entities/venue.entity.ts`
  - `server/src/modules/venues/entities/venue-time-slot.entity.ts`
- **测试**：
  - 实体字段约束测试（price_per_hour > 0、court_count >= 1 等）
  - 关系映射测试（venue → time_slots 一对多）
  - 建表结构验证
- **关键路径**：`server/src/modules/venues/entities/venue.entity.ts`

#### Module 1.3 — 赛制实体（formats）
- **目标**：定义赛制实体，插入初始赛制数据
- **依赖顺序**：Module 1.2 完成后
- **交付物**：
  - `server/src/modules/formats/entities/format.entity.ts`
  - `server/src/modules/formats/seeds/formats.seed.ts`（初始数据：3v3短赛、4v4短赛、5v5短赛）
- **测试**：
  - 实体约束测试（team_size、team_count_min/max 关系）
  - 种子数据插入测试
- **关键路径**：`server/src/modules/formats/entities/format.entity.ts`

#### Module 1.4 — 比赛意向实体（intentions + intention_venues + intention_formats）
- **目标**：定义比赛意向及关联实体
- **依赖顺序**：Module 1.3 完成后
- **交付物**：
  - `server/src/modules/intentions/entities/intention.entity.ts`
  - `server/src/modules/intentions/entities/intention-venue.entity.ts`
  - `server/src/modules/intentions/entities/intention-format.entity.ts`
- **测试**：
  - 实体约束测试（duration_minutes 120-360、status 枚举）
  - end_time 生成列验证
  - 关系映射测试（intention → intention_venues → venues）
- **关键路径**：`server/src/modules/intentions/entities/intention.entity.ts`

#### Module 1.5 — 比赛与群聊实体（matches + match_players + match_teams + match_messages）
- **目标**：定义比赛、队伍、球员关联、群聊消息实体
- **依赖顺序**：Module 1.4 完成后
- **交付物**：
  - `server/src/modules/matches/entities/match.entity.ts`
  - `server/src/modules/matches/entities/match-player.entity.ts`
  - `server/src/modules/matches/entities/match-team.entity.ts`
  - `server/src/modules/messages/entities/match-message.entity.ts`
- **测试**：
  - 实体约束测试（status 枚举、confirmed_players <= total_players）
  - 关系映射测试（match → match_players → players、match → match_teams）
  - 唯一约束测试（match_id + player_id）
- **关键路径**：`server/src/modules/matches/entities/match.entity.ts`

#### Module 1.6 — 反馈与系统参数实体（feedbacks + feedback_player_ratings + system_params + notifications）
- **目标**：定义赛后反馈、系统参数、通知实体
- **依赖顺序**：Module 1.5 完成后
- **交付物**：
  - `server/src/modules/feedbacks/entities/feedback.entity.ts`
  - `server/src/modules/feedbacks/entities/feedback-player-rating.entity.ts`
  - `server/src/modules/system/entities/system-param.entity.ts`
  - `server/src/modules/notifications/entities/notification.entity.ts`
  - `server/src/modules/system/seeds/system-params.seed.ts`（初始系统参数数据）
- **测试**：
  - 实体约束测试（overall_rating 1-5、枚举字段）
  - 系统参数种子数据插入测试
  - 通知实体字段验证
- **关键路径**：`server/src/modules/feedbacks/entities/feedback.entity.ts`、`server/src/modules/system/entities/system-param.entity.ts`

---

### Phase 2：核心逻辑模块（Service 层，先测试后实现）

#### Module 2.1 — 基础能力值计算服务（AbilityCalculationService）
- **目标**：实现球员基础能力值计算（百分位打分 × 权重求和）
- **依赖顺序**：Module 1.1 完成后
- **交付物**：
  - `server/src/modules/players/services/ability-calculation.service.ts`
  - `server/src/modules/players/data/percentile-datasets.ts`（男女各指标百分位数据集）
  - `server/src/modules/players/services/ability-calculation.service.spec.ts`
- **测试**（先写测试）：
  - 各属性百分位打分测试（边界值：最小值、最大值、中位数）
  - 权重求和计算测试（验证公式正确性）
  - 不同性别数据集切换测试
  - 位置适配度计算测试
  - 综合得分范围验证（0-100）
- **关键路径**：`server/src/modules/players/services/ability-calculation.service.ts`

#### Module 2.2 — 认证服务（AuthService + JWT Strategy）
- **目标**：实现注册、登录、Token刷新、密码哈希
- **依赖顺序**：Module 1.1 完成后
- **交付物**：
  - `server/src/modules/auth/services/auth.service.ts`
  - `server/src/modules/auth/strategies/jwt.strategy.ts`
  - `server/src/modules/auth/guards/jwt-auth.guard.ts`
  - `server/src/modules/auth/dto/register.dto.ts`
  - `server/src/modules/auth/dto/login.dto.ts`
  - `server/src/modules/auth/auth.module.ts`
- **测试**（先写测试）：
  - 注册测试（密码哈希正确、手机号加密存储、重复注册报错）
  - 登录测试（正确密码返回token、错误密码报错、不存在用户报错）
  - Token刷新测试（有效refresh_token返回新token、过期token报错）
  - JWT Guard测试（无token拒绝、无效token拒绝、有效token通过）
- **关键路径**：`server/src/modules/auth/services/auth.service.ts`

#### Module 2.3 — 球员服务（PlayerService）
- **目标**：实现球员资料 CRUD、属性更新、能力值自动重算
- **依赖顺序**：Module 2.1 + Module 2.2 完成后
- **交付物**：
  - `server/src/modules/players/services/player.service.ts`
  - `server/src/modules/players/dto/create-player.dto.ts`
  - `server/src/modules/players/dto/update-player.dto.ts`
  - `server/src/modules/players/players.module.ts`
- **测试**（先写测试）：
  - 创建球员测试（属性验证、能力值自动计算、位置最多3个限制）
  - 更新球员测试（修改属性后能力值重算、调节值不变）
  - 查询球员测试（脱敏规则验证：手机号隐藏、姓名仅显示姓氏）
  - 删除球员测试（级联删除位置记录）
- **关键路径**：`server/src/modules/players/services/player.service.ts`

#### Module 2.4 — 场地服务（VenueService）
- **目标**：实现场地 CRUD、时段管理
- **依赖顺序**：Module 1.2 + Module 2.2 完成后
- **交付物**：
  - `server/src/modules/venues/services/venue.service.ts`
  - `server/src/modules/venues/dto/create-venue.dto.ts`
  - `server/src/modules/venues/dto/update-venue.dto.ts`
  - `server/src/modules/venues/venues.module.ts`
- **测试**（先写测试）：
  - 创建场地测试（场地方权限验证、必填字段验证）
  - 查询场地列表测试（分页、按地区筛选）
  - 时段查询测试（按日期筛选、已预订状态）
  - 更新场地测试（仅所属场地方可修改）
- **关键路径**：`server/src/modules/venues/services/venue.service.ts`

#### Module 2.5 — 意向服务（IntentionService）
- **目标**：实现比赛意向的提交、修改、取消、状态查询，含提前1小时校验
- **依赖顺序**：Module 1.4 + Module 2.3 + Module 2.4 完成后
- **交付物**：
  - `server/src/modules/intentions/services/intention.service.ts`
  - `server/src/modules/intentions/dto/create-intention.dto.ts`
  - `server/src/modules/intentions/dto/update-intention.dto.ts`
  - `server/src/modules/intentions/intentions.module.ts`
- **测试**（先写测试）：
  - 提交意向测试（提前1小时校验、场地/赛制最多3个、时间范围120-360分钟）
  - 修改意向测试（仍需满足提前1小时、可修改场地/赛制优先级）
  - 取消意向测试（pending状态可取消、matched后不可取消）
  - 查询意向测试（按球员查询、状态筛选）
  - 过期时间计算测试
- **关键路径**：`server/src/modules/intentions/services/intention.service.ts`

#### Module 2.6 — 匹配引擎核心服务（MatchingEngineService）
- **目标**：实现每5分钟触发的匹配算法（时间重叠、场地/赛制重叠、动态阈值、蛇形分队）
- **依赖顺序**：Module 2.5 + Module 1.3 完成后
- **交付物**：
  - `server/src/modules/matching/services/matching-engine.service.ts`
  - `server/src/modules/matching/services/team-balancer.service.ts`（蛇形选秀分队）
  - `server/src/modules/matching/matching.module.ts`
  - `server/src/modules/matching/matching.processor.ts`（Bull 队列处理器）
- **测试**（先写测试）：
  - 时间重叠检测测试（完全重叠、部分重叠、不重叠）
  - 动态阈值计算测试（意向数量与阈值反比关系）
  - 候选集分组测试（能力值差距在阈值内分组）
  - 人数满足测试（达到赛制最低要求才匹配）
  - 蛇形分队测试（队伍能力值均衡性验证）
  - 匹配失败处理测试（3小时提醒、半小时自动取消）
  - 异常隔离测试（某分组异常不影响其他分组）
- **关键路径**：`server/src/modules/matching/services/matching-engine.service.ts`

#### Module 2.7 — 比赛确认服务（MatchConfirmationService）
- **目标**：实现匹配成功后的确认流程、保证金模拟支付、系统确认比赛逻辑
- **依赖顺序**：Module 2.6 + Module 1.5 完成后
- **交付物**：
  - `server/src/modules/matches/services/match-confirmation.service.ts`
  - `server/src/modules/payments/services/mock-payment.service.ts`（模拟支付）
  - `server/src/modules/payments/payments.module.ts`
- **测试**（先写测试）：
  - 球员确认参赛测试（截止时间前可确认、截止后不可确认）
  - 模拟支付测试（支付成功标记、支付失败处理）
  - 系统确认比赛测试（人数足够→confirmed、人数不够→failed）
  - 场地自动预订测试（确认后时段标记为已预订）
  - 群聊创建测试（confirmed 后生成 group_chat_id）
- **关键路径**：`server/src/modules/matches/services/match-confirmation.service.ts`

#### Module 2.8 — 赛后反馈与调节值服务（FeedbackService）
- **目标**：实现反馈提交、能力匹配调节值计算
- **依赖顺序**：Module 1.6 + Module 2.7 完成后
- **交付物**：
  - `server/src/modules/feedbacks/services/feedback.service.ts`
  - `server/src/modules/feedbacks/services/ability-adjust.service.ts`（调节值计算）
  - `server/src/modules/feedbacks/dto/create-feedback.dto.ts`
  - `server/src/modules/feedbacks/feedbacks.module.ts`
- **测试**（先写测试）：
  - 反馈提交测试（overall_rating 1-5、必须评价所有其他球员）
  - 调节值计算测试（权重参数化验证、累加有上下限-50~50）
  - 重复反馈拒绝测试（每场比赛每球员只能反馈一次）
  - 调节值应用测试（更新后 total_ability_score 正确变化）
- **关键路径**：`server/src/modules/feedbacks/services/ability-adjust.service.ts`

#### Module 2.9 — 通知服务（NotificationService）
- **目标**：实现通知记录、多渠道发送抽象接口
- **依赖顺序**：Module 1.6 完成后（可与 2.7/2.8 并行）
- **交付物**：
  - `server/src/modules/notifications/services/notification.service.ts`
  - `server/src/modules/notifications/interfaces/notification-channel.interface.ts`
  - `server/src/modules/notifications/channels/in-app.channel.ts`
  - `server/src/modules/notifications/notifications.module.ts`
- **测试**（先写测试）：
  - 通知创建测试（类型、标题、内容、关联数据）
  - 渠道发送测试（in-app 渠道正常记录）
  - 通知查询测试（按用户查询、已读/未读筛选）
  - 脱敏测试（通知内容中不含完整手机号）
- **关键路径**：`server/src/modules/notifications/services/notification.service.ts`

#### Module 2.10 — 群聊消息服务（MessageService）
- **目标**：实现比赛群聊消息的发送和历史查询
- **依赖顺序**：Module 1.5 完成后
- **交付物**：
  - `server/src/modules/messages/services/message.service.ts`
  - `server/src/modules/messages/dto/send-message.dto.ts`
  - `server/src/modules/messages/messages.module.ts`
- **测试**（先写测试）：
  - 发送消息测试（text/image/system 类型、内容非空）
  - 历史查询测试（按 match_id 分页查询、时间倒序）
  - 权限测试（仅比赛相关人员可发送/查看）
  - 群聊有效期测试（一周后不可发送新消息）
- **关键路径**：`server/src/modules/messages/services/message.service.ts`

---

### Phase 3：接口层（Controller + API 测试）

#### Module 3.1 — 认证接口（AuthController）
- **目标**：实现注册、登录、刷新Token、发送短信验证码接口
- **依赖顺序**：Module 2.2 完成后
- **交付物**：
  - `server/src/modules/auth/controllers/auth.controller.ts`
  - `server/src/modules/auth/auth.module.ts`（更新）
- **测试**（先写测试）：
  - `POST /api/v1/auth/register` 集成测试（成功注册、参数校验失败、重复注册）
  - `POST /api/v1/auth/login` 集成测试（成功登录、密码错误、用户不存在）
  - `POST /api/v1/auth/refresh` 集成测试（成功刷新、无效token）
  - 响应格式统一测试（{code, message, data}）
- **关键路径**：`server/src/modules/auth/controllers/auth.controller.ts`

#### Module 3.2 — 球员接口（PlayerController）
- **目标**：实现球员资料、能力值、投篮记录接口
- **依赖顺序**：Module 2.3 + Module 3.1 完成后
- **交付物**：
  - `server/src/modules/players/controllers/player.controller.ts`
  - `server/src/modules/players/players.module.ts`（更新）
- **测试**（先写测试）：
  - `GET /api/v1/players/profile` 集成测试（JWT认证、脱敏响应）
  - `PUT /api/v1/players/profile` 集成测试（属性更新、能力值重算）
  - `POST /api/v1/players/shooting` 集成测试（投篮记录录入）
  - `GET /api/v1/players/shooting` 集成测试（半年滚动统计）
- **关键路径**：`server/src/modules/players/controllers/player.controller.ts`

#### Module 3.3 — 场地接口（VenueController）
- **目标**：实现场地列表、详情、时段查询接口
- **依赖顺序**：Module 2.4 + Module 3.1 完成后
- **交付物**：
  - `server/src/modules/venues/controllers/venue.controller.ts`
  - `server/src/modules/venues/venues.module.ts`（更新）
- **测试**（先写测试）：
  - `GET /api/v1/venues` 集成测试（分页、地区筛选）
  - `GET /api/v1/venues/:id` 集成测试（详情、不存在ID）
  - `GET /api/v1/venues/:id/slots` 集成测试（按日期查询）
  - `POST /api/v1/venues` 集成测试（场地方权限、创建验证）
- **关键路径**：`server/src/modules/venues/controllers/venue.controller.ts`

#### Module 3.4 — 意向接口（IntentionController）
- **目标**：实现意向提交、修改、取消、查询接口
- **依赖顺序**：Module 2.5 + Module 3.1 完成后
- **交付物**：
  - `server/src/modules/intentions/controllers/intention.controller.ts`
  - `server/src/modules/intentions/intentions.module.ts`（更新）
- **测试**（先写测试）：
  - `POST /api/v1/intentions` 集成测试（提交成功、提前1小时校验失败）
  - `PUT /api/v1/intentions/:id` 集成测试（修改成功、状态限制）
  - `DELETE /api/v1/intentions/:id` 集成测试（取消成功）
  - `GET /api/v1/intentions/my` 集成测试（列表查询）
- **关键路径**：`server/src/modules/intentions/controllers/intention.controller.ts`

#### Module 3.5 — 比赛接口（MatchController）
- **目标**：实现比赛列表、详情、确认/拒绝参赛、球员列表、群聊消息接口
- **依赖顺序**：Module 2.7 + Module 3.1 完成后
- **交付物**：
  - `server/src/modules/matches/controllers/match.controller.ts`
  - `server/src/modules/matches/matches.module.ts`（更新）
- **测试**（先写测试）：
  - `GET /api/v1/matches/my` 集成测试（按球员查询比赛列表）
  - `GET /api/v1/matches/:id` 集成测试（详情、队伍分配）
  - `POST /api/v1/matches/:id/confirm` 集成测试（确认参赛、模拟支付）
  - `POST /api/v1/matches/:id/decline` 集成测试（拒绝参赛）
  - `GET/POST /api/v1/matches/:id/messages` 集成测试（群聊）
- **关键路径**：`server/src/modules/matches/controllers/match.controller.ts`

#### Module 3.6 — 反馈接口（FeedbackController）
- **目标**：实现反馈提交、待反馈列表接口
- **依赖顺序**：Module 2.8 + Module 3.1 完成后
- **交付物**：
  - `server/src/modules/feedbacks/controllers/feedback.controller.ts`
  - `server/src/modules/feedbacks/feedbacks.module.ts`（更新）
- **测试**（先写测试）：
  - `POST /api/v1/feedbacks` 集成测试（提交成功、重复提交拒绝）
  - `GET /api/v1/feedbacks/pending` 集成测试（待反馈列表）
- **关键路径**：`server/src/modules/feedbacks/controllers/feedback.controller.ts`

#### Module 3.7 — 管理后台接口（AdminController）
- **目标**：实现球员/场地/比赛列表、数据统计、系统参数调整接口
- **依赖顺序**：Module 3.2 + Module 3.3 + Module 3.5 完成后
- **交付物**：
  - `server/src/modules/admin/controllers/admin.controller.ts`
  - `server/src/modules/admin/admin.module.ts`
  - `server/src/modules/admin/guards/admin.guard.ts`
- **测试**（先写测试）：
  - `GET /api/v1/admin/players` 集成测试（管理员权限、完整信息不脱敏）
  - `GET /api/v1/admin/stats` 集成测试（数据统计正确性）
  - `PUT /api/v1/admin/params` 集成测试（系统参数更新、即时生效）
  - 非管理员访问拒绝测试
- **关键路径**：`server/src/modules/admin/controllers/admin.controller.ts`

---

### Phase 4：WebSocket 实时层

#### Module 4.1 — WebSocket 网关与群聊实时推送
- **目标**：实现 Socket.io 网关，支持群聊实时消息推送和比赛状态事件
- **依赖顺序**：Module 3.5 + Module 2.10 完成后
- **交付物**：
  - `server/src/modules/messages/gateways/chat.gateway.ts`
  - `server/src/modules/matches/gateways/match-events.gateway.ts`
  - `server/src/common/gateways/base.gateway.ts`（基础网关抽象）
- **测试**（先写测试）：
  - 客户端连接测试（JWT认证后连接成功、无token拒绝）
  - 群聊消息实时推送测试（发送后所有在线成员收到）
  - 比赛事件推送测试（match:invited、match:success、match:failed）
  - 房间隔离测试（不同比赛群聊消息不互通）
- **关键路径**：`server/src/modules/messages/gateways/chat.gateway.ts`

---

### Phase 5：前端开发（按页面模块拆分）

#### Module 5.1 — 移动端登录注册页面
- **目标**：实现球员/场地方角色选择、注册、登录页面
- **依赖顺序**：Module 3.1 完成后
- **交付物**：
  - `apps/mobile/src/screens/auth/RoleSelectScreen.tsx`
  - `apps/mobile/src/screens/auth/LoginScreen.tsx`
  - `apps/mobile/src/screens/auth/RegisterScreen.tsx`
  - `apps/mobile/src/screens/auth/PlayerRegisterScreen.tsx`
  - `apps/mobile/src/screens/auth/VenueManagerRegisterScreen.tsx`
- **测试**：
  - 组件渲染测试（React Native Testing Library）
  - 表单验证测试（必填项、手机号格式、密码强度）
  - API 调用测试（注册成功跳转、失败显示错误）
- **关键路径**：`apps/mobile/src/screens/auth/LoginScreen.tsx`

#### Module 5.2 — 移动端球员资料页面
- **目标**：实现球员属性录入、编辑、能力值展示页面
- **依赖顺序**：Module 5.1 + Module 3.2 完成后
- **交付物**：
  - `apps/mobile/src/screens/player/ProfileScreen.tsx`
  - `apps/mobile/src/screens/player/EditProfileScreen.tsx`
  - `apps/mobile/src/screens/player/AbilityScreen.tsx`
- **测试**：
  - 属性表单测试（身高范围、位置最多3个、能力值实时计算）
  - 提交测试（更新成功提示、失败重试）
- **关键路径**：`apps/mobile/src/screens/player/ProfileScreen.tsx`

#### Module 5.3 — 移动端场地浏览页面
- **目标**：实现场地列表、详情、时段查看页面
- **依赖顺序**：Module 5.1 + Module 3.3 完成后
- **交付物**：
  - `apps/mobile/src/screens/venue/VenueListScreen.tsx`
  - `apps/mobile/src/screens/venue/VenueDetailScreen.tsx`
- **测试**：
  - 列表渲染测试（分页加载、下拉刷新）
  - 详情渲染测试（场地信息、时段状态显示）
- **关键路径**：`apps/mobile/src/screens/venue/VenueListScreen.tsx`

#### Module 5.4 — 移动端意向管理页面
- **目标**：实现意向提交、修改、取消、状态展示页面
- **依赖顺序**：Module 5.3 + Module 3.4 完成后
- **交付物**：
  - `apps/mobile/src/screens/intention/CreateIntentionScreen.tsx`
  - `apps/mobile/src/screens/intention/MyIntentionsScreen.tsx`
  - `apps/mobile/src/screens/intention/IntentionDetailScreen.tsx`
- **测试**：
  - 意向表单测试（时间选择、场地/赛制多选排序）
  - 状态展示测试（pending/matched/confirmed 不同状态UI）
  - 取消操作测试（确认弹窗、取消成功）
- **关键路径**：`apps/mobile/src/screens/intention/CreateIntentionScreen.tsx`

#### Module 5.5 — 移动端比赛页面
- **目标**：实现我的比赛列表、比赛详情、确认参赛、群聊页面
- **依赖顺序**：Module 5.4 + Module 3.5 + Module 4.1 完成后
- **交付物**：
  - `apps/mobile/src/screens/match/MyMatchesScreen.tsx`
  - `apps/mobile/src/screens/match/MatchDetailScreen.tsx`
  - `apps/mobile/src/screens/match/ConfirmMatchScreen.tsx`
  - `apps/mobile/src/screens/chat/ChatScreen.tsx`
- **测试**：
  - 比赛列表测试（不同状态筛选）
  - 确认参赛测试（模拟支付流程UI）
  - 群聊测试（消息发送、实时接收、历史加载）
- **关键路径**：`apps/mobile/src/screens/match/MatchDetailScreen.tsx`

#### Module 5.6 — 移动端首页与导航
- **目标**：实现角色化首页（球员/场地方不同内容）、底部导航
- **依赖顺序**：Module 5.2 + Module 5.4 + Module 5.5 完成后
- **交付物**：
  - `apps/mobile/src/screens/home/HomeScreen.tsx`
  - `apps/mobile/src/navigation/AppNavigator.tsx`
  - `apps/mobile/src/navigation/PlayerTabNavigator.tsx`
  - `apps/mobile/src/navigation/VenueManagerTabNavigator.tsx`
- **测试**：
  - 导航测试（角色切换后导航结构变化）
  - 首页状态测试（显示当前意向/比赛状态）
- **关键路径**：`apps/mobile/src/screens/home/HomeScreen.tsx`

#### Module 5.7 — 管理后台页面
- **目标**：实现管理后台的登录、球员/场地/比赛管理、数据统计、系统参数页面
- **依赖顺序**：Module 3.7 完成后
- **交付物**：
  - `apps/admin/src/pages/LoginPage.tsx`
  - `apps/admin/src/pages/DashboardPage.tsx`
  - `apps/admin/src/pages/PlayerManagementPage.tsx`
  - `apps/admin/src/pages/VenueManagementPage.tsx`
  - `apps/admin/src/pages/MatchManagementPage.tsx`
  - `apps/admin/src/pages/SystemParamsPage.tsx`
  - `apps/admin/src/layouts/AdminLayout.tsx`
- **测试**：
  - 页面渲染测试（React Testing Library）
  - 表格操作测试（分页、筛选、排序）
  - 参数修改测试（表单提交、成功提示）
- **关键路径**：`apps/admin/src/pages/DashboardPage.tsx`

---

### Phase 6：部署与运维配置

#### Module 6.1 — Docker Compose 部署配置
- **目标**：配置后端、数据库、Redis 的 Docker 化部署
- **依赖顺序**：所有后端模块完成后
- **交付物**：
  - `server/Dockerfile`
  - `docker-compose.yml`（PostgreSQL + Redis + NestJS App）
  - `.dockerignore`
- **测试**：
  - `docker-compose build` 成功
  - `docker-compose up` 所有服务正常启动
  - API 健康检查通过
- **关键路径**：`docker-compose.yml`

#### Module 6.2 — CI/CD 配置
- **目标**：配置 GitHub Actions 自动化测试和构建
- **依赖顺序**：Module 6.1 完成后
- **交付物**：
  - `.github/workflows/backend-ci.yml`（后端测试 + 构建）
  - `.github/workflows/mobile-ci.yml`（移动端类型检查 + 构建）
  - `.github/workflows/admin-ci.yml`（管理后台类型检查 + 构建）
- **测试**：
  - GitHub Actions 工作流能成功运行（本地用 `act` 验证或推送后观察）
- **关键路径**：`.github/workflows/backend-ci.yml`

---

## 执行顺序总览

```
Phase 0（基础设施）
  0.1 Git 初始化
  0.2 后端 NestJS 初始化
  0.3 移动端 Expo 初始化
  0.4 管理后台 React 初始化
  0.5 共享类型包初始化

Phase 1（数据层）
  1.1 用户与认证实体
  1.2 场地实体
  1.3 赛制实体
  1.4 意向实体
  1.5 比赛与群聊实体
  1.6 反馈与系统参数实体

Phase 2（核心逻辑）
  2.1 能力值计算服务
  2.2 认证服务
  2.3 球员服务
  2.4 场地服务
  2.5 意向服务
  2.6 匹配引擎服务
  2.7 比赛确认服务
  2.8 反馈与调节值服务
  2.9 通知服务
  2.10 群聊消息服务

Phase 3（接口层）
  3.1 认证接口
  3.2 球员接口
  3.3 场地接口
  3.4 意向接口
  3.5 比赛接口
  3.6 反馈接口
  3.7 管理后台接口

Phase 4（WebSocket）
  4.1 WebSocket 网关与群聊推送

Phase 5（前端）
  5.1 移动端登录注册
  5.2 移动端球员资料
  5.3 移动端场地浏览
  5.4 移动端意向管理
  5.5 移动端比赛与群聊
  5.6 移动端首页与导航
  5.7 管理后台页面

Phase 6（部署）
  6.1 Docker Compose
  6.2 CI/CD
```

---

## 验证标准（每个模块通用）

1. **测试通过**：`npm test` 或 `npm run test:cov` 覆盖率 >= 80%
2. **编译通过**：`npm run build` 无 TypeScript 编译错误
3. **Lint通过**：`npm run lint` 无 ESLint 错误（如有配置）
4. **Git提交**：每个模块独立 commit，message 格式：`module(X.X): <模块名> - tests passing`
5. **用户审查**：模块完成后暂停，等待用户审查确认再继续
