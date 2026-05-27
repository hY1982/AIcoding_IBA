# Module 0.5 — 共享类型包初始化 实施计划

## Context

Module 0.1（Git 初始化）、Module 0.2（后端 NestJS 初始化）、Module 0.3（移动端 Expo 初始化）、Module 0.4（管理后台 React 初始化）均已完成并通过审查。根据 `basketball-match-platform-specs.md` 的分模块开发计划，Module 0.5 是 Phase 0 基础设施的最后一步，目标是创建 `shared/` 目录，定义前后端共享的 TypeScript 类型、接口和运行时常量，确保能被 `server/`、`apps/admin/`、`apps/mobile/` 三个消费者正确引用。本模块为后续所有业务模块（实体定义、DTO、前端页面）提供统一的类型契约，避免类型重复定义和不一致。

## 目标

1. 初始化 `shared/` 纯类型包项目结构
2. 定义共享类型：`shared/types/common.ts`、`auth.ts`、`player.ts`、`venue.ts`
3. 包含运行时常量（分页默认值、状态枚举映射等）
4. 配置 `shared/tsconfig.json`，启用严格模式，支持类型自验证
5. 在三个消费者（server/admin/mobile）的 `tsconfig.json` 中配置 `@shared/*` 路径别名
6. 遵循 TDD 原则：先写结构测试，再创建文件，最后验证消费者能正确导入
7. 确保 `cd shared && npx tsc --noEmit` 通过，且三个消费者类型检查均通过

## 当前状态

- 工作目录：`d:/AI_coding_projects/AIcoding_IBA`
- `shared/` 目录：不存在（需新建）
- `server/`：NestJS 项目，CommonJS + ES2021，`paths` 含 `@/*`、`@config/*`、`@common/*`、`@modules/*`
- `apps/admin/`：React + Vite 项目，ESNext + bundler resolution，`paths` 含 `@/*`
- `apps/mobile/`：Expo + RN 项目，extends `expo/tsconfig.base`，`paths` 含 `@/*`
- 三个项目均使用 TypeScript 5.7+
- 现有类型分散：mobile 的 `stores/index.ts` 有内联 `User` 接口，server 尚无 DTO

## 实现计划

### Step 1：创建 TDD 项目结构测试（红阶段）

创建 `shared/__tests__/project-structure.spec.ts`，验证：
- `shared/package.json` 存在，含 `name: '@basketball-match/shared'`，无 `main` 字段（类型包）
- `shared/tsconfig.json` 存在，`strict: true`，`declaration: true`
- `shared/types/index.ts`、`common.ts`、`auth.ts`、`player.ts`、`venue.ts` 存在且导出预期符号
- 三个消费者 `tsconfig.json` 均含 `@shared/*` 路径映射
- 运行测试确认全部失败（红阶段）

### Step 2：创建 shared/package.json

```json
{
  "name": "@basketball-match/shared",
  "version": "0.0.1",
  "private": true,
  "description": "Shared types and constants for basketball match platform",
  "types": "./types/index.ts",
  "exports": {
    "./*": "./types/*.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- 无 `"type"` 字段（无运行时代码）
- 无 `"main"` 字段， `"types"` 指向入口
- `"exports"` 支持子路径导入如 `@shared/auth`

### Step 3：创建 shared/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "emitDeclarationOnly": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["types/*"]
    },
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["types/**/*"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

- `"module": "ESNext"` + `"moduleResolution": "bundler"` 兼容 NestJS(ts-node)、Vite、Expo
- `"declaration": true` + `"emitDeclarationOnly": true` 为未来构建预留

### Step 4：创建共享类型文件

#### `shared/types/common.ts` — 通用响应格式、分页、枚举、常量

```typescript
// API 统一响应格式
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

// 分页请求参数
export interface PaginationParams {
  page: number;
  pageSize: number;
}

// 分页响应包装
export interface PaginatedResponse<T> {
  page: number;
  pageSize: number;
  total: number;
  list: T[];
}

// 运行时常量
// ⚠️ 修改以下常量需全局搜索并同步所有前后端使用方
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

// 用户状态 — 联合类型 + const 数组（单一来源）
export const USER_STATUSES = ['active', 'inactive', 'banned'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: '正常',
  inactive: '未激活',
  banned: '已封禁',
};

// 用户类型 — 联合类型 + const 数组（单一来源）
export const USER_TYPES = ['player', 'venue_manager'] as const;
export type UserType = (typeof USER_TYPES)[number];
export const USER_TYPE_LABELS: Record<UserType, string> = {
  player: '球员',
  venue_manager: '场地方',
};

// JWT Token 对
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// 通用时间戳接口
export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}
```

#### `shared/types/auth.ts` — 认证 DTO 类型

```typescript
import { ApiResponse, TokenPair, UserType, UserStatus, Timestamps } from './common';

// 注册请求
export interface RegisterDto {
  phone: string;
  password: string;
  nickname: string;
  userType: UserType;
  // 球员专属（场地方可选）
  age?: number;
  basketballAge?: number;
  gender?: 'male' | 'female';
  height?: number;
  weight?: number;
  wingspan?: number;
  standingReach?: number;
  jumpingReach?: number;
  positions?: ('PG' | 'SG' | 'SF' | 'PF' | 'C')[];
  regionCode?: string;
  // 场地方专属（球员可选）
  companyName?: string;
  contactName?: string;
  contactPhone?: string;
}

// 登录请求
export interface LoginDto {
  phone: string;
  password: string;
}

// 刷新 Token 请求
export interface RefreshTokenDto {
  refreshToken: string;
}

// 认证响应中的用户摘要
export interface AuthUser {
  id: number;
  phone: string;
  nickname: string;
  userType: UserType;
  avatarUrl?: string;
  status: UserStatus;
  regionCode?: string;
}

// 认证响应（登录/注册/刷新）
export interface AuthResponse {
  user: AuthUser;
  tokens: TokenPair;
}

export type AuthApiResponse = ApiResponse<AuthResponse>;
```

#### `shared/types/player.ts` — 球员属性类型

```typescript
import { Timestamps } from './common';

// 篮球位置 — 联合类型 + const 数组（单一来源）
export const BASKETBALL_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
export type BasketballPosition = (typeof BASKETBALL_POSITIONS)[number];
export const POSITION_LABELS: Record<BasketballPosition, string> = {
  PG: '控球后卫',
  SG: '得分后卫',
  SF: '小前锋',
  PF: '大前锋',
  C: '中锋',
};

// 性别 — 联合类型 + const 数组
export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<Gender, string> = {
  male: '男',
  female: '女',
};

// 位置优先级
export interface PlayerPosition {
  position: BasketballPosition;
  priority: number; // 1 = 最高
}

// 球员基础属性（MVP）
export interface PlayerAttributes {
  age: number;
  basketballAge: number; // 球龄，年
  gender: Gender;
  height: number; // cm
  weight?: number; // kg
  wingspan?: number; // cm
  standingReach?: number; // cm 站立摸高
  jumpingReach?: number; // cm 起跳摸高
  positions: BasketballPosition[];
  regionCode?: string;
}

// 能力值（计算得出）
export interface PlayerAbility {
  baseAbilityScore: number;
  matchAdjustValue: number;
  totalAbilityScore: number;
}

// 球员完整资料
export interface PlayerProfile extends PlayerAttributes, PlayerAbility, Timestamps {
  id: number;
  userId: number;
}

// 球队角色
export const TEAM_ROLES = ['starter', 'bench'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

// P1 扩展属性
export interface PlayerExtendedAttributes {
  benchPress?: number; // kg
  handLength?: number; // cm
  sprint100m?: number; // 秒
  run1000m?: number;
  run2000m?: number;
  run5000m?: number;
  runRecordDate?: string;
  teamExperience?: string[];
  teamRole?: TeamRole;
  breakthroughLevel?: number; // 0-4
  passingLevel?: number; // 0-4
  defenseLevel?: number; // 0-4
}

// 投篮记录
export const SHOOTING_RECORD_TYPES = ['free_throw', 'three_point'] as const;
export type ShootingRecordType = (typeof SHOOTING_RECORD_TYPES)[number];

export interface ShootingRecord {
  id: number;
  playerId: number;
  recordType: ShootingRecordType;
  shotsAttempted: number;
  shotsMade: number;
  recordDate: string;
}

// 投篮统计（滚动半年）
export interface ShootingStats {
  recordType: ShootingRecordType;
  totalAttempted: number;
  totalMade: number;
  percentage: number;
}
```

#### `shared/types/venue.ts` — 场地类型

```typescript
import { Timestamps } from './common';

// 地面材质 — 联合类型 + const 数组
export const FLOOR_MATERIALS = ['wood', 'pu', 'silicone', 'cement', 'other'] as const;
export type FloorMaterial = (typeof FLOOR_MATERIALS)[number];
export const FLOOR_MATERIAL_LABELS: Record<FloorMaterial, string> = {
  wood: '木地板',
  pu: 'PU',
  silicone: '硅PU',
  cement: '水泥地',
  other: '其他',
};

// 场地类型 — 联合类型 + const 数组
export const COURT_TYPES = ['indoor', 'outdoor', 'semi'] as const;
export type CourtType = (typeof COURT_TYPES)[number];
export const COURT_TYPE_LABELS: Record<CourtType, string> = {
  indoor: '室内',
  outdoor: '室外',
  semi: '半室内',
};

// 场地状态 — 联合类型 + const 数组
export const VENUE_STATUSES = ['active', 'inactive'] as const;
export type VenueStatus = (typeof VENUE_STATUSES)[number];
export const VENUE_STATUS_LABELS: Record<VenueStatus, string> = {
  active: '营业中',
  inactive: '已停业',
};

// 基础场地（MVP）
export interface Venue {
  id: number;
  managerId: number;
  name: string;
  address: string;
  pricePerHour: number;
  courtCount: number;
  latitude?: number;
  longitude?: number;
  status: VenueStatus;
  regionCode?: string;
  ratingAvg?: number;
  ratingCount?: number;
  createdAt: string;
  updatedAt: string;
}

// 场地详情（含 P1 扩展字段）
export interface VenueDetail extends Venue {
  floorMaterial?: FloorMaterial;
  lighting?: string;
  courtType?: CourtType;
  ventilation?: boolean;
  bigFan?: boolean;
  airCondition?: boolean;
  turnoverTime?: number; // 翻场时间，分钟
  parking?: boolean;
  restroom?: boolean;
  shower?: boolean;
  lockerRoom?: boolean;
  videoRecord?: boolean;
}

// 场地可预订时段
export interface VenueTimeSlot {
  id: number;
  venueId: number;
  slotDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isBooked: boolean;
  matchId?: number;
}

// 场地列表项（简化）
export interface VenueListItem {
  id: number;
  name: string;
  address: string;
  pricePerHour: number;
  courtCount: number;
  ratingAvg: number;
  ratingCount: number;
}
```

#### `shared/types/index.ts` — Barrel Export

```typescript
export * from './common';
export * from './auth';
export * from './player';
export * from './venue';
```

### Step 5：配置消费者 tsconfig.json 路径别名

#### `server/tsconfig.json` — 添加 `@shared/*`

在现有 `paths` 中追加：
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"],
      "@config/*": ["src/config/*"],
      "@common/*": ["src/common/*"],
      "@modules/*": ["src/modules/*"],
      "@shared/*": ["../shared/types/*"]
    }
  }
}
```

#### `apps/admin/tsconfig.json` — 添加 `@shared/*`

在现有 `paths` 中追加：
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../../shared/types/*"]
    }
  }
}
```

#### `apps/mobile/tsconfig.json` — 添加 `@shared/*`

在现有 `paths` 中追加：
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../../shared/types/*"]
    }
  }
}
```

### Step 6：消费者导入验证（绿阶段前置）

在每个消费者中创建**专用验证文件**（不污染生产代码），确保 TypeScript 能正确解析：

- `server/src/__typecheck__/shared-imports.verify.ts`：
  ```typescript
  import { LoginDto, ApiResponse, AuthResponse } from '@shared/auth';
  import { PlayerProfile, PlayerAbility } from '@shared/player';
  import { Venue, VenueDetail, VenueTimeSlot } from '@shared/venue';
  import { ApiResponse as CommonApiResponse, PaginatedResponse, TokenPair } from '@shared/common';

  // 类型验证：确保关键接口可实例化（编译时检查）
  type _VerifyLoginDto = LoginDto;
  type _VerifyPlayerProfile = PlayerProfile;
  type _VerifyVenue = Venue;
  type _VerifyApiResponse = ApiResponse<unknown>;
  ```

- `apps/admin/src/__typecheck__/shared-imports.verify.ts`：
  ```typescript
  import { PlayerProfile, PlayerAttributes, BasketballPosition } from '@shared/player';
  import { Venue, VenueListItem, VenueStatus, VENUE_STATUSES } from '@shared/venue';
  import { ApiResponse, PaginatedResponse, UserType, USER_TYPES } from '@shared/common';

  type _VerifyPlayerProfile = PlayerProfile;
  type _VerifyVenue = Venue;
  type _VerifyUserType = UserType;
  ```

- `apps/mobile/src/__typecheck__/shared-imports.verify.ts`：
  ```typescript
  import { RegisterDto, LoginDto, AuthUser, AuthResponse } from '@shared/auth';
  import { PlayerProfile, PlayerAttributes, Gender, GENDERS } from '@shared/player';
  import { Venue, VenueDetail, CourtType, COURT_TYPES } from '@shared/venue';
  import { ApiResponse, TokenPair, DEFAULT_PAGE_SIZE } from '@shared/common';

  type _VerifyRegisterDto = RegisterDto;
  type _VerifyPlayerProfile = PlayerProfile;
  type _VerifyVenue = Venue;
  type _VerifyGender = Gender;
  ```

> 这些验证文件仅用于类型检查验证，不导入到任何业务模块中。可在 `.gitignore` 中忽略 `__typecheck__/` 目录，或保留作为文档化的验证契约。

### Step 7：运行验证（绿阶段）

执行以下命令序列确认全部通过：

```bash
# 1. 共享包类型自检查
cd shared && npx tsc --noEmit

# 2. 运行 TDD 结构测试
cd shared && npx jest __tests__/project-structure.spec.ts

# 3. 服务端类型检查（含 shared 导入）
cd server && npx tsc --noEmit

# 4. 管理后台类型检查（含 shared 导入）
cd apps/admin && npm run typecheck

# 5. 移动端类型检查（含 shared 导入）
cd apps/mobile && npm run typecheck
```

### Step 8：Git 提交

```bash
git add shared/ server/tsconfig.json apps/admin/tsconfig.json apps/mobile/tsconfig.json
git commit -m "module(0.5): shared types init - auth, player, venue, common types, consumers configured"
```

## 需要创建的文件清单

| 文件路径 | 说明 |
|---------|------|
| `shared/package.json` | 类型包元数据，types-only 配置 |
| `shared/tsconfig.json` | TypeScript 严格模式 + 声明文件配置 |
| `shared/types/index.ts` | Barrel export 入口 |
| `shared/types/common.ts` | ApiResponse、PaginatedResponse、TokenPair、枚举、常量 |
| `shared/types/auth.ts` | RegisterDto、LoginDto、RefreshTokenDto、AuthUser、AuthResponse |
| `shared/types/player.ts` | PlayerAttributes、PlayerProfile、PlayerAbility、ShootingRecord、ShootingStats |
| `shared/types/venue.ts` | Venue、VenueDetail、VenueTimeSlot、VenueListItem、枚举 |
| `shared/__tests__/project-structure.spec.ts` | TDD 项目结构测试 |

## 需要修改的文件清单

| 文件路径 | 修改内容 |
|---------|----------|
| `server/tsconfig.json` | `paths` 追加 `"@shared/*": ["../shared/types/*"]` |
| `apps/admin/tsconfig.json` | `paths` 追加 `"@shared/*": ["../../shared/types/*"]` |
| `apps/mobile/tsconfig.json` | `paths` 追加 `"@shared/*": ["../../shared/types/*"]` |
| `server/src/__typecheck__/shared-imports.verify.ts` | 新建：验证 `@shared/*` 导入 |
| `apps/admin/src/__typecheck__/shared-imports.verify.ts` | 新建：验证 `@shared/*` 导入 |
| `apps/mobile/src/__typecheck__/shared-imports.verify.ts` | 新建：验证 `@shared/*` 导入 |

## 验证步骤

1. **项目结构测试**：`cd shared && npx jest __tests__/project-structure.spec.ts` 全部通过
2. **共享包类型检查**：`cd shared && npx tsc --noEmit` 无编译错误
3. **服务端类型检查**：`cd server && npx tsc --noEmit` 无编译错误（含 `@shared/*` 导入）
4. **管理后台类型检查**：`cd apps/admin && npm run typecheck` 无编译错误
5. **移动端类型检查**：`cd apps/mobile && npm run typecheck` 无编译错误
6. **Git 验证**：`git log --oneline` 显示 Module 0.5 的 commit

## 关键路径

- `shared/types/index.ts` — 类型包入口
- `shared/tsconfig.json` — 跨消费者兼容的 TS 配置（ESNext + bundler resolution）
- `server/tsconfig.json` — 消费者路径映射（CommonJS 环境）
- `apps/admin/tsconfig.json` — 消费者路径映射（ESNext + bundler 环境）
- `apps/mobile/tsconfig.json` — 消费者路径映射（Expo 环境）

## 风险与应对

| 风险 | 应对策略 |
|------|----------|
| server（CommonJS）无法解析 ESNext 类型文件 | 类型文件无运行时代码，TypeScript 编译时解析，与 module 格式无关 |
| mobile（Expo）tsconfig extends 导致 paths 被覆盖 | `expo/tsconfig.base` 不定义 `paths`，追加自定义 `paths` 安全 |
| admin（bundler resolution）找不到 `@shared/*` | 使用 `"moduleResolution": "bundler"` 与 shared 包一致，Vite 原生支持 |
| 三个消费者相对路径深度不同 | server 用 `../shared`，admin/mobile 用 `../../shared`，分别配置 |
| 类型循环依赖 | 当前类型文件按 common → auth/player/venue 分层，无交叉依赖 |

## 状态管理策略（文档记录）

> `shared/` 包定位为**纯类型与常量包**，不包含：
> - 业务逻辑或运行时函数
> - 状态管理（Zustand/Redux）
> - UI 组件
> - 数据库实体装饰器（TypeORM）
>
> 运行时工具函数（如加密、日期格式化）应放在各自项目的 `utils/` 中；数据库实体定义放在 `server/src/modules/*/entities/` 中，可引用 `shared/` 类型但保持独立。
>
> **实体与共享类型的映射指引（供 Phase 1 参考）**：
> - 建议 TypeORM 实体通过 `implements` 继承 `shared/` 中的核心接口（如 `PlayerProfile`、`Venue`），确保数据库模型与 API 契约一致
> - 实体可额外添加 `@Column()`、`@PrimaryGeneratedColumn()` 等装饰器，不影响接口实现
> - 对于含计算字段的接口（如 `PlayerProfile extends PlayerAbility`），实体中对应字段使用 `@Column()` 存储基础值，计算属性通过 `@AfterLoad()` 或 Service 层计算

## 未来演进（类型版本与发布策略）

> 当前 `shared/` 采用**源码引用**模式（tsconfig `paths` 直接映射），是开发期的便捷选择。当项目进入独立部署阶段（CI/CD 流水线分离）时，建议按以下路径演进：
>
> 1. **私有 NPM 包**：将 `shared/` 发布为私有 NPM 包（版本号跟随主版本），各消费者通过 `"@basketball-match/shared": "^x.x.x"` 引用。优势：版本锁定严格，部署可复现。
> 2. **OpenAPI 契约生成**：后端通过 `@nestjs/swagger` 生成 OpenAPI Spec，前端使用 `openapi-typescript` 自动生成类型。优势：前后端类型始终与运行时 API 一致，消除人工同步风险。
>
> 当前阶段优先选择源码引用，避免过早引入发布流程复杂度。

## 运行时常量一致性说明

> `common.ts` 中定义的 `DEFAULT_PAGE_SIZE = 10`、`MAX_PAGE_SIZE = 100` 等常量，在编译时嵌入各消费者代码。
> **修改此类常量需全局搜索并同步所有使用它的前后端代码**，否则会出现分页不一致。
>
> 进阶方案（P1 后评估）：将必须强一致的分页配置提取为后端 `/api/config` 运行时配置接口，前端应用初始化时拉取。当前常量方案在 MVP 阶段足够简单，团队需意识到其局限性。
