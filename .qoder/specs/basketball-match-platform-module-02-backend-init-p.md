# Module 0.2 — 后端基础依赖与项目初始化 实施计划

## Context

Module 0.1（Git 初始化）已完成，当前工作目录 `d:/AI_coding_projects/AIcoding_IBA` 已具备 Git 版本控制基础。根据 `basketball-match-platform-specs.md` 的分模块开发计划，Module 0.2 是 Phase 0 基础设施的第二步，目标是在 `server/` 目录下初始化 NestJS 后端项目，配置 TypeORM + PostgreSQL 连接、Redis 连接、Jest 测试环境，确保项目能编译、测试、启动。本模块为后续所有后端业务模块（实体定义、Service、Controller）提供运行基础。

## 目标

1. 初始化 NestJS 项目结构（`server/` 目录）
2. 配置 TypeORM + PostgreSQL 数据库连接（支持环境变量）
3. 配置 Redis 连接（ioredis）
4. 配置 Jest 单元测试 + E2E 测试环境
5. 确保 `npm install`、`npm run build`、`npm run test`、`npm run start:dev` 全部通过
6. 遵循 TDD 原则：先写测试（至少一个示例测试通过），再确保基础设施可用

## 当前状态

- 工作目录：`d:/AI_coding_projects/AIcoding_IBA`
- Git 状态：`main` 分支，1 个 commit，工作树干净
- Node.js：v24.14.0
- npm：11.9.0
- `server/` 目录：不存在（需新建）
- PostgreSQL：待验证（开发环境需安装或 Docker 运行）
- Redis：待验证（开发环境需安装或 Docker 运行）

## 实现计划

### Step 1：创建 `server/` 目录并初始化 package.json

使用 `@nestjs/cli@11.0.21` 初始化项目，配合 `--strict --skip-git` 参数。

```bash
npx @nestjs/cli@11.0.21 new server --strict --skip-git --package-manager npm
```

初始化后清理：删除 `server/.git`（如有）、调整目录结构。

### Step 2：安装核心依赖

在 `server/` 目录下安装以下依赖（版本经调研确认兼容 Node.js 24）：

**生产依赖：**
- `@nestjs/common@11.1.24`, `@nestjs/core@11.1.24`, `@nestjs/platform-express@11.1.24`
- `@nestjs/typeorm@11.0.1`, `typeorm@0.3.22`, `pg@8.21.0`
- `ioredis@5.11.0`
- `@nestjs/config@4.0.4`
- `class-validator@0.15.1`, `class-transformer@0.5.1`
- `bcrypt@5.1.1`（如 Windows 编译失败则 fallback 到 `bcryptjs@3.0.2`）
- `@nestjs/jwt@11.0.2`, `@nestjs/passport@11.0.5`, `passport@0.7.0`, `passport-jwt@4.0.1`
- `@nestjs/schedule@6.1.3`, `@nestjs/bullmq@11.0.4`, `bullmq@5.77.4`
- `@nestjs/websockets@11.1.24`, `@nestjs/platform-socket.io@11.1.24`
- `@nestjs/swagger@11.4.2`
- `typescript@5.8.3`, `ts-node@10.9.2`, `rxjs@7.8.2`, `reflect-metadata@0.2.2`

**开发依赖：**
- `@nestjs/testing@11.1.24`
- `jest@30.1.2`, `ts-jest@29.4.11`, `@types/jest@30.0.0`
- `supertest@7.2.2`, `@types/supertest@6.0.3`
- `@types/node@22.15.0`, `@types/bcrypt@5.0.2`, `@types/jsonwebtoken@9.0.9`, `@types/passport-jwt@4.0.1`

### Step 3：创建配置文件

#### `server/tsconfig.json`
启用严格模式，配置路径别名：`@/*` → `src/*`，`@config/*` → `src/config/*`，`@common/*` → `src/common/*`，`@modules/*` → `src/modules/*`。

#### `server/src/config/database.config.ts`
使用 `registerAs` 注册数据库配置，支持环境变量：
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`
- `DB_SSL`, `DB_POOL_SIZE`
- `synchronize: process.env.NODE_ENV !== 'production'`
- `entities: [__dirname + '/../modules/**/*.entity{.ts,.js}']`
- 导出 `connectionSource` DataSource 供 TypeORM CLI 使用

#### `server/src/config/redis.config.ts`
使用 `registerAs` 注册 Redis 配置，支持环境变量：
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_KEY_PREFIX`
- 配置 `retryStrategy`, `maxRetriesPerRequest`, `enableReadyCheck`

#### `server/.env.example`
提供所有环境变量的模板文件（不提交敏感值）。

### Step 4：创建应用入口和根模块

#### `server/src/main.ts`
- 创建 NestJS 应用实例
- 启用全局 ValidationPipe（whitelist + transform）
- 配置 Swagger 文档（`/api/docs`）
- 监听端口从 `ConfigService` 读取（默认 3000）
- 启动日志输出

#### `server/src/app.module.ts`
- 导入 `ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig, redisConfig] })`
- 导入 `TypeOrmModule.forRootAsync`（使用 ConfigService 注入数据库配置）
- 导入 `CommonModule`（提供 RedisService）
- 预留业务模块导入位置

### Step 5：创建 Redis 服务

#### `server/src/common/services/redis.service.ts`
- 实现 `OnModuleInit` + `OnModuleDestroy`
- 使用 ioredis 创建 client + subscriber 实例
- 提供 `get`, `set`, `del`, `ping`, `getClient` 方法
- 连接/错误事件日志

#### `server/src/common/common.module.ts`
- `@Global()` 模块
- 提供并导出 `RedisService`

### Step 6：配置 Jest 测试环境

#### `server/jest.config.js`（或 package.json 中配置）
- `testRegex: '.*\\.spec\\.ts$'`
- `transform: { '^.+\\.(t|j)s$': 'ts-jest' }`
- `collectCoverageFrom` 排除 module/config/migrations/seeds
- `coverageThreshold`: branches/functions/lines/statements 均 >= 80%
- `moduleNameMapping` 配置路径别名
- `testEnvironment: 'node'`

#### `server/test/jest-e2e.json`
- `testRegex: '.e2e-spec.ts$'`
- 同样配置路径别名

#### `server/test/setup.ts`
- 提供全局测试前置/后置逻辑（可选）

### Step 7：编写 TDD 测试

#### `server/src/app.module.spec.ts`（或 `server/test/app.e2e-spec.ts`）
先写测试，验证：
1. AppModule 能正确编译
2. 应用能启动并监听端口
3. 健康检查接口 `/health` 返回 200

#### `server/src/common/services/redis.service.spec.ts`
先写测试，验证：
1. RedisService 能正确实例化
2. `ping()` 方法返回 `'PONG'`（需 Redis 服务运行）

#### `server/src/config/database.config.spec.ts`
先写测试，验证：
1. 配置对象包含正确的默认值
2. 环境变量能正确覆盖默认值

### Step 8：创建健康检查接口

#### `server/src/common/controllers/health.controller.ts`
- `GET /health` 返回 `{ status: 'ok', timestamp: string }`
- 用于验证应用启动成功

### Step 9：验证与提交

执行验证命令序列：
```bash
cd server
npm install
npm run build
npm run test
npm run test:cov
npm run start:dev
```

所有测试通过后，创建 commit：
```bash
git add server/
git commit -m "module(0.2): backend NestJS init - TypeORM, Redis, Jest configured, tests passing"
```

## 需要创建的文件清单

| 文件路径 | 说明 |
|---------|------|
| `server/package.json` | 依赖定义与 scripts |
| `server/tsconfig.json` | TypeScript 严格模式 + 路径别名 |
| `server/jest.config.js` | Jest 单元测试配置（覆盖率阈值 80%） |
| `server/test/jest-e2e.json` | E2E 测试配置 |
| `server/test/setup.ts` | 测试全局 setup（可选） |
| `server/.env.example` | 环境变量模板 |
| `server/src/main.ts` | NestJS 应用入口 |
| `server/src/app.module.ts` | 根模块（ConfigModule + TypeOrmModule + CommonModule） |
| `server/src/config/database.config.ts` | PostgreSQL 连接配置 |
| `server/src/config/redis.config.ts` | Redis 连接配置 |
| `server/src/common/common.module.ts` | 全局公共模块 |
| `server/src/common/services/redis.service.ts` | Redis 客户端封装 |
| `server/src/common/services/redis.service.spec.ts` | RedisService TDD 测试 |
| `server/src/common/controllers/health.controller.ts` | 健康检查接口 |
| `server/src/app.controller.ts` | 根控制器（示例/健康检查） |
| `server/src/app.controller.spec.ts` | AppController TDD 测试 |
| `server/test/app.e2e-spec.ts` | E2E 测试（应用启动 + 健康检查） |

## 验证步骤

1. **`npm install` 验证**：无安装错误，无 peer dependency 警告
2. **`npm run build` 验证**：`dist/` 目录生成，无 TypeScript 编译错误
3. **`npm run test` 验证**：Jest 运行通过，至少 3 个测试通过（AppController、RedisService、DatabaseConfig）
4. **`npm run test:cov` 验证**：覆盖率报告生成，所有阈值 >= 80%
5. **`npm run start:dev` 验证**：NestJS 服务启动，端口 3000 监听成功，日志输出正常
6. **数据库连接验证**：TypeORM 连接成功日志（`synchronize: true` 时自动建表）
7. **Redis 连接验证**：RedisService `ping()` 返回 `PONG`（需本地 Redis 或 Docker 运行）
8. **健康检查验证**：`curl http://localhost:3000/health` 返回 `{ status: 'ok' }`
9. **Swagger 验证**：`http://localhost:3000/api/docs` 可访问
10. **Git 验证**：`git log --oneline` 显示 Module 0.2 的 commit

## 关键路径

- `server/src/main.ts` — 应用入口
- `server/src/app.module.ts` — 根模块注册
- `server/src/config/database.config.ts` — 数据库连接
- `server/src/config/redis.config.ts` — Redis 连接
- `server/src/common/services/redis.service.ts` — Redis 封装

## 风险与应对

| 风险 | 应对策略 |
|------|----------|
| bcrypt 在 Windows 上编译失败 | fallback 到 `bcryptjs`（纯 JS，无需编译） |
| 本地无 PostgreSQL/Redis | 提供 Docker Compose 单文件（可提前到本模块或留到 Module 6.1） |
| NestJS CLI 初始化后目录结构不符预期 | 初始化后手动调整，确保符合 blueprint 的 `server/` 结构 |
| Node.js 24 与某些包不兼容 | 使用调研确认的版本矩阵，Jest 必须 >= 30.x |

## 依赖与前置条件

- Module 0.1 已完成（Git 仓库已初始化）
- Node.js >= 20（当前 v24.14.0，满足）
- 建议本地安装 PostgreSQL 和 Redis，或使用 Docker
