/**
 * 集成测试仪表板 — 测试场景静态数据
 *
 * 基于项目当前完成状态（Module 1.1 ~ 1.6 数据层已完成，Module 2.x ~ 7.x 待开发）
 * 为每个业务模块定义完整的测试场景、测试数据、执行步骤、验收标准和风险点。
 *
 * 所有场景使用中文业务语言描述，便于非技术人员理解。
 */

import type {
  ModuleDef,
  TestScenario,
  RiskItem,
} from '@/types/test-dashboard';

// ───────────────────────────────────────────────────────────────
// 模块定义
// ───────────────────────────────────────────────────────────────

export const modules: ModuleDef[] = [
  {
    id: 'M1.1',
    name: '用户与认证',
    phase: 1,
    status: 'completed',
    totalScenarios: 2,
    testableScenarios: 1,
    description: '用户注册、登录、敏感数据加密存储',
    entityNames: ['users', 'venue_managers', 'players', 'player_positions'],
  },
  {
    id: 'M1.2',
    name: '场地管理',
    phase: 1,
    status: 'completed',
    totalScenarios: 1,
    testableScenarios: 1,
    description: '场地信息、可预订时段、空间索引',
    entityNames: ['venues', 'venue_time_slots'],
  },
  {
    id: 'M1.3',
    name: '赛制管理',
    phase: 1,
    status: 'completed',
    totalScenarios: 1,
    testableScenarios: 1,
    description: '比赛赛制定义、种子数据',
    entityNames: ['formats'],
  },
  {
    id: 'M1.4',
    name: '比赛意向',
    phase: 1,
    status: 'completed',
    totalScenarios: 3,
    testableScenarios: 1,
    description: '球员提交比赛意向、时间计算、状态管理',
    entityNames: ['intentions', 'intention_venues', 'intention_formats'],
  },
  {
    id: 'M1.5',
    name: '比赛与群聊',
    phase: 1,
    status: 'completed',
    totalScenarios: 4,
    testableScenarios: 0,
    description: '比赛生成、球员确认、群聊消息',
    entityNames: ['matches', 'match_players', 'match_teams', 'match_messages'],
  },
  {
    id: 'M1.6',
    name: '反馈与系统参数',
    phase: 1,
    status: 'completed',
    totalScenarios: 2,
    testableScenarios: 1,
    description: '赛后反馈、能力调节值、系统参数',
    entityNames: ['feedbacks', 'feedback_player_ratings', 'system_params', 'notifications'],
  },
];

// ───────────────────────────────────────────────────────────────
// 全局风险点
// ───────────────────────────────────────────────────────────────

export const globalRisks: RiskItem[] = [
  {
    level: 'high',
    description: 'AES 加密密钥泄露可能导致手机号、真实姓名、身份证号等敏感数据暴露',
    mitigation: '生产环境使用阿里云 KMS 托管密钥，支持密钥轮换；加密密钥通过环境变量注入',
    relatedModuleId: 'M1.1',
  },
  {
    level: 'high',
    description: '多人同时确认参赛时，confirmed_players 计数可能因并发更新导致不一致',
    mitigation: '使用 version 乐观锁字段，在 MatchConfirmationService 中通过事务更新',
    relatedModuleId: 'M1.5',
  },
  {
    level: 'high',
    description: '比赛确认后群聊创建失败，事务回滚逻辑复杂（IM 服务为外部依赖）',
    mitigation: '设计补偿事务机制：若群聊创建失败，标记比赛为待处理状态，人工介入或自动重试',
    relatedModuleId: 'M1.5',
  },
  {
    level: 'high',
    description: '匹配引擎的动态阈值和蛇形分队算法需充分验证，否则可能导致比赛实力悬殊',
    mitigation: 'MVP 先上线简单版本，收集真实数据后迭代；预留算法模块接口便于替换',
    relatedModuleId: 'M1.5',
  },
  {
    level: 'high',
    description: '支付回调重复处理可能导致重复扣款或重复退款',
    mitigation: '订单号全局唯一，回调处理幂等；使用 Redis 分布式锁防止并发处理同一回调',
    relatedModuleId: 'M1.5',
  },
  {
    level: 'medium',
    description: '客户端与服务器时区不一致可能导致"提前1小时"校验错误',
    mitigation: '所有时间字段使用 timestamptz（带时区），API 传输使用 ISO 8601 UTC 格式',
    relatedModuleId: 'M1.4',
  },
  {
    level: 'medium',
    description: 'venue_time_slots.is_booked 状态需与 matches 表同步，存在数据一致性风险',
    mitigation: '在 MatchConfirmationService 中通过数据库事务同时更新两张表',
    relatedModuleId: 'M1.2',
  },
  {
    level: 'medium',
    description: '并发注册场景下可能出现竞态条件导致重复用户记录',
    mitigation: 'phone_hash 字段设置唯一约束，数据库层兜底；应用层加分布式锁',
    relatedModuleId: 'M1.1',
  },
  {
    level: 'medium',
    description: '多实例部署时 WebSocket 消息广播需 Redis Adapter 同步',
    mitigation: '使用 @socket.io/redis-adapter，连接状态存储在 Redis',
    relatedModuleId: 'M1.5',
  },
  {
    level: 'medium',
    description: '系统参数值不合法可能导致匹配引擎异常（如阈值为负数）',
    mitigation: 'AdminController 修改参数时严格校验；使用类型守卫函数验证 JSONB 结构',
    relatedModuleId: 'M1.6',
  },
  {
    level: 'low',
    description: '赛制种子数据固定，无动态变更需求',
    mitigation: '如需新增赛制，通过 Migration 插入新记录',
    relatedModuleId: 'M1.3',
  },
];

// ───────────────────────────────────────────────────────────────
// 测试场景数据
// ───────────────────────────────────────────────────────────────

export const scenarios: TestScenario[] = [
  // ─────────────────────────────────────────────────────────────
  // M1.1 用户与认证
  // ─────────────────────────────────────────────────────────────
  {
    id: 'AUTH-001',
    name: '新球员注册时，系统能否正确保存用户信息并加密敏感字段',
    module: '用户与认证',
    moduleId: 'M1.1',
    status: 'testable',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '准备测试手机号（未注册，如 13800138000）',
        sampleData: { phone: '13800138000', nickname: '测试球员', password: 'Test@1234' },
      },
      {
        step: 2,
        description: '准备球员基础属性（年龄、球龄、性别、身高、体重等）',
        sampleData: { age: 25, basketballAge: 5, gender: 'male', height: 180, weight: 75 },
      },
    ],
    executionSteps: [
      '调用注册接口提交球员注册信息',
      '查询数据库 users 表，验证 phone 字段为密文（非明文手机号）',
      '验证 phone_hash 字段存在且格式为 HMAC-SHA256（64位十六进制字符串）',
      '验证 password_hash 使用 bcrypt 格式（以 $2b$ 开头）',
      '查询 players 表，验证球员记录已创建且关联正确',
    ],
    expectedResult:
      '用户记录创建成功，phone/real_name/id_card 字段为 AES-256-GCM 加密存储，phone_hash 可用于索引查询，password_hash 使用 bcrypt(cost=12)',
    acceptanceCriteria: [
      '数据库中 phone 字段不可直接读取为明文',
      'phone_hash 可用于唯一性校验和索引查询',
      'password_hash 使用 bcrypt 算法，不可逆',
      '球员记录与用户信息正确关联（user_id 外键）',
    ],
    risks: [
      {
        level: 'high',
        description: 'AES 加密密钥管理不当可能导致敏感数据泄露',
      },
      {
        level: 'medium',
        description: '并发注册可能出现竞态条件导致重复记录',
      },
    ],
    relatedEntities: ['users', 'players'],
  },
  {
    id: 'AUTH-002',
    name: '已注册用户再次注册时，系统能否正确拒绝重复注册',
    module: '用户与认证',
    moduleId: 'M1.1',
    status: 'pending_dev',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '先创建一条用户记录（phone_hash 已存在）',
        sqlTemplate: "INSERT INTO users (phone, phone_hash, password_hash, nickname, user_type) VALUES ('encrypted_phone', 'hmac_hash', 'bcrypt_hash', ' existing', 'player');",
      },
    ],
    executionSteps: [
      '使用相同手机号调用注册接口',
      '验证返回错误信息',
      '查询数据库确认无重复用户记录',
    ],
    expectedResult: '返回"手机号已注册"错误，HTTP 状态码 409，不创建重复记录',
    acceptanceCriteria: [
      '返回明确的错误提示（手机号已注册）',
      '数据库中无重复用户记录',
      'HTTP 状态码为 409 Conflict',
    ],
    risks: [
      {
        level: 'medium',
        description: '并发注册场景下可能出现竞态条件导致重复记录',
      },
    ],
    relatedEntities: ['users'],
    notes: '依赖 Module 2.2 AuthService 实现',
  },

  // ─────────────────────────────────────────────────────────────
  // M1.2 场地管理
  // ─────────────────────────────────────────────────────────────
  {
    id: 'VEN-001',
    name: '场地方创建场地后，球员能否查看场地详情和可预订时段',
    module: '场地管理',
    moduleId: 'M1.2',
    status: 'testable',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '创建场地方用户',
        sampleData: { companyName: '腾飞篮球馆', contactName: '张经理' },
      },
      {
        step: 2,
        description: '创建场地记录',
        sampleData: {
          name: '腾飞篮球馆-A馆',
          address: '深圳市福田区深南大道1001号',
          pricePerHour: 200,
          courtCount: 2,
          latitude: 22.5431,
          longitude: 114.0579,
        },
      },
      {
        step: 3,
        description: '添加场地可预订时段',
        sampleData: {
          slotDate: '2026-06-15',
          startTime: '09:00',
          endTime: '12:00',
        },
      },
    ],
    executionSteps: [
      '场地方登录系统',
      '创建场地并填写基本信息（名称、地址、价格、场地数量）',
      '添加场地可预订时段（多个日期和时间段）',
      '球员查看场地列表（支持分页、按地区筛选）',
      '球员查看场地详情和可预订时段（按日期筛选）',
    ],
    expectedResult:
      '场地信息完整展示（含名称、地址、价格、设施等），时段状态（可预订/已预订）正确显示，已预订时段不可再选',
    acceptanceCriteria: [
      '场地列表支持分页加载',
      '支持按地区筛选场地',
      '时段按日期正确筛选',
      '已预订时段标记为不可选',
      '坐标使用 WGS84 标准（SRID 4326）',
    ],
    risks: [
      {
        level: 'medium',
        description: 'venue_time_slots.is_booked 状态需与 matches 表同步，存在数据一致性风险',
      },
    ],
    relatedEntities: ['venues', 'venue_time_slots'],
  },

  // ─────────────────────────────────────────────────────────────
  // M1.3 赛制管理
  // ─────────────────────────────────────────────────────────────
  {
    id: 'FMT-001',
    name: '系统初始化后，3v3/4v4/5v5短赛赛制数据是否正确加载',
    module: '赛制管理',
    moduleId: 'M1.3',
    status: 'testable',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '执行 Migration 1716740000004-SeedFormats',
      },
    ],
    executionSteps: [
      '查询数据库 formats 表',
      '验证 3v3短赛、4v4短赛、5v5短赛三条记录存在',
      '验证各字段值符合预期',
    ],
    expectedResult:
      '三条赛制记录存在，team_size 分别为 3/4/5，team_count_min <= team_count_max，is_active 为 true',
    acceptanceCriteria: [
      '3v3短赛：team_size=3, team_count_min=3, team_count_max=4',
      '4v4短赛：team_size=4, team_count_min=3, team_count_max=4',
      '5v5短赛：team_size=5, team_count_min=2, team_count_max=4',
      '所有赛制 is_active = true',
      '数据库 CHECK 约束 team_count_max >= team_count_min 生效',
    ],
    risks: [
      {
        level: 'low',
        description: '赛制种子数据固定，无动态变更需求',
      },
    ],
    relatedEntities: ['formats'],
  },

  // ─────────────────────────────────────────────────────────────
  // M1.4 比赛意向
  // ─────────────────────────────────────────────────────────────
  {
    id: 'INT-001',
    name: '球员A提交比赛意向后，系统能否正确计算结束时间和过期时间',
    module: '比赛意向',
    moduleId: 'M1.4',
    status: 'testable',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '创建球员A用户和球员记录',
      },
      {
        step: 2,
        description: '准备意向数据',
        sampleData: {
          startTime: '2026-06-15T14:00:00+08:00',
          durationMinutes: 180,
          acceptableWaitMinutes: 30,
        },
      },
    ],
    executionSteps: [
      '球员A提交比赛意向（指定开始时间、比赛时长、可接受等待时长）',
      '查询数据库 intentions 表',
      '验证 end_time = start_time + duration_minutes（14:00 + 180分钟 = 17:00）',
      '验证 expires_at = submitted_at + acceptable_wait_minutes（提交时间 + 30分钟）',
      '验证状态为 pending',
    ],
    expectedResult:
      'end_time 和 expires_at 自动计算正确，状态为 pending，duration_minutes 在 120-360 范围内',
    acceptanceCriteria: [
      'end_time 计算精确到分钟（start_time + duration_minutes）',
      'expires_at 计算正确（submitted_at + acceptable_wait_minutes）',
      '状态初始为 pending',
      'duration_minutes 在 120-360 范围内（数据库 CHECK 约束）',
    ],
    risks: [
      {
        level: 'medium',
        description: '@BeforeInsert/@BeforeUpdate 钩子仅在 TypeORM save() 时触发，绕过 ORM 直接 SQL 更新会导致时间不一致',
      },
    ],
    relatedEntities: ['intentions', 'intention_venues', 'intention_formats'],
    notes: '实体生命周期钩子 computeDerivedTimes() 自动计算衍生时间字段',
  },
  {
    id: 'INT-002',
    name: '球员A提交比赛意向时，若未提前1小时，系统能否正确拒绝',
    module: '比赛意向',
    moduleId: 'M1.4',
    status: 'pending_dev',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '创建球员A',
      },
      {
        step: 2,
        description: '准备 startTime 为当前时间 + 30分钟',
      },
    ],
    executionSteps: [
      '球员A提交意向（开始时间为当前时间 + 30分钟）',
      '验证系统返回错误',
      '查询数据库确认无意向记录',
    ],
    expectedResult: '返回"需提前1小时提交比赛意向"错误，不创建意向记录',
    acceptanceCriteria: [
      '返回明确的错误提示（需提前1小时）',
      '数据库中无意向记录',
      'HTTP 状态码为 400 Bad Request',
    ],
    risks: [
      {
        level: 'medium',
        description: '时间校验需考虑服务器时区与客户端时区一致性',
      },
    ],
    relatedEntities: ['intentions'],
    notes: '依赖 Module 2.5 IntentionService 实现',
  },
  {
    id: 'INT-003',
    name: '球员A提交比赛意向时，若选择超过3个场地或赛制，系统能否正确拒绝',
    module: '比赛意向',
    moduleId: 'M1.4',
    status: 'pending_dev',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '创建球员A',
      },
      {
        step: 2,
        description: '准备 4 个 venueIds 或 4 个 formatIds',
        sampleData: {
          venueIds: [{ venueId: 1 }, { venueId: 2 }, { venueId: 3 }, { venueId: 4 }],
        },
      },
    ],
    executionSteps: [
      '球员A提交意向，选择 4 个场地',
      '验证系统返回错误',
      '重复测试，选择 4 个赛制',
      '验证系统返回错误',
    ],
    expectedResult: '返回"最多选择3个场地/赛制"错误',
    acceptanceCriteria: [
      '场地最多选择 3 个',
      '赛制最多选择 3 个',
      '返回明确的错误提示',
      '数据库中无意向记录',
    ],
    risks: [
      {
        level: 'low',
        description: '纯前端校验+后端校验双重保障',
      },
    ],
    relatedEntities: ['intentions', 'intention_venues', 'intention_formats'],
    notes: '依赖 Module 2.5 IntentionService 实现',
  },

  // ─────────────────────────────────────────────────────────────
  // M1.5 比赛与群聊
  // ─────────────────────────────────────────────────────────────
  {
    id: 'MAT-001',
    name: '匹配成功后，系统能否正确生成比赛记录并分配球员到队伍',
    module: '比赛与群聊',
    moduleId: 'M1.5',
    status: 'pending_dev',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '创建 6~12 名测试球员，录入不同能力值',
      },
      {
        step: 2,
        description: '各球员提交同场地同时段意向',
      },
      {
        step: 3,
        description: '准备赛制（如 3v3短赛，3队）',
      },
    ],
    executionSteps: [
      '触发匹配任务（每5分钟自动执行或手动触发）',
      '查询 matches 表，验证比赛记录生成',
      '查询 match_players 表，验证所有球员已关联',
      '查询 match_teams 表，验证队伍分配完成',
      '验证蛇形分队后各队 avg_ability 差距最小化',
    ],
    expectedResult:
      '生成 match 记录，match_players 关联正确且 status 为 invited，match_teams 队伍分配完成，confirmed_players 初始为 0',
    acceptanceCriteria: [
      'total_players = team_count * players_per_team',
      'match_players.status 初始为 invited',
      'match_teams.team_number 连续编号（1, 2, 3...）',
      '蛇形分队后各队 avg_ability 差距最小化',
      '动态阈值随意向数量增大而减小',
    ],
    risks: [
      {
        level: 'high',
        description: '匹配引擎是核心算法，需充分测试边界情况（人数刚好/不足/超额）',
      },
    ],
    relatedEntities: ['matches', 'match_players', 'match_teams'],
    notes: '依赖 Module 2.6 MatchingEngineService 实现',
  },
  {
    id: 'MAT-002',
    name: '球员确认参赛并支付保证金后，系统能否正确更新比赛状态',
    module: '比赛与群聊',
    moduleId: 'M1.5',
    status: 'pending_dev',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '已生成比赛记录（status = pending_confirmation）',
      },
      {
        step: 2,
        description: '球员收到参赛邀请通知',
      },
      {
        step: 3,
        description: '模拟支付环境配置',
      },
    ],
    executionSteps: [
      '球员点击确认参赛',
      '完成模拟支付（创建订单 -> 支付成功回调）',
      '系统检查确认人数是否达到最低要求',
      '达到要求后比赛状态变为 confirmed',
      '验证场地时段标记为已预订',
      '验证群聊创建成功',
    ],
    expectedResult:
      'match_players.deposit_paid = true, status = confirmed；matches.status = confirmed；group_chat_id 生成；venue_time_slots.is_booked = true',
    acceptanceCriteria: [
      '保证金支付成功（模拟支付全流程）',
      '支付回调幂等（重复回调不重复处理）',
      '场地时段标记为已预订',
      '群聊创建成功并生成 group_chat_id',
      '通知发送给所有参与球员',
      'version 乐观锁防止并发更新丢失',
    ],
    risks: [
      {
        level: 'high',
        description: '支付回调幂等性、并发确认时的乐观锁、群聊创建失败的事务回滚',
      },
    ],
    relatedEntities: ['matches', 'match_players', 'venue_time_slots'],
    notes: '依赖 Module 2.7 MatchConfirmationService + Module 2.x MockPaymentService 实现',
  },
  {
    id: 'MAT-003',
    name: '确认截止时间后人数不足，系统能否正确将比赛标记为失败',
    module: '比赛与群聊',
    moduleId: 'M1.5',
    status: 'pending_dev',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '已生成比赛记录（如 3v3 需要 9 人）',
      },
      {
        step: 2,
        description: '仅部分球员确认（如 5 人确认，不足 9 人）',
      },
      {
        step: 3,
        description: '模拟时间到达确认截止点（比赛开始前 1 小时）',
      },
    ],
    executionSteps: [
      '到达确认截止时间',
      '系统检查 confirmed_players < 最低人数',
      '比赛状态变为 failed',
      '未确认球员收到失败通知',
      '已支付保证金原路退回',
    ],
    expectedResult:
      'matches.status = failed；match_players.status = invited 的变为 declined；球员收到失败通知；已支付保证金退回',
    acceptanceCriteria: [
      '比赛状态正确变为 failed',
      '未确认球员收到失败通知',
      '已支付保证金原路退回（模拟退款）',
      '球员需要重新发送比赛意向',
    ],
    risks: [
      {
        level: 'medium',
        description: '退款流程需保证幂等性，避免重复退款',
      },
    ],
    relatedEntities: ['matches', 'match_players'],
    notes: '依赖 Module 2.7 MatchConfirmationService 实现',
  },
  {
    id: 'MSG-001',
    name: '比赛确认后，参赛球员能否在群聊中发送和接收消息',
    module: '比赛与群聊',
    moduleId: 'M1.5',
    status: 'pending_dev',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '已确认比赛（status = confirmed）',
      },
      {
        step: 2,
        description: '群聊已创建（group_chat_id 已生成）',
      },
      {
        step: 3,
        description: '多名球员在线',
      },
    ],
    executionSteps: [
      '球员A发送群聊消息（text 类型）',
      '球员B实时接收消息（WebSocket 推送）',
      '球员C刷新页面后加载历史消息',
      '模拟一周后再次尝试发送消息',
    ],
    expectedResult:
      '消息实时推送，历史消息分页加载（按时间倒序），一周后群聊自动关闭（不可发送新消息）',
    acceptanceCriteria: [
      '消息实时到达所有在线球员',
      '历史消息按时间倒序分页加载',
      '一周后不可发送新消息（群聊有效期一周）',
      '仅参赛球员可见群聊消息',
      '支持 text/image/system 三种消息类型',
    ],
    risks: [
      {
        level: 'medium',
        description: 'WebSocket 连接稳定性、多实例部署时的消息同步（Redis Adapter）',
      },
    ],
    relatedEntities: ['match_messages', 'matches'],
    notes: '依赖 Module 2.10 MessageService + Module 4.1 WebSocket Gateway 实现',
  },

  // ─────────────────────────────────────────────────────────────
  // M1.6 反馈与系统参数
  // ─────────────────────────────────────────────────────────────
  {
    id: 'FDB-001',
    name: '比赛结束后，球员能否提交对其他球员的反馈评分',
    module: '反馈与系统参数',
    moduleId: 'M1.6',
    status: 'pending_dev',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '已完成比赛（status = completed）',
      },
      {
        step: 2,
        description: '球员A和球员B均参赛',
      },
      {
        step: 3,
        description: '系统参数已配置（ability_adjust_weights）',
      },
    ],
    executionSteps: [
      '球员A提交反馈（overall_rating = 4，评价球员B的水平/球品/动作/守时）',
      '查询 feedbacks 表，验证反馈记录创建',
      '查询 feedback_player_ratings 表，验证评分记录正确',
      '验证球员B的 match_adjust_value 更新',
      '验证 total_ability_score = base_ability_score + match_adjust_value',
    ],
    expectedResult:
      'feedback 记录创建成功，feedback_player_ratings 关联记录正确，球员B的调节值按权重计算更新，累加值限制在 [-50, 50]',
    acceptanceCriteria: [
      'overall_rating 在 1-5 范围内（数据库 CHECK 约束）',
      '必须评价所有其他参赛球员',
      '每场比赛每球员只能反馈一次（唯一约束 match_id + player_id）',
      '调节值计算符合系统参数权重配置',
      '调节值累加有上下限 [-50, 50]',
    ],
    risks: [
      {
        level: 'medium',
        description: '调节值累加需限制在 [-50, 50] 范围内，避免极端值',
      },
    ],
    relatedEntities: ['feedbacks', 'feedback_player_ratings', 'players', 'system_params'],
    notes: '依赖 Module 2.8 FeedbackService + AbilityAdjustService 实现',
  },
  {
    id: 'SYS-001',
    name: '管理员修改系统参数后，匹配引擎能否即时生效新配置',
    module: '反馈与系统参数',
    moduleId: 'M1.6',
    status: 'pending_dev',
    completionStatus: 'completed',
    testData: [
      {
        step: 1,
        description: '管理员账号已创建',
      },
      {
        step: 2,
        description: '当前系统参数值（如 match_threshold_params.base_threshold = 20.0）',
      },
    ],
    executionSteps: [
      '管理员登录管理后台',
      '修改 match_threshold_params（如 base_threshold 改为 15.0）',
      '提交新比赛意向',
      '触发匹配任务',
      '验证匹配引擎使用新阈值',
    ],
    expectedResult: '匹配引擎使用更新后的参数计算动态阈值，无需重启服务',
    acceptanceCriteria: [
      '参数修改即时生效',
      '匹配结果符合新阈值',
      '修改记录可审计（updated_at 更新）',
      '参数值非法时拒绝修改（如负数阈值）',
    ],
    risks: [
      {
        level: 'medium',
        description: '参数校验不严格可能导致匹配引擎异常（如阈值为负数）',
      },
    ],
    relatedEntities: ['system_params'],
    notes: '依赖 Module 2.6 MatchingEngineService + Module 3.7 AdminController 实现',
  },

  // ─────────────────────────────────────────────────────────────
  // 端到端集成场景
  // ─────────────────────────────────────────────────────────────
  {
    id: 'E2E-001',
    name: '完整成功流程：球员注册 -> 提交意向 -> 匹配成功 -> 确认参赛 -> 完成比赛 -> 提交反馈',
    module: '端到端集成',
    moduleId: 'E2E',
    status: 'blocked',
    completionStatus: 'pending',
    testData: [
      {
        step: 1,
        description: '6~12 名测试球员（不同能力值）',
      },
      {
        step: 2,
        description: '1 个测试场地（已创建时段）',
      },
      {
        step: 3,
        description: '1 种赛制（3v3短赛）',
      },
    ],
    executionSteps: [
      '所有球员注册并录入属性（身高、体重、球龄等）',
      '系统计算各球员基础能力值',
      '所有球员提交同场地同时段意向',
      '触发匹配（每5分钟或手动触发）',
      '系统生成比赛记录并分配队伍',
      '所有球员收到参赛邀请并确认+支付保证金',
      '系统确认比赛（人数足够）',
      '场地时段自动预订，群聊创建',
      '模拟比赛完成',
      '所有球员提交赛后反馈',
      '系统计算能力匹配调节值',
    ],
    expectedResult:
      '全流程无错误，数据一致性正确，通知发送完整，能力值调节值正确更新',
    acceptanceCriteria: [
      '每个环节状态流转正确（意向 pending -> matched -> confirmed）',
      '数据库无孤立记录（外键约束生效）',
      '能力值调节值正确更新（在 [-50, 50] 范围内）',
      '通知记录完整（匹配成功、确认邀请、比赛确认、反馈邀请）',
    ],
    risks: [
      {
        level: 'high',
        description: '涉及模块最多，任何环节失败都会导致全流程中断',
      },
    ],
    relatedEntities: [
      'users',
      'players',
      'intentions',
      'matches',
      'match_players',
      'match_teams',
      'feedbacks',
      'notifications',
    ],
    notes: '依赖 Module 2.1 ~ 3.8 全部实现，是最终验收标准',
  },
  {
    id: 'E2E-002',
    name: '匹配失败流程：球员提交意向 -> 到期未匹配 -> 自动取消',
    module: '端到端集成',
    moduleId: 'E2E',
    status: 'blocked',
    completionStatus: 'pending',
    testData: [
      {
        step: 1,
        description: '1 名测试球员',
      },
      {
        step: 2,
        description: '提交意向（acceptable_wait_minutes 较短，如 30 分钟）',
      },
    ],
    executionSteps: [
      '球员提交意向',
      '等待过期（或模拟时间加速）',
      '到期前 3 小时接收提醒通知',
      '到期前半小时自动取消意向',
      '验证意向状态变为 expired',
    ],
    expectedResult:
      '意向状态从 pending -> expired，球员收到过期通知，可重新提交意向',
    acceptanceCriteria: [
      '3 小时提醒通知发送成功',
      '半小时后自动取消（状态变为 expired）',
      '状态正确流转',
      '球员收到过期通知',
    ],
    risks: [
      {
        level: 'medium',
        description: '定时任务可靠性依赖 Cron Job 配置',
      },
    ],
    relatedEntities: ['intentions', 'notifications'],
    notes: '依赖 Module 2.5 IntentionService + Module 2.9 NotificationService 实现',
  },
];

// ───────────────────────────────────────────────────────────────
// 辅助函数
// ───────────────────────────────────────────────────────────────

export function getScenariosByModule(moduleId: string): TestScenario[] {
  return scenarios.filter((s) => s.moduleId === moduleId);
}

export function getScenariosByStatus(status: string): TestScenario[] {
  return scenarios.filter((s) => s.status === status);
}

export function getRiskSummary(): {
  high: number;
  medium: number;
  low: number;
  total: number;
} {
  return {
    high: globalRisks.filter((r) => r.level === 'high').length,
    medium: globalRisks.filter((r) => r.level === 'medium').length,
    low: globalRisks.filter((r) => r.level === 'low').length,
    total: globalRisks.length,
  };
}

export function getModuleStats(): {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
} {
  return {
    total: modules.length,
    completed: modules.filter((m) => m.status === 'completed').length,
    inProgress: modules.filter((m) => m.status === 'in_progress').length,
    pending: modules.filter((m) => m.status === 'pending').length,
  };
}

export function getScenarioStats(): {
  total: number;
  testable: number;
  blocked: number;
  pendingDev: number;
  pendingApi: number;
} {
  return {
    total: scenarios.length,
    testable: scenarios.filter((s) => s.status === 'testable').length,
    blocked: scenarios.filter((s) => s.status === 'blocked').length,
    pendingDev: scenarios.filter((s) => s.status === 'pending_dev').length,
    pendingApi: scenarios.filter((s) => s.status === 'pending_api').length,
  };
}
