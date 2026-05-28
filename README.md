# Basketball Match Platform

篮球匹配平台 — 基于球员能力值自动匹配对手/队友的篮球比赛预约系统。

## 项目结构

```
basketball-match-platform/
├── apps/
│   ├── mobile/          # React Native (Expo) — 球员 + 场地方共用 App
│   └── admin/           # React + Vite + Ant Design — 管理后台
├── server/              # NestJS + TypeORM + PostgreSQL + Redis — 后端 API
├── shared/              # TypeScript 共享类型包（前后端共用）
└── docs/                # 项目文档
```

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 移动端 | React Native (Expo SDK 52) + TypeScript + Zustand |
| 管理后台 | React 18 + Vite 6 + Ant Design 5 + React Router v7 |
| 后端 | NestJS 11 + TypeScript + TypeORM + PostgreSQL + Redis |
| 共享类型 | TypeScript 纯类型包（types-only） |

> **技术栈锁定声明**：MVP 阶段技术栈不做变更。如需变更须经技术评审。

## 快速启动（推荐：Docker 全容器化）

> **重要提示**：自 Module 0.6 起，本项目采用全容器化开发环境。所有开发命令（启动、构建、测试、迁移）**必须通过**本项目提供的 Docker Compose 脚本或 `server/package.json` 中的 `dc:*` 命令执行。直接在宿主机运行 `npm start` 或 `npm test` 将因数据库/Redis 连接失败而无法工作。

### 环境要求

- Node.js >= 20
- Docker Desktop >= 4.x（或 Docker Engine + Compose Plugin）

### 1. 启动全部开发环境服务

```bash
# 启动 PostgreSQL + Redis + NestJS Backend
docker-compose -f docker-compose.dev.yml up -d

# 运行数据库迁移（在容器内执行）
./scripts/dev-migrate.sh

# 运行测试（在容器内执行）
./scripts/dev-test.sh
```

- API 地址：`http://localhost:3000/api/v1`
- Swagger 文档：`http://localhost:3000/api/docs`

### 容器内常用命令

#### 方式一：Shell 脚本（推荐 Git Bash / WSL / MSYS2）

| 脚本 | 功能 |
|------|------|
| `./scripts/init-db.sh` | 仅启动 PostgreSQL 和 Redis |
| `./scripts/dev-migrate.sh` | 在 backend 容器内运行迁移 |
| `./scripts/dev-test.sh` | 在 backend 容器内运行测试 |
| `./scripts/dev-test-cov.sh` | 在 backend 容器内运行测试+覆盖率 |
| `./scripts/dev-shell.sh` | 进入 backend 容器 shell |
| `./scripts/migrate-local-data.sh` | 将旧本地数据库数据迁移到 Docker（可选） |

#### 方式二：npm 脚本（跨平台，推荐 Windows PowerShell 用户）

在 `server/` 目录下执行：

```bash
cd server
npm run dc:up         # 启动 Docker Compose 服务
npm run dc:migrate    # 运行数据库迁移
npm run dc:test       # 运行单元测试
npm run dc:test:cov   # 运行测试+覆盖率
npm run dc:shell      # 进入 backend 容器 shell
npm run dc:down       # 停止所有服务
```

#### Windows 用户特别说明

`.sh` 脚本在 PowerShell/CMD 中无法直接执行。推荐以下方式：

- **推荐**：使用 **Git Bash**、**WSL 终端** 或 **MSYS2** 执行 `./scripts/xxx.sh`
- **推荐**：使用 `cd server && npm run dc:*` 命令，跨平台统一
- **替代**：在 PowerShell 中直接运行等效的 `docker-compose` 命令，例如：
  ```powershell
  docker-compose -f docker-compose.dev.yml run --rm backend npm test
  docker-compose -f docker-compose.dev.yml run --rm backend npm run migration:run
  ```

### 非容器化 Fallback（宿主机运行）

如需在宿主机直接运行后端（需自行安装 PostgreSQL >= 15 和 Redis >= 7）：

```bash
cd server
cp .env.example .env
# 编辑 .env 配置 localhost 数据库和 Redis 连接信息
npm install
npm run start:dev
```

### 2. 管理后台启动

```bash
cd apps/admin
cp .env.example .env
npm install
npm run dev
```

- 开发服务器：`http://localhost:5173`

### 3. 移动端启动

```bash
cd apps/mobile
cp .env.example .env
npm install
npx expo start
```

## 常用命令

### Server

```bash
cd server
npm run start:dev    # 开发模式（热重载）
npm run build        # 生产构建
npm run test         # 单元测试
npm run test:e2e     # E2E 测试
npm run test:cov     # 测试覆盖率
npm run lint         # ESLint 检查
npm run typeorm          # TypeORM CLI
npm run migration:run    # 运行迁移
npm run migration:revert # 回滚迁移
npm run migration:show   # 查看迁移状态
npm run dc:up            # 启动 Docker Compose 服务
npm run dc:migrate       # 容器内运行迁移
npm run dc:test          # 容器内运行测试
npm run dc:test:cov      # 容器内运行测试+覆盖率
npm run dc:shell         # 进入 backend 容器 shell
npm run dc:down          # 停止所有服务
```

### Admin

```bash
cd apps/admin
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run test         # 单元测试
npm run test:cov     # 测试覆盖率
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 检查
```

### Mobile

```bash
cd apps/mobile
npm run start        # Expo 开发服务器
npm run android      # Android 模拟器
npm run ios          # iOS 模拟器
npm run test         # 单元测试
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 检查
```

### Shared

```bash
cd shared
npm run typecheck    # TypeScript 类型检查
npx jest             # 结构验证测试
```

## 环境变量

各子项目均提供 `.env.example` 模板，复制为 `.env` 后按需配置：

- `server/.env` — 数据库、Redis、JWT 密钥
- `apps/admin/.env` — API 基址
- `apps/mobile/.env` — API 基址（`EXPO_PUBLIC_API_URL`）

## 开发规范

- **TDD**：先写测试再写代码，覆盖率目标 >= 80%
- **类型契约**：业务枚举使用 `const ARRAY = [...] as const` + `type X = typeof ARRAY[number]` 单一来源模式
- **共享类型**：`shared/types/` 定义前后端共用 DTO，通过 TypeScript path mapping (`@shared/*`) 消费
- **Git**：每个模块独立 commit，message 格式 `module(X.X): <模块名> - tests passing`

## 文档

- [完整技术方案](basketball-match-platform-blueprint.md)
- [分模块开发计划](basketball-match-platform-specs.md)
