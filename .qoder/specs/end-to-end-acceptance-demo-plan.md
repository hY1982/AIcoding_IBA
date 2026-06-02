# 篮球匹配平台 — 端到端验收演示页面

## Context

项目负责人反馈无法从现有技术报告中理解当前工作是否应通过验收。现有 `/test-dashboard` 页面面向技术团队，展示模块进度和测试场景列表，但对非技术人员过于抽象。

需要新增一个 `/acceptance-demo` 页面，以**业务流程为导向**，展示从球员注册到赛后反馈的完整端到端流程，每个步骤清晰展示：
1. 业务流程图（9步Steps）
2. 涉及的数据库表结构和关系
3. 示例数据（模拟真实数据）
4. 数据库约束（CHECK/UNIQUE/FK）可视化
5. 验收标准清单（业务逻辑 + 数据库专业）
6. 测试分类（业务逻辑测试 vs 数据库专业测试）

### 已验证的后端事实（来自实体文件和迁移文件）
- **18个实体**分布在10个模块中，所有CHECK/UNIQUE/FK约束已在迁移中定义
- **加密字段**：users.phone, users.real_name, users.id_card 使用 EncryptTransformer（AES-256-GCM）
- **GENERATED STORED**：players.total_ability_score = base_ability_score + match_adjust_value
- **乐观锁**：matches.version 使用 @VersionColumn
- **状态机**：intentions(6状态), matches(6状态), match_players(4状态)
- **CHECK约束**：formats.team_count_max>=team_count_min, intentions.duration_minutes 120-360, matches.total_players=team_count*players_per_team, matches.confirmed_players<=total_players, feedbacks.overall_rating 1-5
- **空间索引**：venues 的 GIST 索引 on point(longitude, latitude)
- **数组列**：players.team_experience(varchar[]), notifications.sent_via(varchar[])
- **JSONB**：system_params.param_value, notifications.data

## Recommended Approach

在 `apps/admin` 管理后台中新增 `/acceptance-demo` 路由页面，采用**纯静态数据展示**架构，使用 Ant Design 组件构建可视化验收演示。

### 页面结构

```
AcceptanceDemoPage（页面容器）
├── ProcessSteps（顶部9步流程步骤条，支持点击切换）
├── StepSummaryCard（当前步骤摘要：涉及表数、约束数、验收项数）
├── EntityRelationGraph（数据关系图：表卡片 + 外键连线）
├── Tabs[表结构 | 示例数据 | 约束详情 | 状态流转]
│   ├── TableSchemaCard × N（每个表的字段/类型/约束）
│   ├── SampleDataTable × N（每个表的示例数据行）
│   ├── ConstraintPanel（约束分组展示：CHECK/UNIQUE/FK/NOT_NULL）
│   └── StatusFlowDiagram（状态机流转图：意向/比赛/球员状态）
├── AcceptanceChecklist（验收标准勾选列表）
└── TestCategoryTabs（测试分类：业务逻辑 vs 数据库专业）
```

### 核心设计决策

1. **纯静态数据**：所有流程步骤、表结构、示例数据、约束定义硬编码在 `data/acceptance-demo.ts`
2. **9步业务流程**：注册球员 → 注册场地方 → 创建场地 → 提交意向 → 系统匹配 → 确认参赛 → 比赛完成 → 提交反馈 → 系统通知
3. **Ant Design 组件**：Steps、Card、Table、Tag、Tabs、Alert、Timeline、Descriptions
4. **约束可视化**：用颜色区分约束类型（🔴CHECK=#ff4d4f 🟡UNIQUE=#faad14 🔵FK=#1890ff 🟢NOT_NULL=#52c41a）
5. **双重视角**：业务逻辑验收（非技术人员）+ 数据库专业验收（技术人员）
6. **代码风格一致性**：遵循现有 test-dashboard 的 patterns：const数组+联合类型、Record标签映射、Ant Design内联样式、Row/Col网格布局

### 文件清单

| # | 文件路径 | 说明 |
|---|----------|------|
| 1 | `apps/admin/src/types/acceptance-demo.ts` | 验收演示专用类型（ProcessStep, TableSchema, ConstraintDef, SampleRecord） |
| 2 | `apps/admin/src/data/acceptance-demo.ts` | 9步流程完整静态数据（表结构、示例数据、约束、验收标准、测试分类） |
| 3 | `apps/admin/src/components/acceptance-demo/ProcessSteps.tsx` | 顶部9步流程步骤条（Ant Design Steps） |
| 4 | `apps/admin/src/components/acceptance-demo/StepSummaryCard.tsx` | 步骤摘要卡片（表数、约束数、验收项数） |
| 5 | `apps/admin/src/components/acceptance-demo/EntityRelationGraph.tsx` | 表关系可视化（卡片+箭头连线） |
| 6 | `apps/admin/src/components/acceptance-demo/TableSchemaCard.tsx` | 单表结构卡片（字段列表+类型+约束标签） |
| 7 | `apps/admin/src/components/acceptance-demo/SampleDataTable.tsx` | 示例数据表格（Ant Design Table） |
| 8 | `apps/admin/src/components/acceptance-demo/ConstraintBadge.tsx` | 约束类型标签（CHECK/UNIQUE/FK/NOT_NULL） |
| 9 | `apps/admin/src/components/acceptance-demo/ConstraintPanel.tsx` | 约束详情面板（分组展示） |
| 10 | `apps/admin/src/components/acceptance-demo/AcceptanceChecklist.tsx` | 验收标准勾选列表 |
| 11 | `apps/admin/src/components/acceptance-demo/TestCategoryTabs.tsx` | 测试分类标签页（业务逻辑/数据库专业） |
| 12 | `apps/admin/src/components/acceptance-demo/StatusFlowDiagram.tsx` | 状态流转图（意向/比赛/球员状态机） |
| 13 | `apps/admin/src/pages/AcceptanceDemoPage.tsx` | 验收演示主页面 |
| 14 | `apps/admin/src/router/index.tsx` | 添加 `/acceptance-demo` 路由 |
| 15 | `apps/admin/src/layouts/AdminLayout.tsx` | 添加"验收演示"侧边栏菜单项 |

### 9步业务流程数据

| 步骤 | 标题 | 涉及表 | 关键约束 |
|------|------|--------|----------|
| STEP-01 | 球员注册 | users, players, player_positions | phone_hash UNIQUE, password_hash bcrypt, AES加密, FK级联 |
| STEP-02 | 场地方注册 | users, venue_managers | user_id UNIQUE, FK级联 |
| STEP-03 | 创建场地 | venues, venue_time_slots | GIST空间索引, WGS84坐标 |
| STEP-04 | 提交比赛意向 | intentions, intention_venues, intention_formats | duration_minutes CHECK 120-360, end_time计算, 唯一约束 |
| STEP-05 | 系统匹配 | matches, match_players, match_teams | total_players=team_count*players_per_team, version乐观锁, 唯一约束 |
| STEP-06 | 球员确认参赛 | match_players, matches | confirmed_players<=total_players, 状态流转, 押金支付 |
| STEP-07 | 比赛完成 | matches | status流转: confirmed→in_progress→completed |
| STEP-08 | 提交反馈 | feedbacks, feedback_player_ratings | overall_rating CHECK 1-5, 唯一约束(match_id,player_id) |
| STEP-09 | 系统通知 | notifications | sent_via数组, is_read默认false |

### 验收标准分类

**业务逻辑验收（面向非技术人员）**：
- 用户可成功注册为球员/场地方
- 敏感信息不以明文存储
- 球员可提交比赛意向
- 系统正确计算结束时间
- 比赛时长在2-6小时范围
- 系统根据意向自动匹配
- 队伍分配公平
- 球员可确认参赛并支付保证金
- 人数足够时比赛自动确认
- 球员可对其他球员评分

**数据库专业验收（面向技术人员）**：
- 所有外键约束正确建立
- 所有CHECK约束在数据库层生效
- 所有UNIQUE约束防止重复数据
- 级联删除策略正确
- 乐观锁version字段防止并发更新
- 事务一致性
- 调节值累加限制在[-50,50]

## Critical Files to Modify

- `apps/admin/src/router/index.tsx` — 添加 `/acceptance-demo` 路由
- `apps/admin/src/layouts/AdminLayout.tsx` — 添加侧边栏菜单项
- `apps/admin/src/types/acceptance-demo.ts` — 新建类型定义
- `apps/admin/src/data/acceptance-demo.ts` — 新建9步流程数据
- `apps/admin/src/pages/AcceptanceDemoPage.tsx` — 新建主页面
- `apps/admin/src/components/acceptance-demo/*.tsx` — 新建12个组件

## Verification

1. **类型检查**：`cd apps/admin && npx tsc --noEmit` 无错误
2. **构建测试**：`cd apps/admin && npm run build` 成功
3. **单元测试**：`cd apps/admin && npm test` 现有测试全部通过
4. **开发服务器**：`cd apps/admin && npm run dev` 访问 `/acceptance-demo` 正常渲染
5. **视觉验证**：
   - 侧边栏显示"验收演示"菜单项
   - 页面顶部显示9步流程步骤条
   - 点击步骤切换展示对应内容
   - 每个步骤展示涉及的数据库表卡片
   - 表结构卡片展示字段/类型/约束
   - 示例数据表格展示模拟数据行
   - 约束面板按类型分组展示
   - 验收标准列表可勾选
   - 测试分类标签页可切换
