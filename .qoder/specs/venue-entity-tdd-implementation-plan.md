# Module 1.2 — 场地实体（Venues + VenueTimeSlots）TDD 实现计划

## Context

Module 1.1（用户与认证实体）已完成，包含 `users`、`venue_managers`、`players`、`player_positions` 四张表及其 TypeORM 实体、Migration 和测试。Module 1.2 是 Phase 1 数据层的第二个模块，目标是定义场地（`venues`）和场地可预订时段（`venue_time_slots`）两张核心表，为后续场地管理、意向提交、匹配引擎提供数据基础。

本模块严格遵循 TDD 原则：先编写测试代码，再编写实现代码，确保测试覆盖率 >= 80%。

## 已有基础设施与模式（Module 1.1 确立）

- **实体风格**：属性名 camelCase，`@Column({ name: 'snake_case' })` 映射；`@Index` 声明索引；`@CreateDateColumn` / `@UpdateDateColumn` 管理时间戳
- **测试风格**：真实 PostgreSQL 连接（DataSource），测试数据库 `basketball_platform_test`；`beforeAll` 初始化，`afterEach` TRUNCATE 表（注意顺序：子表先于父表），`afterAll` destroy
- **Migration 风格**：TypeORM 手写 Migration，完整 `up()` + `down()`，原始 SQL 通过 QueryRunner 执行
- **共享类型**：`shared/types/venue.ts` 已定义 `FLOOR_MATERIALS`、`COURT_TYPES`、`VENUE_STATUSES` 等常量数组和联合类型
- **路径映射**：`@modules/` → `src/modules/`，`@common/` → `src/common/`，`@shared/` → `../../shared/types/`

## 需要创建的文件

| # | 文件路径 | 说明 |
|---|---------|------|
| 1 | `server/src/modules/venues/entities/venue.entity.ts` | Venue 实体定义 |
| 2 | `server/src/modules/venues/entities/venue-time-slot.entity.ts` | VenueTimeSlot 实体定义 |
| 3 | `server/src/modules/venues/entities/venue.entity.spec.ts` | Venue 实体 TDD 测试 |
| 4 | `server/src/modules/venues/entities/venue-time-slot.entity.spec.ts` | VenueTimeSlot 实体 TDD 测试 |
| 5 | `server/src/modules/venues/venues.module.ts` | Venues NestJS 模块 |
| 6 | `server/src/migrations/1716740000002-CreateVenueTables.ts` | 场地表 Migration |

## 需要修改的文件

| # | 文件路径 | 说明 |
|---|---------|------|
| 7 | `server/src/app.module.ts` | 注册 `VenuesModule` |

---

## 执行顺序（严格测试先行）

```
Step 1: 创建目录结构
  mkdir -p server/src/modules/venues/entities/

Step 2: 编写 Venue 实体测试（Red）
  → venue.entity.spec.ts
  运行: npx jest venue.entity.spec.ts --runInBand → 全部失败

Step 3: 编写 Venue 实体实现（Green）
  → venue.entity.ts
  运行: npx jest venue.entity.spec.ts --runInBand → 通过

Step 4: 编写 VenueTimeSlot 实体测试（Red）
  → venue-time-slot.entity.spec.ts
  运行: npx jest venue-time-slot.entity.spec.ts --runInBand → 全部失败

Step 5: 编写 VenueTimeSlot 实体实现（Green）
  → venue-time-slot.entity.ts
  运行: npx jest venue-time-slot.entity.spec.ts --runInBand → 通过

Step 6: 编写 VenuesModule
  → venues.module.ts

Step 7: 更新 AppModule 注册 VenuesModule
  → app.module.ts

Step 8: 编写 Migration
  → 1716740000002-CreateVenueTables.ts

Step 9: 运行完整测试套件验证
  npm test -- --runInBand
  npm run test:cov -- --runInBand

Step 10: 验证 Migration
  npm run migration:run
  npm run migration:show
```

---

## 文件详细设计

### 1. `venue.entity.ts`

**核心设计要点**：
- 外键 `manager_id` → `venue_managers.id`，`@ManyToOne` + `@JoinColumn`，`onDelete: 'CASCADE'`
- 复用共享类型：`FLOOR_MATERIALS`、`COURT_TYPES`、`VENUE_STATUSES`
- 类级索引：`@Index(['managerId'])`、`@Index(['regionCode'])`
- GIST 空间索引 `idx_venues_location` 无法在 TypeORM `@Index` 中直接表达（需要 `point(longitude, latitude)` 表达式），仅在 Migration 中通过原始 SQL 创建，实体中不声明
- 所有布尔字段默认 `false`，`rating_avg` 默认 `5.00`，`rating_count` 默认 `0`，`court_count` 默认 `1`

**字段清单**：

| 属性 | 装饰器 | 说明 |
|------|--------|------|
| `id` | `@PrimaryGeneratedColumn('increment', { type: 'bigint' })` | 主键 |
| `managerId` | `@Column({ name: 'manager_id', type: 'bigint', nullable: false })` | 外键 |
| `manager` | `@ManyToOne(() => VenueManager, { onDelete: 'CASCADE' })` + `@JoinColumn({ name: 'manager_id' })` | 关系 |
| `name` | `@Column({ type: 'varchar', length: 100, nullable: false })` | 场地名称 |
| `address` | `@Column({ type: 'varchar', length: 255, nullable: false })` | 地址 |
| `pricePerHour` | `@Column({ name: 'price_per_hour', type: 'decimal', precision: 10, scale: 2, nullable: false })` | 每小时价格 |
| `courtCount` | `@Column({ name: 'court_count', type: 'int', nullable: false, default: 1 })` | 场地数量 |
| `latitude` | `@Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })` | 纬度 |
| `longitude` | `@Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })` | 经度 |
| `floorMaterial` | `@Column({ name: 'floor_material', type: 'enum', enum: FLOOR_MATERIALS, nullable: true })` | 地面材质 |
| `lighting` | `@Column({ type: 'varchar', length: 50, nullable: true })` | 灯光 |
| `courtType` | `@Column({ name: 'court_type', type: 'enum', enum: COURT_TYPES, nullable: true })` | 场地类型 |
| `ventilation` | `@Column({ type: 'boolean', nullable: true, default: false })` | 通风 |
| `bigFan` | `@Column({ name: 'big_fan', type: 'boolean', nullable: true, default: false })` | 大风扇 |
| `airCondition` | `@Column({ name: 'air_condition', type: 'boolean', nullable: true, default: false })` | 空调 |
| `turnoverTime` | `@Column({ name: 'turnover_time', type: 'int', nullable: true })` | 翻场时间（分钟） |
| `parking` | `@Column({ type: 'boolean', nullable: true, default: false })` | 停车 |
| `restroom` | `@Column({ type: 'boolean', nullable: true, default: false })` | 洗手间 |
| `shower` | `@Column({ type: 'boolean', nullable: true, default: false })` | 淋浴 |
| `lockerRoom` | `@Column({ name: 'locker_room', type: 'boolean', nullable: true, default: false })` | 更衣室 |
| `videoRecord` | `@Column({ name: 'video_record', type: 'boolean', nullable: true, default: false })` | 录像 |
| `ratingAvg` | `@Column({ name: 'rating_avg', type: 'decimal', precision: 3, scale: 2, nullable: true, default: 5.00 })` | 平均评分 |
| `ratingCount` | `@Column({ name: 'rating_count', type: 'int', nullable: true, default: 0 })` | 评分数量 |
| `status` | `@Column({ type: 'enum', enum: VENUE_STATUSES, nullable: false, default: 'active' })` | 状态 |
| `regionCode` | `@Column({ name: 'region_code', type: 'varchar', length: 20, nullable: true })` | 区域编码 |
| `createdAt` | `@CreateDateColumn({ name: 'created_at' })` | 创建时间 |
| `updatedAt` | `@UpdateDateColumn({ name: 'updated_at' })` | 更新时间 |
| `timeSlots` | `@OneToMany(() => VenueTimeSlot, (slot) => slot.venue, { cascade: true })` | 一对多关系 |

### 2. `venue-time-slot.entity.ts`

**核心设计要点**：
- 外键 `venue_id` → `venues.id`，`@ManyToOne` + `@JoinColumn`，`onDelete: 'CASCADE'`
- 类级复合索引：`@Index(['venueId', 'slotDate'])`
- `slot_date` 为 `date` 类型，`start_time` / `end_time` 为 `time without time zone` 类型

**字段清单**：

| 属性 | 装饰器 | 说明 |
|------|--------|------|
| `id` | `@PrimaryGeneratedColumn('increment', { type: 'bigint' })` | 主键 |
| `venueId` | `@Column({ name: 'venue_id', type: 'bigint', nullable: false })` | 外键 |
| `venue` | `@ManyToOne(() => Venue, { onDelete: 'CASCADE' })` + `@JoinColumn({ name: 'venue_id' })` | 关系 |
| `slotDate` | `@Column({ name: 'slot_date', type: 'date', nullable: false })` | 日期 |
| `startTime` | `@Column({ name: 'start_time', type: 'time', nullable: false })` | 开始时间 |
| `endTime` | `@Column({ name: 'end_time', type: 'time', nullable: false })` | 结束时间 |
| `isBooked` | `@Column({ name: 'is_booked', type: 'boolean', nullable: true, default: false })` | 是否已预订 |
| `matchId` | `@Column({ name: 'match_id', type: 'bigint', nullable: true })` | 关联比赛 |
| `createdAt` | `@CreateDateColumn({ name: 'created_at' })` | 创建时间 |

### 3. `venues.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venue } from './entities/venue.entity';
import { VenueTimeSlot } from './entities/venue-time-slot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Venue, VenueTimeSlot])],
  exports: [TypeOrmModule],
})
export class VenuesModule {}
```

### 4. `app.module.ts` 修改

在 `imports` 数组中 `PlayersModule` 之后新增 `VenuesModule` 导入：

```typescript
import { VenuesModule } from './modules/venues/venues.module';

@Module({
  imports: [
    // ... ConfigModule, TypeOrmModule, CommonModule, UsersModule, PlayersModule
    VenuesModule,  // ← 新增
  ],
  // ...
})
```

---

## 测试用例设计

### `venue.entity.spec.ts`

**DataSource 配置**：`entities: [User, VenueManager, Venue, VenueTimeSlot]`，`synchronize: true`

**TRUNCATE 顺序**（afterEach）：`venue_time_slots` → `venues` → `venue_managers` → `users`

#### `describe('table structure')`

| # | 测试名 | 断言 |
|---|--------|------|
| 1 | `should create venues table with correct columns` | `information_schema.columns` 包含全部 25+ 个字段名 |
| 2 | `should have manager_id as non-nullable bigint` | `is_nullable = 'NO'`, `data_type = 'bigint'` |
| 3 | `should have price_per_hour as decimal(10,2)` | `data_type = 'numeric'`, `numeric_precision = 10`, `numeric_scale = 2` |
| 4 | `should have court_count default to 1` | `column_default` 包含 `'1'` |
| 5 | `should have rating_avg default to 5.00` | `column_default` 包含 `'5.00'` |
| 6 | `should have status default to active` | `column_default` 包含 `'active'` |
| 7 | `should have foreign key to venue_managers` | `information_schema.table_constraints` 中 `FOREIGN KEY` >= 1 |
| 8 | `should have index on manager_id` | `pg_indexes` 包含 `idx_venues_manager` |
| 9 | `should have index on region_code` | `pg_indexes` 包含 `idx_venues_region` |

#### `describe('entity creation')`

| # | 测试名 | 断言 |
|---|--------|------|
| 10 | `should create a venue linked to a venue manager` | `saved.id` 已定义，`saved.managerId === savedVm.id`，字段值正确 |
| 11 | `should reject invalid floor_material` | 传入非法枚举值，`rejects.toThrow()` |
| 12 | `should reject invalid court_type` | 传入非法枚举值，`rejects.toThrow()` |
| 13 | `should reject invalid status` | 传入非法枚举值，`rejects.toThrow()` |
| 14 | `should allow optional facility fields to be null` | 可选字段为 `null`，布尔字段默认 `false` |
| 15 | `should cascade delete time slots when venue is deleted` | 删除 Venue 后关联 TimeSlot 不存在 |
| 16 | `should cascade delete when venue manager is deleted` | 删除 VenueManager 后关联 Venue 不存在 |

### `venue-time-slot.entity.spec.ts`

**DataSource 配置**：`entities: [User, VenueManager, Venue, VenueTimeSlot]`，`synchronize: true`

**TRUNCATE 顺序**（afterEach）：`venue_time_slots` → `venues` → `venue_managers` → `users`

#### `describe('table structure')`

| # | 测试名 | 断言 |
|---|--------|------|
| 1 | `should create venue_time_slots table with correct columns` | `information_schema.columns` 包含全部 8 个字段名 |
| 2 | `should have venue_id as non-nullable bigint` | `is_nullable = 'NO'` |
| 3 | `should have slot_date as date type` | `data_type = 'date'` |
| 4 | `should have start_time and end_time as time type` | `data_type = 'time without time zone'` |
| 5 | `should have is_booked default to false` | `column_default` 包含 `'false'` |
| 6 | `should have foreign key to venues` | `constraint_type = 'FOREIGN KEY'` >= 1 |
| 7 | `should have composite index on venue_id and slot_date` | `pg_indexes` 包含 `idx_slots_venue_date` |

#### `describe('entity creation')`

| # | 测试名 | 断言 |
|---|--------|------|
| 8 | `should create a time slot linked to a venue` | `saved.id` 已定义，`saved.venueId === savedVenue.id` |
| 9 | `should allow multiple slots for same venue on same date` | 保存 3 个不同时段，均成功 |
| 10 | `should default is_booked to false` | `saved.isBooked === false` |
| 11 | `should allow match_id to be null` | `saved.matchId === null` |
| 12 | `should cascade delete when venue is deleted` | 删除 Venue 后关联 TimeSlot 不存在 |

---

## Migration 设计

### `1716740000002-CreateVenueTables.ts`

#### `up()` 执行顺序

1. `CREATE TYPE "public"."venues_floor_material_enum" AS ENUM('wood','pu','silicone','cement','other')`
2. `CREATE TYPE "public"."venues_court_type_enum" AS ENUM('indoor','outdoor','semi')`
3. `CREATE TYPE "public"."venues_status_enum" AS ENUM('active','inactive')`
4. `CREATE TABLE "venues"` — 包含全部字段、主键约束
5. `CREATE INDEX "IDX_venues_manager" ON "venues" ("manager_id")`
6. `CREATE INDEX "IDX_venues_region" ON "venues" ("region_code")`
7. `CREATE INDEX "IDX_venues_location" ON "venues" USING GIST (point("longitude", "latitude"))`
8. `CREATE TABLE "venue_time_slots"` — 包含全部字段、主键约束
9. `CREATE INDEX "IDX_slots_venue_date" ON "venue_time_slots" ("venue_id", "slot_date")`
10. `ALTER TABLE "venues" ADD CONSTRAINT "FK_venues_manager" FOREIGN KEY ("manager_id") REFERENCES "venue_managers"("id") ON DELETE CASCADE`
11. `ALTER TABLE "venue_time_slots" ADD CONSTRAINT "FK_slots_venue" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE`

#### `down()` 执行顺序（严格逆序）

1. `ALTER TABLE "venue_time_slots" DROP CONSTRAINT "FK_slots_venue"`
2. `ALTER TABLE "venues" DROP CONSTRAINT "FK_venues_manager"`
3. `DROP INDEX "public"."IDX_slots_venue_date"`
4. `DROP TABLE "venue_time_slots"`
5. `DROP INDEX "public"."IDX_venues_location"`
6. `DROP INDEX "public"."IDX_venues_region"`
7. `DROP INDEX "public"."IDX_venues_manager"`
8. `DROP TABLE "venues"`
9. `DROP TYPE "public"."venues_status_enum"`
10. `DROP TYPE "public"."venues_court_type_enum"`
11. `DROP TYPE "public"."venues_floor_material_enum"`

---

## 验证步骤

### 1. 实体单元测试

```bash
cd server
npx jest venue.entity.spec.ts --runInBand
npx jest venue-time-slot.entity.spec.ts --runInBand
```

预期：所有测试通过（包括 Red 阶段的失败断言和 Green 阶段的成功断言）。

### 2. 覆盖率检查

```bash
cd server
npm run test:cov -- --runInBand
```

预期：`coverage/lcov-report/index.html` 中全局覆盖率 branches/lines/functions/statements 均 >= 80%。

### 3. 完整测试套件

```bash
cd server
npm test -- --runInBand
```

预期：Module 1.1 的所有测试继续通过，Module 1.2 的新测试全部通过，无回归。

### 4. Migration 验证

```bash
cd server
npm run migration:run
npm run migration:show
```

预期：`1716740000002-CreateVenueTables` 出现在已执行迁移列表中。

### 5. 数据库结构验证（可选，通过 psql 或测试查询）

```sql
-- 验证表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('venues', 'venue_time_slots')
ORDER BY table_name, ordinal_position;

-- 验证索引
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('venues', 'venue_time_slots');

-- 验证外键
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND table_name IN ('venues', 'venue_time_slots');
```

---

## 关键文件路径汇总

- `server/src/modules/venues/entities/venue.entity.ts`
- `server/src/modules/venues/entities/venue-time-slot.entity.ts`
- `server/src/modules/venues/entities/venue.entity.spec.ts`
- `server/src/modules/venues/entities/venue-time-slot.entity.spec.ts`
- `server/src/modules/venues/venues.module.ts`
- `server/src/migrations/1716740000002-CreateVenueTables.ts`
- `server/src/app.module.ts`（修改）
