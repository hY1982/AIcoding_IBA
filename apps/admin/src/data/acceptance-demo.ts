/**
 * 端到端验收演示 — 9步业务流程静态数据
 *
 * 包含完整的表结构、示例数据、约束定义、状态流转、验收标准和测试项。
 * 所有数据基于后端实体文件和迁移文件的真实定义。
 */

import type {
  ProcessStep,
  TableSchema,
  ConstraintDef,
  StatusFlow,
  AcceptanceCriterion,
  TestItem,
  EntityRelation,
} from '@/types/acceptance-demo';

// ───────────────────────────────────────────────────────────────
// 全局实体关系
// ───────────────────────────────────────────────────────────────

export const globalEntityRelations: EntityRelation[] = [
  { fromTable: 'venue_managers', fromColumn: 'user_id', toTable: 'users', toColumn: 'id', relationType: 'one-to-one', onDelete: 'CASCADE' },
  { fromTable: 'players', fromColumn: 'user_id', toTable: 'users', toColumn: 'id', relationType: 'one-to-one', onDelete: 'CASCADE' },
  { fromTable: 'player_positions', fromColumn: 'player_id', toTable: 'players', toColumn: 'id', relationType: 'one-to-many', onDelete: 'CASCADE' },
  { fromTable: 'venues', fromColumn: 'manager_id', toTable: 'venue_managers', toColumn: 'id', relationType: 'one-to-many', onDelete: 'CASCADE' },
  { fromTable: 'venue_time_slots', fromColumn: 'venue_id', toTable: 'venues', toColumn: 'id', relationType: 'one-to-many', onDelete: 'CASCADE' },
  { fromTable: 'venue_time_slots', fromColumn: 'match_id', toTable: 'matches', toColumn: 'id', relationType: 'one-to-one', onDelete: 'SET NULL' },
  { fromTable: 'intentions', fromColumn: 'player_id', toTable: 'players', toColumn: 'id', relationType: 'one-to-many', onDelete: 'CASCADE' },
  { fromTable: 'intentions', fromColumn: 'match_id', toTable: 'matches', toColumn: 'id', relationType: 'one-to-one', onDelete: 'SET NULL' },
  { fromTable: 'intention_venues', fromColumn: 'intention_id', toTable: 'intentions', toColumn: 'id', relationType: 'one-to-many', onDelete: 'CASCADE' },
  { fromTable: 'intention_venues', fromColumn: 'venue_id', toTable: 'venues', toColumn: 'id', relationType: 'one-to-many', onDelete: 'NO ACTION' },
  { fromTable: 'intention_formats', fromColumn: 'intention_id', toTable: 'intentions', toColumn: 'id', relationType: 'one-to-many', onDelete: 'CASCADE' },
  { fromTable: 'intention_formats', fromColumn: 'format_id', toTable: 'formats', toColumn: 'id', relationType: 'one-to-many', onDelete: 'NO ACTION' },
  { fromTable: 'matches', fromColumn: 'venue_id', toTable: 'venues', toColumn: 'id', relationType: 'one-to-many', onDelete: 'NO ACTION' },
  { fromTable: 'matches', fromColumn: 'format_id', toTable: 'formats', toColumn: 'id', relationType: 'one-to-many', onDelete: 'NO ACTION' },
  { fromTable: 'match_players', fromColumn: 'match_id', toTable: 'matches', toColumn: 'id', relationType: 'one-to-many', onDelete: 'CASCADE' },
  { fromTable: 'match_players', fromColumn: 'player_id', toTable: 'players', toColumn: 'id', relationType: 'one-to-many', onDelete: 'NO ACTION' },
  { fromTable: 'match_teams', fromColumn: 'match_id', toTable: 'matches', toColumn: 'id', relationType: 'one-to-many', onDelete: 'CASCADE' },
  { fromTable: 'match_messages', fromColumn: 'match_id', toTable: 'matches', toColumn: 'id', relationType: 'one-to-many', onDelete: 'CASCADE' },
  { fromTable: 'match_messages', fromColumn: 'sender_id', toTable: 'users', toColumn: 'id', relationType: 'one-to-many', onDelete: 'NO ACTION' },
  { fromTable: 'feedbacks', fromColumn: 'match_id', toTable: 'matches', toColumn: 'id', relationType: 'one-to-many', onDelete: 'CASCADE' },
  { fromTable: 'feedbacks', fromColumn: 'player_id', toTable: 'players', toColumn: 'id', relationType: 'one-to-many', onDelete: 'NO ACTION' },
  { fromTable: 'feedback_player_ratings', fromColumn: 'feedback_id', toTable: 'feedbacks', toColumn: 'id', relationType: 'one-to-many', onDelete: 'CASCADE' },
  { fromTable: 'feedback_player_ratings', fromColumn: 'rated_player_id', toTable: 'players', toColumn: 'id', relationType: 'one-to-many', onDelete: 'NO ACTION' },
  { fromTable: 'notifications', fromColumn: 'user_id', toTable: 'users', toColumn: 'id', relationType: 'one-to-many', onDelete: 'CASCADE' },
];

// ───────────────────────────────────────────────────────────────
// 表结构定义
// ───────────────────────────────────────────────────────────────

const usersTable: TableSchema = {
  name: 'users',
  description: '用户主表，存储所有注册用户的基础信息',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'phone', type: 'varchar(255)', nullable: false, special: 'AES-256-GCM 加密存储' },
    { name: 'phone_hash', type: 'varchar(64)', nullable: false, special: 'HMAC-SHA256, 用于索引查询' },
    { name: 'password_hash', type: 'varchar(255)', nullable: false, special: 'bcrypt 哈希' },
    { name: 'nickname', type: 'varchar(50)', nullable: false },
    { name: 'real_name', type: 'varchar(255)', nullable: true, special: 'AES-256-GCM 加密存储' },
    { name: 'id_card', type: 'varchar(255)', nullable: true, special: 'AES-256-GCM 加密存储' },
    { name: 'avatar_url', type: 'varchar(500)', nullable: true },
    { name: 'user_type', type: 'enum', nullable: false, defaultValue: "'player'", special: 'player | venue_manager' },
    { name: 'status', type: 'enum', nullable: false, defaultValue: "'active'", special: 'active | inactive | banned' },
    { name: 'region_code', type: 'varchar(20)', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'now()' },
    { name: 'updated_at', type: 'timestamp', nullable: false, defaultValue: 'now()' },
  ],
  constraints: [
    { type: 'UNIQUE', name: 'UQ_users_phone_hash', description: '手机号哈希唯一', table: 'users', columns: ['phone_hash'] },
  ],
  indexes: ['phone_hash', 'user_type', 'status', 'region_code'],
  specialFeatures: ['敏感字段加密存储(phone, real_name, id_card)', 'HMAC-SHA256哈希用于索引查询'],
};

const playersTable: TableSchema = {
  name: 'players',
  description: '球员档案表，存储球员的身体数据、能力评分和位置信息',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'user_id', type: 'bigint', nullable: false, special: 'FK → users(id), ON DELETE CASCADE' },
    { name: 'age', type: 'int', nullable: false },
    { name: 'basketball_age', type: 'int', nullable: false, special: '球龄(年)' },
    { name: 'gender', type: 'enum', nullable: false, special: 'male | female' },
    { name: 'height', type: 'int', nullable: false, special: 'cm' },
    { name: 'weight', type: 'decimal(5,1)', nullable: true, special: 'kg' },
    { name: 'wingspan', type: 'int', nullable: true, special: 'cm' },
    { name: 'standing_reach', type: 'int', nullable: true, special: 'cm' },
    { name: 'jumping_reach', type: 'int', nullable: true, special: 'cm' },
    { name: 'base_ability_score', type: 'decimal(5,2)', nullable: false, defaultValue: '0', special: '基础能力分' },
    { name: 'match_adjust_value', type: 'decimal(5,2)', nullable: false, defaultValue: '0', special: '比赛调节值' },
    { name: 'total_ability_score', type: 'decimal(6,2)', nullable: false, special: 'GENERATED STORED: base + adjust' },
    { name: 'breakthrough_level', type: 'int', nullable: true, defaultValue: '0', special: '0-4' },
    { name: 'passing_level', type: 'int', nullable: true, defaultValue: '0', special: '0-4' },
    { name: 'defense_level', type: 'int', nullable: true, defaultValue: '0', special: '0-4' },
    { name: 'region_code', type: 'varchar(20)', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'now()' },
    { name: 'updated_at', type: 'timestamp', nullable: false, defaultValue: 'now()' },
  ],
  constraints: [
    { type: 'UNIQUE', name: 'UQ_players_user_id', description: '一个用户只能有一个球员档案', table: 'players', columns: ['user_id'] },
    { type: 'FK', name: 'FK_players_user_id', description: '级联删除：用户删除时球员档案自动删除', table: 'players', columns: ['user_id'], sql: 'ON DELETE CASCADE' },
  ],
  indexes: ['total_ability_score', 'region_code'],
  specialFeatures: ['GENERATED STORED列: total_ability_score = base_ability_score + match_adjust_value', '能力等级字段范围 0-4'],
};

const playerPositionsTable: TableSchema = {
  name: 'player_positions',
  description: '球员位置偏好表，一个球员可设置多个位置',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'player_id', type: 'bigint', nullable: false, special: 'FK → players(id), ON DELETE CASCADE' },
    { name: 'position', type: 'enum', nullable: false, special: 'PG | SG | SF | PF | C' },
    { name: 'priority', type: 'int', nullable: false, defaultValue: '1', special: '位置优先级' },
  ],
  constraints: [
    { type: 'UNIQUE', name: 'UQ_player_positions', description: '同一球员同一位置只能有一条记录', table: 'player_positions', columns: ['player_id', 'position'] },
    { type: 'FK', name: 'FK_player_positions_player_id', description: '级联删除', table: 'player_positions', columns: ['player_id'], sql: 'ON DELETE CASCADE' },
  ],
};

const venueManagersTable: TableSchema = {
  name: 'venue_managers',
  description: '场地方管理表',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'user_id', type: 'bigint', nullable: false, special: 'FK → users(id), ON DELETE CASCADE' },
    { name: 'company_name', type: 'varchar(100)', nullable: true },
    { name: 'contact_name', type: 'varchar(50)', nullable: true },
    { name: 'contact_phone', type: 'varchar(20)', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'now()' },
    { name: 'updated_at', type: 'timestamp', nullable: false, defaultValue: 'now()' },
  ],
  constraints: [
    { type: 'UNIQUE', name: 'UQ_venue_managers_user_id', description: '一个用户只能有一个场地方档案', table: 'venue_managers', columns: ['user_id'] },
    { type: 'FK', name: 'FK_venue_managers_user_id', description: '级联删除', table: 'venue_managers', columns: ['user_id'], sql: 'ON DELETE CASCADE' },
  ],
};

const venuesTable: TableSchema = {
  name: 'venues',
  description: '场地信息表，包含场地设施、位置和评分',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'manager_id', type: 'bigint', nullable: false, special: 'FK → venue_managers(id), ON DELETE CASCADE' },
    { name: 'name', type: 'varchar(100)', nullable: false },
    { name: 'address', type: 'varchar(255)', nullable: false },
    { name: 'price_per_hour', type: 'decimal(10,2)', nullable: false },
    { name: 'court_count', type: 'int', nullable: false, defaultValue: '1' },
    { name: 'latitude', type: 'decimal(10,8)', nullable: true, special: 'WGS84坐标系' },
    { name: 'longitude', type: 'decimal(11,8)', nullable: true, special: 'WGS84坐标系' },
    { name: 'floor_material', type: 'enum', nullable: true, special: 'wood | pu | silicone | cement | other' },
    { name: 'lighting', type: 'varchar(50)', nullable: true },
    { name: 'court_type', type: 'enum', nullable: true, special: 'indoor | outdoor | semi' },
    { name: 'ventilation', type: 'boolean', nullable: true, defaultValue: 'false' },
    { name: 'big_fan', type: 'boolean', nullable: true, defaultValue: 'false' },
    { name: 'air_condition', type: 'boolean', nullable: true, defaultValue: 'false' },
    { name: 'parking', type: 'boolean', nullable: true, defaultValue: 'false' },
    { name: 'restroom', type: 'boolean', nullable: true, defaultValue: 'false' },
    { name: 'shower', type: 'boolean', nullable: true, defaultValue: 'false' },
    { name: 'locker_room', type: 'boolean', nullable: true, defaultValue: 'false' },
    { name: 'video_record', type: 'boolean', nullable: true, defaultValue: 'false' },
    { name: 'rating_avg', type: 'decimal(3,2)', nullable: true, defaultValue: 'null' },
    { name: 'rating_count', type: 'int', nullable: true, defaultValue: '0' },
    { name: 'status', type: 'enum', nullable: false, defaultValue: "'active'", special: 'active | inactive' },
    { name: 'region_code', type: 'varchar(20)', nullable: true },
    { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' },
    { name: 'updated_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' },
  ],
  constraints: [
    { type: 'FK', name: 'FK_venues_manager_id', description: '级联删除', table: 'venues', columns: ['manager_id'], sql: 'ON DELETE CASCADE' },
  ],
  indexes: ['manager_id', 'region_code', 'GIST: point(longitude, latitude)'],
  specialFeatures: ['GIST空间索引支持地理位置查询', 'WGS84坐标系'],
};

const venueTimeSlotsTable: TableSchema = {
  name: 'venue_time_slots',
  description: '场地可预订时段表',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'venue_id', type: 'bigint', nullable: false, special: 'FK → venues(id), ON DELETE CASCADE' },
    { name: 'slot_date', type: 'date', nullable: false },
    { name: 'start_time', type: 'time', nullable: false, special: '无时区' },
    { name: 'end_time', type: 'time', nullable: false, special: '无时区' },
    { name: 'is_booked', type: 'boolean', nullable: true, defaultValue: 'false' },
    { name: 'match_id', type: 'bigint', nullable: true, special: 'FK → matches(id), ON DELETE SET NULL' },
    { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'now()' },
  ],
  constraints: [
    { type: 'FK', name: 'FK_time_slots_venue_id', description: '级联删除', table: 'venue_time_slots', columns: ['venue_id'], sql: 'ON DELETE CASCADE' },
    { type: 'FK', name: 'FK_time_slots_match_id', description: '比赛删除时置空', table: 'venue_time_slots', columns: ['match_id'], sql: 'ON DELETE SET NULL' },
  ],
  indexes: ['(venue_id, slot_date)'],
};

const formatsTable: TableSchema = {
  name: 'formats',
  description: '赛制定义表，包含比赛规则和队伍配置',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'name', type: 'varchar(50)', nullable: false },
    { name: 'format_type', type: 'enum', nullable: false, special: 'short | long' },
    { name: 'team_size', type: 'int', nullable: false, special: '每队人数' },
    { name: 'team_count_min', type: 'int', nullable: false, special: '最少队伍数' },
    { name: 'team_count_max', type: 'int', nullable: false, special: '最多队伍数' },
    { name: 'win_condition', type: 'varchar(100)', nullable: true },
    { name: 'duration_hours', type: 'decimal(3,1)', nullable: true, special: '比赛时长(小时)' },
    { name: 'description', type: 'text', nullable: true },
    { name: 'is_active', type: 'boolean', nullable: false, defaultValue: 'true', special: '软删除标记' },
    { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' },
  ],
  constraints: [
    { type: 'CHECK', name: 'CHK_formats_team_counts', description: '最多队伍数 ≥ 最少队伍数', table: 'formats', sql: '"team_count_max" >= "team_count_min"' },
  ],
};

const intentionsTable: TableSchema = {
  name: 'intentions',
  description: '比赛意向表，球员提交的比赛需求',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'player_id', type: 'bigint', nullable: false, special: 'FK → players(id), ON DELETE CASCADE' },
    { name: 'start_time', type: 'timestamptz', nullable: false },
    { name: 'duration_minutes', type: 'int', nullable: false, special: '120-360分钟' },
    { name: 'acceptable_wait_minutes', type: 'int', nullable: false, defaultValue: '30', special: '可接受等待时间' },
    { name: 'end_time', type: 'timestamptz', nullable: false, special: '计算字段: start_time + duration' },
    { name: 'status', type: 'enum', nullable: false, defaultValue: "'pending'", special: 'pending | matched | confirmed | cancelled | expired | failed' },
    { name: 'match_id', type: 'bigint', nullable: true, special: 'FK → matches(id), ON DELETE SET NULL' },
    { name: 'region_code', type: 'varchar(20)', nullable: true },
    { name: 'submitted_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' },
    { name: 'updated_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' },
    { name: 'expires_at', type: 'timestamptz', nullable: false, special: '计算字段: submitted_at + wait' },
  ],
  constraints: [
    { type: 'CHECK', name: 'CHK_intentions_duration', description: '比赛时长2-6小时', table: 'intentions', sql: '"duration_minutes" >= 120 AND "duration_minutes" <= 360' },
    { type: 'FK', name: 'FK_intentions_player_id', description: '级联删除', table: 'intentions', columns: ['player_id'], sql: 'ON DELETE CASCADE' },
    { type: 'FK', name: 'FK_intentions_match_id', description: '比赛删除时置空', table: 'intentions', columns: ['match_id'], sql: 'ON DELETE SET NULL' },
  ],
  indexes: ['status', '(start_time, end_time)', '(player_id, status)', '(region_code, status, start_time)'],
  specialFeatures: ['@BeforeInsert/@BeforeUpdate 计算 end_time 和 expires_at'],
};

const intentionVenuesTable: TableSchema = {
  name: 'intention_venues',
  description: '意向偏好场地关联表',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'intention_id', type: 'bigint', nullable: false, special: 'FK → intentions(id), ON DELETE CASCADE' },
    { name: 'venue_id', type: 'bigint', nullable: false, special: 'FK → venues(id), ON DELETE NO ACTION' },
    { name: 'priority', type: 'int', nullable: false, defaultValue: '1', special: '场地优先级' },
  ],
  constraints: [
    { type: 'UNIQUE', name: 'UQ_intention_venues', description: '同一意向同一场地只能出现一次', table: 'intention_venues', columns: ['intention_id', 'venue_id'] },
    { type: 'FK', name: 'FK_intention_venues_intention_id', description: '级联删除', table: 'intention_venues', columns: ['intention_id'], sql: 'ON DELETE CASCADE' },
    { type: 'FK', name: 'FK_intention_venues_venue_id', description: '禁止级联删除场地', table: 'intention_venues', columns: ['venue_id'], sql: 'ON DELETE NO ACTION' },
  ],
};

const intentionFormatsTable: TableSchema = {
  name: 'intention_formats',
  description: '意向偏好赛制关联表',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'intention_id', type: 'bigint', nullable: false, special: 'FK → intentions(id), ON DELETE CASCADE' },
    { name: 'format_id', type: 'bigint', nullable: false, special: 'FK → formats(id), ON DELETE NO ACTION' },
    { name: 'priority', type: 'int', nullable: false, defaultValue: '1', special: '赛制优先级' },
  ],
  constraints: [
    { type: 'UNIQUE', name: 'UQ_intention_formats', description: '同一意向同一赛制只能出现一次', table: 'intention_formats', columns: ['intention_id', 'format_id'] },
    { type: 'FK', name: 'FK_intention_formats_intention_id', description: '级联删除', table: 'intention_formats', columns: ['intention_id'], sql: 'ON DELETE CASCADE' },
    { type: 'FK', name: 'FK_intention_formats_format_id', description: '禁止级联删除赛制', table: 'intention_formats', columns: ['format_id'], sql: 'ON DELETE NO ACTION' },
  ],
};

const matchesTable: TableSchema = {
  name: 'matches',
  description: '比赛表，存储匹配成功的比赛信息',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'venue_id', type: 'bigint', nullable: false, special: 'FK → venues(id), ON DELETE NO ACTION' },
    { name: 'format_id', type: 'bigint', nullable: false, special: 'FK → formats(id), ON DELETE NO ACTION' },
    { name: 'start_time', type: 'timestamptz', nullable: false },
    { name: 'end_time', type: 'timestamptz', nullable: false },
    { name: 'status', type: 'enum', nullable: false, defaultValue: "'pending_confirmation'", special: 'pending_confirmation | confirmed | in_progress | completed | cancelled | failed' },
    { name: 'team_count', type: 'int', nullable: false, special: '队伍数量' },
    { name: 'players_per_team', type: 'int', nullable: false, special: '每队人数' },
    { name: 'total_players', type: 'int', nullable: false, special: '总人数 = 队伍数 × 每队人数' },
    { name: 'confirmed_players', type: 'int', nullable: false, defaultValue: '0', special: '已确认人数' },
    { name: 'deposit_amount', type: 'decimal(10,2)', nullable: false, special: '保证金金额' },
    { name: 'group_chat_id', type: 'varchar(100)', nullable: true, special: '外部IM群组ID' },
    { name: 'region_code', type: 'varchar(20)', nullable: true },
    { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' },
    { name: 'updated_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' },
    { name: 'version', type: 'int', nullable: false, defaultValue: '1', special: '@VersionColumn 乐观锁' },
  ],
  constraints: [
    { type: 'CHECK', name: 'CHK_matches_positive_team_count', description: '队伍数必须大于0', table: 'matches', sql: '"team_count" > 0' },
    { type: 'CHECK', name: 'CHK_matches_positive_players_per_team', description: '每队人数必须大于0', table: 'matches', sql: '"players_per_team" > 0' },
    { type: 'CHECK', name: 'CHK_matches_total_players', description: '总人数 = 队伍数 × 每队人数', table: 'matches', sql: '"total_players" = "team_count" * "players_per_team"' },
    { type: 'CHECK', name: 'CHK_matches_confirmed_players', description: '已确认人数 ≤ 总人数', table: 'matches', sql: '"confirmed_players" <= "total_players"' },
    { type: 'CHECK', name: 'CHK_matches_time_order', description: '开始时间 < 结束时间', table: 'matches', sql: '"start_time" < "end_time"' },
    { type: 'FK', name: 'FK_matches_venue_id', description: '禁止级联删除场地', table: 'matches', columns: ['venue_id'], sql: 'ON DELETE NO ACTION' },
    { type: 'FK', name: 'FK_matches_format_id', description: '禁止级联删除赛制', table: 'matches', columns: ['format_id'], sql: 'ON DELETE NO ACTION' },
  ],
  indexes: ['status', 'start_time', '(venue_id, start_time)', 'region_code'],
  specialFeatures: ['乐观锁 version 字段防止并发更新', 'Transformer: deposit_amount string↔number'],
};

const matchPlayersTable: TableSchema = {
  name: 'match_players',
  description: '比赛参与球员关联表',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'match_id', type: 'bigint', nullable: false, special: 'FK → matches(id), ON DELETE CASCADE' },
    { name: 'player_id', type: 'bigint', nullable: false, special: 'FK → players(id), ON DELETE NO ACTION' },
    { name: 'team_number', type: 'int', nullable: true, special: '队伍编号' },
    { name: 'is_reserve', type: 'boolean', nullable: false, defaultValue: 'false', special: '是否替补' },
    { name: 'confirmed_at', type: 'timestamptz', nullable: true },
    { name: 'deposit_paid', type: 'boolean', nullable: false, defaultValue: 'false', special: '是否已付押金' },
    { name: 'status', type: 'enum', nullable: false, defaultValue: "'invited'", special: 'invited | confirmed | declined | no_show' },
  ],
  constraints: [
    { type: 'UNIQUE', name: 'UQ_match_players', description: '同一球员在同一比赛只能出现一次', table: 'match_players', columns: ['match_id', 'player_id'] },
    { type: 'FK', name: 'FK_match_players_match_id', description: '级联删除', table: 'match_players', columns: ['match_id'], sql: 'ON DELETE CASCADE' },
    { type: 'FK', name: 'FK_match_players_player_id', description: '禁止级联删除球员', table: 'match_players', columns: ['player_id'], sql: 'ON DELETE NO ACTION' },
  ],
  indexes: ['match_id', 'player_id'],
};

const matchTeamsTable: TableSchema = {
  name: 'match_teams',
  description: '比赛队伍表，存储队伍分配和平均能力',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'match_id', type: 'bigint', nullable: false, special: 'FK → matches(id), ON DELETE CASCADE' },
    { name: 'team_number', type: 'int', nullable: false, special: '队伍编号' },
    { name: 'team_name', type: 'varchar(50)', nullable: true },
    { name: 'avg_ability', type: 'decimal(5,2)', nullable: true, special: '队伍平均能力分' },
  ],
  constraints: [
    { type: 'UNIQUE', name: 'UQ_match_teams', description: '同一比赛同一队伍编号只能出现一次', table: 'match_teams', columns: ['match_id', 'team_number'] },
    { type: 'FK', name: 'FK_match_teams_match_id', description: '级联删除', table: 'match_teams', columns: ['match_id'], sql: 'ON DELETE CASCADE' },
  ],
};

const feedbacksTable: TableSchema = {
  name: 'feedbacks',
  description: '比赛反馈表，球员对比赛的整体评价',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'match_id', type: 'bigint', nullable: false, special: 'FK → matches(id), ON DELETE CASCADE' },
    { name: 'player_id', type: 'bigint', nullable: false, special: 'FK → players(id), ON DELETE NO ACTION' },
    { name: 'overall_rating', type: 'int', nullable: false, special: '1-5星评分' },
    { name: 'overall_reason', type: 'varchar(500)', nullable: true },
    { name: 'submitted_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' },
    { name: 'updated_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' },
    { name: 'region_code', type: 'varchar(20)', nullable: true },
  ],
  constraints: [
    { type: 'UNIQUE', name: 'UQ_feedbacks_match_player', description: '同一球员对同一比赛只能反馈一次', table: 'feedbacks', columns: ['match_id', 'player_id'] },
    { type: 'CHECK', name: 'CHK_feedbacks_overall_rating', description: '评分必须在1-5之间', table: 'feedbacks', sql: '"overall_rating" BETWEEN 1 AND 5' },
    { type: 'FK', name: 'FK_feedbacks_match_id', description: '级联删除', table: 'feedbacks', columns: ['match_id'], sql: 'ON DELETE CASCADE' },
    { type: 'FK', name: 'FK_feedbacks_player_id', description: '禁止级联删除球员', table: 'feedbacks', columns: ['player_id'], sql: 'ON DELETE NO ACTION' },
  ],
  indexes: ['match_id', 'player_id'],
};

const feedbackPlayerRatingsTable: TableSchema = {
  name: 'feedback_player_ratings',
  description: '球员互评表，对队友/对手的详细评价',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'feedback_id', type: 'bigint', nullable: false, special: 'FK → feedbacks(id), ON DELETE CASCADE' },
    { name: 'rated_player_id', type: 'bigint', nullable: false, special: 'FK → players(id), ON DELETE NO ACTION' },
    { name: 'level_match', type: 'enum', nullable: true, special: 'unclear | lower | equal | higher' },
    { name: 'sportsmanship', type: 'enum', nullable: true, special: 'good | average | poor' },
    { name: 'action_cleanliness', type: 'enum', nullable: true, special: 'clean | average | dirty' },
    { name: 'is_punctual', type: 'boolean', nullable: true },
    { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'NOW()' },
  ],
  constraints: [
    { type: 'FK', name: 'FK_fpr_feedback_id', description: '级联删除', table: 'feedback_player_ratings', columns: ['feedback_id'], sql: 'ON DELETE CASCADE' },
    { type: 'FK', name: 'FK_fpr_rated_player_id', description: '禁止级联删除球员', table: 'feedback_player_ratings', columns: ['rated_player_id'], sql: 'ON DELETE NO ACTION' },
  ],
  indexes: ['feedback_id', 'rated_player_id'],
};

const notificationsTable: TableSchema = {
  name: 'notifications',
  description: '系统通知表',
  fields: [
    { name: 'id', type: 'bigint', nullable: false, special: 'PRIMARY KEY, Auto-increment' },
    { name: 'user_id', type: 'bigint', nullable: false, special: 'FK → users(id), ON DELETE CASCADE' },
    { name: 'type', type: 'enum', nullable: false, special: 'match_invited | match_confirmed | match_success | match_failed | intention_matched | intention_expired | intention_reminder | payment_success | payment_failed | feedback_request | system_announcement' },
    { name: 'title', type: 'varchar(200)', nullable: false },
    { name: 'content', type: 'text', nullable: false },
    { name: 'data', type: 'jsonb', nullable: true, special: '额外数据载荷' },
    { name: 'is_read', type: 'boolean', nullable: false, defaultValue: 'false' },
    { name: 'send_status', type: 'enum', nullable: false, defaultValue: "'pending'", special: 'pending | succeeded | failed' },
    { name: 'sent_at', type: 'timestamptz', nullable: true },
    { name: 'sent_via', type: 'varchar(20)[]', nullable: true, special: 'push | sms | in_app' },
    { name: 'region_code', type: 'varchar(20)', nullable: true },
    { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'NOW()' },
  ],
  constraints: [
    { type: 'FK', name: 'FK_notifications_user_id', description: '级联删除', table: 'notifications', columns: ['user_id'], sql: 'ON DELETE CASCADE' },
  ],
  indexes: ['(user_id, is_read, created_at)', 'region_code'],
  specialFeatures: ['数组列 sent_via 存储多个发送渠道', 'JSONB data 字段存储灵活载荷'],
};

// ───────────────────────────────────────────────────────────────
// 状态流转定义
// ───────────────────────────────────────────────────────────────

export const intentionStatusFlow: StatusFlow = {
  entity: 'intentions',
  field: 'status',
  states: ['pending', 'matched', 'confirmed', 'cancelled', 'expired', 'failed'],
  stateLabels: {
    pending: '等待匹配',
    matched: '已匹配',
    confirmed: '已确认',
    cancelled: '已取消',
    expired: '已过期',
    failed: '匹配失败',
  },
  transitions: [
    { from: 'pending', to: ['matched', 'cancelled', 'expired'] },
    { from: 'matched', to: ['confirmed', 'cancelled', 'failed'] },
    { from: 'confirmed', to: ['cancelled'] },
    { from: 'cancelled', to: [] },
    { from: 'expired', to: [] },
    { from: 'failed', to: [] },
  ],
};

export const matchStatusFlow: StatusFlow = {
  entity: 'matches',
  field: 'status',
  states: ['pending_confirmation', 'confirmed', 'in_progress', 'completed', 'cancelled', 'failed'],
  stateLabels: {
    pending_confirmation: '等待确认',
    confirmed: '已确认',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
    failed: '匹配失败',
  },
  transitions: [
    { from: 'pending_confirmation', to: ['confirmed', 'cancelled', 'failed'] },
    { from: 'confirmed', to: ['in_progress', 'cancelled'] },
    { from: 'in_progress', to: ['completed', 'cancelled'] },
    { from: 'completed', to: [] },
    { from: 'cancelled', to: [] },
    { from: 'failed', to: [] },
  ],
};

export const matchPlayerStatusFlow: StatusFlow = {
  entity: 'match_players',
  field: 'status',
  states: ['invited', 'confirmed', 'declined', 'no_show'],
  stateLabels: {
    invited: '已邀请',
    confirmed: '已确认',
    declined: '已拒绝',
    no_show: '未到场',
  },
  transitions: [
    { from: 'invited', to: ['confirmed', 'declined'] },
    { from: 'confirmed', to: ['no_show'] },
    { from: 'declined', to: [] },
    { from: 'no_show', to: [] },
  ],
};

// ───────────────────────────────────────────────────────────────
// 9步业务流程数据
// ───────────────────────────────────────────────────────────────

export const processSteps: ProcessStep[] = [
  {
    id: 'STEP-01',
    title: '球员注册',
    description: '新用户在系统中注册为球员，填写基础信息、身体数据和位置偏好',
    actor: '球员',
    tables: [usersTable, playersTable, playerPositionsTable],
    sampleData: {
      users: [
        { id: 1, phone: '138****8888 (加密)', phone_hash: 'a1b2c3...', password_hash: '$2b$10$...', nickname: '小飞侠', real_name: '张*明 (加密)', user_type: 'player', status: 'active', created_at: '2026-06-01 10:00:00' },
      ],
      players: [
        { id: 1, user_id: 1, age: 25, basketball_age: 8, gender: 'male', height: 180, weight: 75.5, base_ability_score: 82.50, match_adjust_value: 0, total_ability_score: 82.50, breakthrough_level: 3, passing_level: 3, defense_level: 2, region_code: '440300' },
      ],
      player_positions: [
        { id: 1, player_id: 1, position: 'SG', priority: 1 },
        { id: 2, player_id: 1, position: 'SF', priority: 2 },
      ],
    },
    statusFlows: [],
    acceptanceCriteria: [
      { id: 'c1-1', category: 'business', description: '用户可成功注册为球员', checked: true },
      { id: 'c1-2', category: 'business', description: '手机号、真实姓名、身份证号不以明文存储', checked: true },
      { id: 'c1-3', category: 'business', description: '球员可设置多个位置偏好及优先级', checked: true },
      { id: 'c1-4', category: 'database', description: 'users.phone_hash 具有 UNIQUE 约束', checked: true },
      { id: 'c1-5', category: 'database', description: 'players.user_id 具有 UNIQUE 约束（一对一）', checked: true },
      { id: 'c1-6', category: 'database', description: '敏感字段使用 AES-256-GCM 加密', checked: true },
      { id: 'c1-7', category: 'database', description: 'player_positions (player_id, position) 具有 UNIQUE 约束', checked: true },
      { id: 'c1-8', category: 'database', description: '外键级联删除策略正确（删除用户时自动删除球员档案和位置）', checked: true },
    ],
    testItems: [
      { id: 't1-1', category: 'business_logic', name: '球员注册流程', description: '填写手机号、密码、昵称完成注册', expectedResult: '注册成功，跳转完善资料页', relatedTables: ['users'] },
      { id: 't1-2', category: 'business_logic', name: '球员资料完善', description: '填写身体数据、能力等级、位置偏好', expectedResult: '资料保存成功，能力分自动计算', relatedTables: ['players', 'player_positions'] },
      { id: 't1-3', category: 'database_professional', name: '加密字段验证', description: '检查数据库中 phone、real_name、id_card 是否为密文', expectedResult: '字段值为加密后的密文，非明文', relatedTables: ['users'] },
      { id: 't1-4', category: 'database_professional', name: '唯一约束验证', description: '尝试使用相同手机号注册两次', expectedResult: '第二次注册失败，报唯一约束冲突', relatedTables: ['users'] },
      { id: 't1-5', category: 'database_professional', name: '级联删除验证', description: '删除用户后检查球员档案和位置是否同步删除', expectedResult: 'players 和 player_positions 中对应记录被删除', relatedTables: ['users', 'players', 'player_positions'] },
    ],
    businessFlow: [
      '用户打开注册页面',
      '输入手机号、密码、昵称',
      '系统对手机号进行 HMAC-SHA256 哈希',
      '系统对敏感字段进行 AES-256-GCM 加密',
      '密码经过 bcrypt 哈希后存储',
      '注册成功，创建 users 记录',
      '用户完善球员资料（身高、体重、位置等）',
      '系统创建 players 记录和 player_positions 记录',
      'total_ability_score 由数据库自动计算',
    ],
  },
  {
    id: 'STEP-02',
    title: '场地方注册',
    description: '场地方在系统中注册，填写公司信息和联系方式',
    actor: '场地方',
    tables: [usersTable, venueManagersTable],
    sampleData: {
      users: [
        { id: 2, phone: '139****6666 (加密)', phone_hash: 'd4e5f6...', password_hash: '$2b$10$...', nickname: '篮球公园', real_name: '李*强 (加密)', user_type: 'venue_manager', status: 'active', created_at: '2026-06-01 11:00:00' },
      ],
      venue_managers: [
        { id: 1, user_id: 2, company_name: '深圳篮球公园有限公司', contact_name: '李经理', contact_phone: '139****6666', created_at: '2026-06-01 11:00:00' },
      ],
    },
    statusFlows: [],
    acceptanceCriteria: [
      { id: 'c2-1', category: 'business', description: '用户可成功注册为场地方', checked: true },
      { id: 'c2-2', category: 'business', description: '场地方可填写公司信息和联系方式', checked: true },
      { id: 'c2-3', category: 'database', description: 'venue_managers.user_id 具有 UNIQUE 约束', checked: true },
      { id: 'c2-4', category: 'database', description: '外键级联删除策略正确', checked: true },
    ],
    testItems: [
      { id: 't2-1', category: 'business_logic', name: '场地方注册流程', description: '选择场地方类型，填写公司信息', expectedResult: '注册成功，创建 venue_managers 记录', relatedTables: ['users', 'venue_managers'] },
      { id: 't2-2', category: 'database_professional', name: '唯一约束验证', description: '同一用户重复注册为场地方', expectedResult: '第二次注册失败，报唯一约束冲突', relatedTables: ['venue_managers'] },
    ],
    businessFlow: [
      '场地方打开注册页面',
      '选择"场地方"身份',
      '输入手机号、密码、昵称',
      '填写公司名称、联系人、联系电话',
      '系统创建 users 记录（user_type=venue_manager）',
      '系统创建 venue_managers 记录',
    ],
  },
  {
    id: 'STEP-03',
    title: '创建场地',
    description: '场地方创建场地信息，包括地址、设施、价格和可预订时段',
    actor: '场地方',
    tables: [venuesTable, venueTimeSlotsTable],
    sampleData: {
      venues: [
        { id: 1, manager_id: 1, name: '南山篮球公园', address: '深圳市南山区科技园南路88号', price_per_hour: 200.00, court_count: 4, latitude: 22.5431, longitude: 113.9431, floor_material: 'wood', court_type: 'indoor', ventilation: true, air_condition: true, parking: true, restroom: true, shower: true, status: 'active', region_code: '440300' },
      ],
      venue_time_slots: [
        { id: 1, venue_id: 1, slot_date: '2026-06-10', start_time: '09:00:00', end_time: '12:00:00', is_booked: false, match_id: null },
        { id: 2, venue_id: 1, slot_date: '2026-06-10', start_time: '14:00:00', end_time: '17:00:00', is_booked: false, match_id: null },
        { id: 3, venue_id: 1, slot_date: '2026-06-10', start_time: '19:00:00', end_time: '22:00:00', is_booked: false, match_id: null },
      ],
    },
    statusFlows: [],
    acceptanceCriteria: [
      { id: 'c3-1', category: 'business', description: '场地方可创建场地信息', checked: true },
      { id: 'c3-2', category: 'business', description: '场地支持设置多个可预订时段', checked: true },
      { id: 'c3-3', category: 'business', description: '场地坐标使用 WGS84 标准', checked: true },
      { id: 'c3-4', category: 'database', description: 'venues 表具有 GIST 空间索引', checked: true },
      { id: 'c3-5', category: 'database', description: 'venue_time_slots 具有 (venue_id, slot_date) 复合索引', checked: true },
      { id: 'c3-6', category: 'database', description: 'venue_time_slots.match_id 外键 ON DELETE SET NULL', checked: true },
    ],
    testItems: [
      { id: 't3-1', category: 'business_logic', name: '场地创建流程', description: '填写场地名称、地址、设施、价格', expectedResult: '场地创建成功，可查看详情', relatedTables: ['venues'] },
      { id: 't3-2', category: 'business_logic', name: '时段设置', description: '为场地添加可预订时段', expectedResult: '时段添加成功，is_booked 默认为 false', relatedTables: ['venue_time_slots'] },
      { id: 't3-3', category: 'database_professional', name: '空间索引验证', description: '检查 venues 表是否具有 GIST 空间索引', expectedResult: '存在 GIST 索引 on point(longitude, latitude)', relatedTables: ['venues'] },
      { id: 't3-4', category: 'database_professional', name: '级联删除验证', description: '删除场地后检查时段记录', expectedResult: 'venue_time_slots 中对应记录被级联删除', relatedTables: ['venues', 'venue_time_slots'] },
    ],
    businessFlow: [
      '场地方登录系统',
      '进入场地管理页面',
      '填写场地名称、地址、价格',
      '设置场地设施（空调、淋浴、停车场等）',
      '输入经纬度坐标（WGS84）',
      '系统创建 venues 记录',
      '场地方添加可预订时段',
      '系统创建 venue_time_slots 记录',
    ],
  },
  {
    id: 'STEP-04',
    title: '提交比赛意向',
    description: '球员提交比赛意向，包括时间、时长、偏好场地和赛制',
    actor: '球员',
    tables: [intentionsTable, intentionVenuesTable, intentionFormatsTable],
    sampleData: {
      intentions: [
        { id: 1, player_id: 1, start_time: '2026-06-10 14:00:00+08', duration_minutes: 180, acceptable_wait_minutes: 30, end_time: '2026-06-10 17:00:00+08', status: 'pending', match_id: null, region_code: '440300', submitted_at: '2026-06-02 09:00:00+08', expires_at: '2026-06-02 09:30:00+08' },
      ],
      intention_venues: [
        { id: 1, intention_id: 1, venue_id: 1, priority: 1 },
      ],
      intention_formats: [
        { id: 1, intention_id: 1, format_id: 1, priority: 1 },
      ],
    },
    statusFlows: [intentionStatusFlow],
    acceptanceCriteria: [
      { id: 'c4-1', category: 'business', description: '球员可提交比赛意向', checked: true },
      { id: 'c4-2', category: 'business', description: '系统正确计算结束时间（开始时间 + 时长）', checked: true },
      { id: 'c4-3', category: 'business', description: '系统正确计算过期时间（提交时间 + 可接受等待时间）', checked: true },
      { id: 'c4-4', category: 'business', description: '比赛时长限制在2-6小时范围内', checked: true },
      { id: 'c4-5', category: 'database', description: 'intentions.duration_minutes CHECK 约束 120-360', checked: true },
      { id: 'c4-6', category: 'database', description: 'intention_venues (intention_id, venue_id) UNIQUE', checked: true },
      { id: 'c4-7', category: 'database', description: 'intention_formats (intention_id, format_id) UNIQUE', checked: true },
      { id: 'c4-8', category: 'database', description: 'end_time 和 expires_at 由应用层计算（@BeforeInsert/@BeforeUpdate）', checked: true },
    ],
    testItems: [
      { id: 't4-1', category: 'business_logic', name: '提交意向', description: '选择时间、时长、偏好场地和赛制', expectedResult: '意向提交成功，状态为 pending', relatedTables: ['intentions', 'intention_venues', 'intention_formats'] },
      { id: 't4-2', category: 'business_logic', name: '时长边界测试', description: '提交时长为1小时和7小时的意向', expectedResult: '1小时和7小时均提交失败，提示时长必须在2-6小时', relatedTables: ['intentions'] },
      { id: 't4-3', category: 'database_professional', name: 'CHECK 约束验证', description: '直接插入 duration_minutes=60 的记录', expectedResult: '数据库报错，违反 CHECK 约束', relatedTables: ['intentions'] },
      { id: 't4-4', category: 'database_professional', name: '唯一约束验证', description: '同一意向重复添加同一偏好场地', expectedResult: '数据库报错，违反 UNIQUE 约束', relatedTables: ['intention_venues'] },
    ],
    businessFlow: [
      '球员登录系统',
      '选择比赛开始时间',
      '选择比赛时长（2-6小时）',
      '选择偏好场地（可多个，带优先级）',
      '选择偏好赛制（可多个，带优先级）',
      '设置可接受等待时间',
      '系统计算 end_time = start_time + duration',
      '系统计算 expires_at = submitted_at + acceptable_wait_minutes',
      '创建 intentions 记录（status=pending）',
      '创建 intention_venues 和 intention_formats 关联记录',
    ],
  },
  {
    id: 'STEP-05',
    title: '系统匹配',
    description: '系统根据球员意向自动匹配，创建比赛记录、分配队伍',
    actor: '系统',
    tables: [matchesTable, matchPlayersTable, matchTeamsTable, formatsTable],
    sampleData: {
      matches: [
        { id: 1, venue_id: 1, format_id: 1, start_time: '2026-06-10 14:00:00+08', end_time: '2026-06-10 17:00:00+08', status: 'pending_confirmation', team_count: 3, players_per_team: 3, total_players: 9, confirmed_players: 0, deposit_amount: 50.00, version: 1, region_code: '440300' },
      ],
      match_players: [
        { id: 1, match_id: 1, player_id: 1, team_number: 1, is_reserve: false, deposit_paid: false, status: 'invited' },
        { id: 2, match_id: 1, player_id: 2, team_number: 1, is_reserve: false, deposit_paid: false, status: 'invited' },
        { id: 3, match_id: 1, player_id: 3, team_number: 1, is_reserve: false, deposit_paid: false, status: 'invited' },
        { id: 4, match_id: 1, player_id: 4, team_number: 2, is_reserve: false, deposit_paid: false, status: 'invited' },
        { id: 5, match_id: 1, player_id: 5, team_number: 2, is_reserve: false, deposit_paid: false, status: 'invited' },
        { id: 6, match_id: 1, player_id: 6, team_number: 2, is_reserve: false, deposit_paid: false, status: 'invited' },
        { id: 7, match_id: 1, player_id: 7, team_number: 3, is_reserve: false, deposit_paid: false, status: 'invited' },
        { id: 8, match_id: 1, player_id: 8, team_number: 3, is_reserve: false, deposit_paid: false, status: 'invited' },
        { id: 9, match_id: 1, player_id: 9, team_number: 3, is_reserve: false, deposit_paid: false, status: 'invited' },
      ],
      match_teams: [
        { id: 1, match_id: 1, team_number: 1, team_name: 'A队', avg_ability: 80.50 },
        { id: 2, match_id: 1, team_number: 2, team_name: 'B队', avg_ability: 81.20 },
        { id: 3, match_id: 1, team_number: 3, team_name: 'C队', avg_ability: 79.80 },
      ],
    },
    statusFlows: [matchStatusFlow],
    acceptanceCriteria: [
      { id: 'c5-1', category: 'business', description: '系统根据意向自动匹配球员', checked: false },
      { id: 'c5-2', category: 'business', description: '队伍分配公平（能力分均衡）', checked: false },
      { id: 'c5-3', category: 'business', description: '总人数 = 队伍数 × 每队人数', checked: true },
      { id: 'c5-4', category: 'database', description: 'matches.total_players CHECK = team_count * players_per_team', checked: true },
      { id: 'c5-5', category: 'database', description: 'matches.team_count CHECK > 0', checked: true },
      { id: 'c5-6', category: 'database', description: 'matches.players_per_team CHECK > 0', checked: true },
      { id: 'c5-7', category: 'database', description: 'matches.version 乐观锁字段', checked: true },
      { id: 'c5-8', category: 'database', description: 'match_players (match_id, player_id) UNIQUE', checked: true },
      { id: 'c5-9', category: 'database', description: 'match_teams (match_id, team_number) UNIQUE', checked: true },
    ],
    testItems: [
      { id: 't5-1', category: 'business_logic', name: '自动匹配', description: '系统根据时间、地点、能力分匹配球员', expectedResult: '生成比赛记录，分配队伍', relatedTables: ['matches', 'match_players', 'match_teams'] },
      { id: 't5-2', category: 'business_logic', name: '队伍均衡', description: '检查各队平均能力分差异', expectedResult: '各队 avg_ability 差异在合理范围内', relatedTables: ['match_teams'] },
      { id: 't5-3', category: 'database_professional', name: 'CHECK 约束验证', description: '插入 total_players ≠ team_count * players_per_team 的数据', expectedResult: '数据库报错，违反 CHECK 约束', relatedTables: ['matches'] },
      { id: 't5-4', category: 'database_professional', name: '乐观锁验证', description: '并发更新 matches 记录', expectedResult: '后提交的更新因 version 不匹配而失败', relatedTables: ['matches'] },
    ],
    businessFlow: [
      '系统扫描 pending 状态的意向',
      '根据时间、地点、能力分进行匹配算法',
      '确定比赛场地和赛制',
      '计算队伍数量和每队人数',
      '创建 matches 记录（status=pending_confirmation）',
      '分配球员到各队伍',
      '创建 match_players 记录（status=invited）',
      '创建 match_teams 记录',
      '更新意向状态为 matched',
      '发送匹配成功通知',
    ],
  },
  {
    id: 'STEP-06',
    title: '球员确认参赛',
    description: '被匹配的球员确认参赛并支付保证金',
    actor: '球员',
    tables: [matchPlayersTable, matchesTable],
    sampleData: {
      match_players: [
        { id: 1, match_id: 1, player_id: 1, team_number: 1, is_reserve: false, confirmed_at: '2026-06-02 10:00:00+08', deposit_paid: true, status: 'confirmed' },
        { id: 2, match_id: 1, player_id: 2, team_number: 1, is_reserve: false, confirmed_at: '2026-06-02 10:05:00+08', deposit_paid: true, status: 'confirmed' },
      ],
      matches: [
        { id: 1, venue_id: 1, format_id: 1, start_time: '2026-06-10 14:00:00+08', end_time: '2026-06-10 17:00:00+08', status: 'confirmed', team_count: 3, players_per_team: 3, total_players: 9, confirmed_players: 9, deposit_amount: 50.00, version: 2, region_code: '440300' },
      ],
    },
    statusFlows: [matchPlayerStatusFlow, matchStatusFlow],
    acceptanceCriteria: [
      { id: 'c6-1', category: 'business', description: '球员可确认参赛并支付保证金', checked: false },
      { id: 'c6-2', category: 'business', description: '人数足够时比赛自动确认', checked: false },
      { id: 'c6-3', category: 'business', description: '球员可拒绝参赛', checked: false },
      { id: 'c6-4', category: 'database', description: 'matches.confirmed_players CHECK <= total_players', checked: true },
      { id: 'c6-5', category: 'database', description: 'matches.start_time < end_time CHECK', checked: true },
      { id: 'c6-6', category: 'database', description: '乐观锁防止并发更新 confirmed_players', checked: true },
    ],
    testItems: [
      { id: 't6-1', category: 'business_logic', name: '确认参赛', description: '球员点击确认参赛并支付保证金', expectedResult: 'status 变为 confirmed，deposit_paid=true', relatedTables: ['match_players'] },
      { id: 't6-2', category: 'business_logic', name: '自动确认比赛', description: '所有球员确认后比赛状态变化', expectedResult: 'matches.status 从 pending_confirmation 变为 confirmed', relatedTables: ['matches'] },
      { id: 't6-3', category: 'database_professional', name: '确认人数约束', description: 'confirmed_players 超过 total_players', expectedResult: '数据库报错，违反 CHECK 约束', relatedTables: ['matches'] },
      { id: 't6-4', category: 'database_professional', name: '时间顺序约束', description: 'start_time >= end_time', expectedResult: '数据库报错，违反 CHECK 约束', relatedTables: ['matches'] },
    ],
    businessFlow: [
      '球员收到匹配成功通知',
      '查看比赛详情（时间、地点、队友）',
      '点击"确认参赛"',
      '支付保证金',
      '系统更新 match_players.status=confirmed',
      '系统更新 match_players.deposit_paid=true',
      '系统增加 matches.confirmed_players',
      '当 confirmed_players = total_players 时',
      '→ 比赛状态变为 confirmed',
      '→ 创建群聊，发送确认通知',
    ],
  },
  {
    id: 'STEP-07',
    title: '比赛完成',
    description: '比赛进行并结束，系统更新比赛状态',
    actor: '系统/球员',
    tables: [matchesTable],
    sampleData: {
      matches: [
        { id: 1, venue_id: 1, format_id: 1, start_time: '2026-06-10 14:00:00+08', end_time: '2026-06-10 17:00:00+08', status: 'completed', team_count: 3, players_per_team: 3, total_players: 9, confirmed_players: 9, deposit_amount: 50.00, version: 3, region_code: '440300' },
      ],
    },
    statusFlows: [matchStatusFlow],
    acceptanceCriteria: [
      { id: 'c7-1', category: 'business', description: '比赛可正常开始（状态变为 in_progress）', checked: false },
      { id: 'c7-2', category: 'business', description: '比赛可正常结束（状态变为 completed）', checked: false },
      { id: 'c7-3', category: 'database', description: '状态流转符合状态机定义', checked: true },
    ],
    testItems: [
      { id: 't7-1', category: 'business_logic', name: '比赛开始', description: '到达开始时间，比赛状态变化', expectedResult: 'matches.status 从 confirmed 变为 in_progress', relatedTables: ['matches'] },
      { id: 't7-2', category: 'business_logic', name: '比赛结束', description: '到达结束时间，比赛状态变化', expectedResult: 'matches.status 从 in_progress 变为 completed', relatedTables: ['matches'] },
      { id: 't7-3', category: 'database_professional', name: '状态流转约束', description: '尝试从 completed 变为 cancelled', expectedResult: '应用层拒绝非法状态流转', relatedTables: ['matches'] },
    ],
    businessFlow: [
      '到达比赛开始时间',
      '系统更新 matches.status = in_progress',
      '球员到场签到',
      '比赛进行',
      '到达比赛结束时间',
      '系统更新 matches.status = completed',
      '触发反馈请求通知',
    ],
  },
  {
    id: 'STEP-08',
    title: '提交反馈',
    description: '球员对比赛进行评分，并对其他球员进行互评',
    actor: '球员',
    tables: [feedbacksTable, feedbackPlayerRatingsTable],
    sampleData: {
      feedbacks: [
        { id: 1, match_id: 1, player_id: 1, overall_rating: 5, overall_reason: '场地很好，队友配合默契', submitted_at: '2026-06-10 18:00:00+08', region_code: '440300' },
      ],
      feedback_player_ratings: [
        { id: 1, feedback_id: 1, rated_player_id: 2, level_match: 'equal', sportsmanship: 'good', action_cleanliness: 'clean', is_punctual: true },
        { id: 2, feedback_id: 1, rated_player_id: 4, level_match: 'higher', sportsmanship: 'good', action_cleanliness: 'clean', is_punctual: true },
      ],
    },
    statusFlows: [],
    acceptanceCriteria: [
      { id: 'c8-1', category: 'business', description: '球员可对比赛进行1-5星评分', checked: false },
      { id: 'c8-2', category: 'business', description: '球员可对其他球员进行互评', checked: false },
      { id: 'c8-3', category: 'database', description: 'feedbacks.overall_rating CHECK 1-5', checked: true },
      { id: 'c8-4', category: 'database', description: 'feedbacks (match_id, player_id) UNIQUE', checked: true },
      { id: 'c8-5', category: 'database', description: '外键级联删除策略正确', checked: true },
    ],
    testItems: [
      { id: 't8-1', category: 'business_logic', name: '比赛评分', description: '球员对比赛进行整体评分', expectedResult: '反馈提交成功，评分1-5星', relatedTables: ['feedbacks'] },
      { id: 't8-2', category: 'business_logic', name: '球员互评', description: '球员对其他球员进行详细评价', expectedResult: '互评提交成功', relatedTables: ['feedback_player_ratings'] },
      { id: 't8-3', category: 'database_professional', name: '评分范围约束', description: '插入 overall_rating=0 或 6', expectedResult: '数据库报错，违反 CHECK 约束', relatedTables: ['feedbacks'] },
      { id: 't8-4', category: 'database_professional', name: '唯一约束验证', description: '同一球员对同一比赛重复评分', expectedResult: '数据库报错，违反 UNIQUE 约束', relatedTables: ['feedbacks'] },
    ],
    businessFlow: [
      '比赛结束后球员收到反馈请求通知',
      '进入反馈页面',
      '对比赛进行整体评分（1-5星）',
      '填写评分理由（可选）',
      '对其他球员进行互评',
      '→ 水平匹配度（unclear/lower/equal/higher）',
      '→ 体育精神（good/average/poor）',
      '→ 动作干净度（clean/average/dirty）',
      '→ 是否准时（boolean）',
      '系统创建 feedbacks 记录',
      '系统创建 feedback_player_ratings 记录',
      '更新球员能力调节值',
    ],
  },
  {
    id: 'STEP-09',
    title: '系统通知',
    description: '系统通过多种渠道向用户发送通知',
    actor: '系统',
    tables: [notificationsTable],
    sampleData: {
      notifications: [
        { id: 1, user_id: 1, type: 'match_invited', title: '匹配成功', content: '您已被匹配到一场比赛，请确认参赛', data: '{"match_id": 1}', is_read: false, send_status: 'succeeded', sent_at: '2026-06-02 09:30:00+08', sent_via: ['push', 'in_app'], region_code: '440300' },
        { id: 2, user_id: 1, type: 'feedback_request', title: '请评价本场比赛', content: '比赛已结束，请对比赛和队友进行评价', data: '{"match_id": 1}', is_read: false, send_status: 'succeeded', sent_at: '2026-06-10 18:00:00+08', sent_via: ['push', 'in_app'], region_code: '440300' },
      ],
    },
    statusFlows: [],
    acceptanceCriteria: [
      { id: 'c9-1', category: 'business', description: '系统可向用户发送多种类型通知', checked: false },
      { id: 'c9-2', category: 'business', description: '支持多种发送渠道（推送/短信/站内信）', checked: false },
      { id: 'c9-3', category: 'business', description: '通知默认未读状态', checked: true },
      { id: 'c9-4', category: 'database', description: 'notifications.sent_via 为数组类型', checked: true },
      { id: 'c9-5', category: 'database', description: 'notifications.data 为 JSONB 类型', checked: true },
      { id: 'c9-6', category: 'database', description: '复合索引 (user_id, is_read, created_at)', checked: true },
    ],
    testItems: [
      { id: 't9-1', category: 'business_logic', name: '通知发送', description: '匹配成功后发送通知', expectedResult: '用户收到 push + 站内信通知', relatedTables: ['notifications'] },
      { id: 't9-2', category: 'business_logic', name: '通知已读', description: '用户点击通知标记为已读', expectedResult: 'is_read 变为 true', relatedTables: ['notifications'] },
      { id: 't9-3', category: 'database_professional', name: '数组类型验证', description: 'sent_via 存储多个渠道', expectedResult: '可存储 ["push", "in_app"] 等数组值', relatedTables: ['notifications'] },
      { id: 't9-4', category: 'database_professional', name: 'JSONB 验证', description: 'data 字段存储灵活数据', expectedResult: '可存储任意 JSON 结构', relatedTables: ['notifications'] },
    ],
    businessFlow: [
      '系统触发通知事件（匹配成功/比赛确认/反馈请求等）',
      '根据用户偏好确定发送渠道',
      '创建 notifications 记录（send_status=pending）',
      '通过推送/短信/站内信发送',
      '更新 send_status=succeeded 或 failed',
      '记录 sent_at 时间',
      '用户收到通知后可标记为已读',
    ],
  },
];

// ───────────────────────────────────────────────────────────────
// 辅助函数
// ───────────────────────────────────────────────────────────────

export function getStepById(id: string): ProcessStep | undefined {
  return processSteps.find((s) => s.id === id);
}

export function getAllConstraints(): ConstraintDef[] {
  const constraints: ConstraintDef[] = [];
  processSteps.forEach((step) => {
    step.tables.forEach((table) => {
      table.constraints.forEach((c) => {
        constraints.push(c);
      });
    });
  });
  return constraints;
}

export function getConstraintsByType(type: ConstraintDef['type']): ConstraintDef[] {
  return getAllConstraints().filter((c) => c.type === type);
}

export function getAllAcceptanceCriteria(): AcceptanceCriterion[] {
  const criteria: AcceptanceCriterion[] = [];
  processSteps.forEach((step) => {
    criteria.push(...step.acceptanceCriteria);
  });
  return criteria;
}

export function getAllTestItems(): TestItem[] {
  const items: TestItem[] = [];
  processSteps.forEach((step) => {
    items.push(...step.testItems);
  });
  return items;
}
