# Module 0.6 — 开发环境 Docker Compose 配置（全容器化方案）

## Context

P0 阶段遗漏了 `Module 0.6 — 开发环境 Docker Compose 配置`。当前后端项目（`server/`）已具备完整的数据库实体、Migration 和 69 项测试，但所有开发者必须自行在本地安装 PostgreSQL 15 和 Redis 7，导致环境不一致风险。

**用户决策**：采用更彻底的全容器化方案。NestJS 后端服务也纳入 Docker Compose 管理，在容器内运行迁移、启动服务和执行测试。目标是在**不修改现有业务代码（Module 1.1）**的前提下，完成基础设施改造，并验证现有 69 项测试在全新容器化环境中全部通过。

## 当前状态

- `docker-compose.dev.yml`：**不存在**
- `server/Dockerfile.dev`：**不存在**
- `server/.env.development`：**不存在**
- `server/.env`：DB_HOST=localhost, DB_PORT=5432, DB_PASSWORD=postgres, REDIS_HOST=localhost, REDIS_PORT=6379
- 已有 Migration：`server/src/migrations/1779874031321-InitUserAndPlayerEntities.ts`
- `package.json` 中无 `migration:run` 便捷脚本，仅有 `typeorm` CLI
- 测试配置：`jest.config.js`（单元测试）、`test/jest-e2e.json`（E2E 测试）
- `app.module.ts` 中 `ConfigModule` 已支持 `.env.local` 和 `.env` 级联加载
- `data-source.ts` 使用 `getConnectionSource()` 导出 DataSource，可被 TypeORM CLI 使用

## 实现计划

### 步骤 1：创建 `server/Dockerfile.dev`（优化层缓存）

文件路径：`d:/AI_coding_projects/AIcoding_IBA/server/Dockerfile.dev`

内容要点（单阶段开发镜像，优化层缓存）：
- 基础镜像：`node:20-alpine`
- 工作目录：`/app`
- **层缓存优化**：先复制 `package.json` + `package-lock.json`，执行 `RUN npm ci`
- 再复制源码：`COPY . .`
- 暴露端口：`EXPOSE 3000`
- 默认命令：`CMD ["npm", "run", "start:dev"]`
- 开发特性：使用 `ts-node` 直接运行 TypeScript，支持热重载（通过 volume 挂载源码）
- `.dockerignore`：排除 `node_modules`, `dist`, `coverage`, `.env`

```dockerfile
FROM node:20-alpine
WORKDIR /app

# 1. 先复制依赖定义并安装 — 利用层缓存，package.json 不变时不重建
COPY package*.json ./
RUN npm ci

# 2. 再复制源代码 — 源码变更时复用已构建的依赖层
COPY . .

EXPOSE 3000
CMD ["npm", "run", "start:dev"]
```

**关键设计**：
- 使用 `node:20-alpine` 保持与当前 Node.js >= 20 要求一致
- 开发镜像不构建 `dist`，直接通过 `ts-node` / `nest start --watch` 运行，配合 compose volume 挂载实现热重载
- 健康检查：使用 TCP 端口检查（`wget -qO- http://localhost:3000/`）或检查 NestJS 启动日志关键字 `Nest application successfully started`。当前项目无 `/health` 端点，不强制新增业务代码

### 步骤 2：重构 `docker-compose.dev.yml`（最小权限网络模型）

文件路径：`d:/AI_coding_projects/AIcoding_IBA/docker-compose.dev.yml`

内容要点（全容器化三服务，数据库不暴露宿主机端口）：
- **postgres** 服务
  - 镜像：`postgres:15-alpine`
  - **端口映射：无**（不暴露到宿主机，完全隐藏在 Docker 网络内）
  - 环境变量：POSTGRES_USER=postgres, POSTGRES_PASSWORD=postgres, POSTGRES_DB=basketball_platform
  - 数据卷：`postgres_data` → `/var/lib/postgresql/data`
  - 健康检查：`pg_isready -U postgres`
- **redis** 服务
  - 镜像：`redis:7-alpine`
  - **端口映射：无**（不暴露到宿主机）
  - 数据卷：`redis_data` → `/data`
  - 健康检查：`redis-cli ping`
- **backend** 服务
  - 构建上下文：`./server`
  - Dockerfile：`Dockerfile.dev`
  - 端口映射：`3000:3000`（仅 API 端口暴露给宿主机）
  - 环境变量：从 `server/.env.development` 加载（通过 `env_file` 或 compose `environment`）
  - 数据库连接：`DB_HOST=postgres`, `REDIS_HOST=redis`（容器内通过服务名解析）
  - 卷挂载：`./server:/app`（源码热重载），`/app/node_modules`（匿名卷保护容器内依赖）
  - 依赖：`depends_on` postgres 和 redis 的健康检查通过后才启动
  - 命令覆盖：默认 `npm run start:dev`，但可被 compose run 覆盖用于执行迁移/测试

**网络模型设计**：
- 使用默认 compose bridge 网络，服务名即主机名
- postgres 和 redis 不映射宿主机端口，彻底避免与本地 PostgreSQL/Redis 的端口冲突
- 所有服务间通信通过服务名（`postgres`、`redis`）进行，强化微服务架构习惯
- 如需外部数据库客户端访问，可通过 `docker-compose exec postgres psql ...` 或临时添加 `adminer` 服务

**可选：数据库管理容器（adminer）**
如需图形化访问数据库，可在 compose 中注释保留一个 adminer 服务：
```yaml
  adminer:
    image: adminer
    ports:
      - "8080:8080"
    depends_on:
      - postgres
```
启用后访问 `http://localhost:8080`，服务器填 `postgres`。

### 步骤 3：创建 `server/.env.development`

文件路径：`d:/AI_coding_projects/AIcoding_IBA/server/.env.development`

内容要点（容器内网络）：
- `DB_HOST=postgres`
- `DB_PORT=5432`
- `DB_USERNAME=postgres`
- `DB_PASSWORD=postgres`
- `DB_NAME=basketball_platform`
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`
- `REDIS_PASSWORD=`（空）
- `REDIS_DB=0`
- `REDIS_KEY_PREFIX=basketball:`
- `JWT_SECRET=dev-jwt-secret-change-in-production`
- `JWT_EXPIRES_IN=1h`
- `JWT_REFRESH_EXPIRES_IN=7d`
- `ENCRYPTION_KEY=FWfut1ufS43+JBcgav4Cpn018X9QVdnq9ZJvqadwQUk=`
- `PHONE_HASH_SECRET=demo-secret-1779876831`
- `DB_SSL=false`
- `DB_POOL_SIZE=10`
- `NODE_ENV=development`
- `PORT=3000`

**说明**：此配置专用于容器内后端服务。`DB_HOST=postgres` 和 `REDIS_HOST=redis` 在 compose 网络内通过 DNS 解析。

### 步骤 4：创建容器内运行脚本（含 Windows 兼容说明）

文件路径：`d:/AI_coding_projects/AIcoding_IBA/scripts/dev-migrate.sh`
- 功能：在 backend 容器内运行 TypeORM 迁移
- 内容：`docker-compose -f docker-compose.dev.yml run --rm backend npm run migration:run`

文件路径：`d:/AI_coding_projects/AIcoding_IBA/scripts/dev-test.sh`
- 功能：在 backend 容器内运行 Jest 测试
- 内容：`docker-compose -f docker-compose.dev.yml run --rm backend npm test`

文件路径：`d:/AI_coding_projects/AIcoding_IBA/scripts/dev-test-cov.sh`
- 功能：在 backend 容器内运行测试并生成覆盖率报告
- 内容：`docker-compose -f docker-compose.dev.yml run --rm backend npm run test:cov`

文件路径：`d:/AI_coding_projects/AIcoding_IBA/scripts/dev-shell.sh`
- 功能：进入 backend 容器 shell
- 内容：`docker-compose -f docker-compose.dev.yml exec backend sh`

文件路径：`d:/AI_coding_projects/AIcoding_IBA/scripts/init-db.sh`（更新）
- 功能：启动 compose 服务并等待数据库就绪
- 内容：
  1. `docker-compose -f docker-compose.dev.yml up -d postgres redis`
  2. 等待 postgres 健康检查通过
  3. 输出 "Database is ready"

文件路径：`d:/AI_coding_projects/AIcoding_IBA/scripts/migrate-local-data.sh`
- 功能：将旧本地数据库（localhost:5432）中的数据导出并导入到新的 Docker 容器数据库
- 内容：
  1. 导出旧数据库：`PGPASSWORD=postgres pg_dump -h localhost -p 5432 -U postgres -d basketball_platform -f /tmp/basketball_platform_backup.sql`
  2. 复制到容器：`docker cp /tmp/basketball_platform_backup.sql docker-compose-postgres-1:/tmp/backup.sql`
  3. 导入新数据库：`docker-compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d basketball_platform -f /tmp/backup.sql`
  4. 输出 "Data migration completed"
- **说明**：此脚本为可选步骤，用于保留旧本地数据库中的测试数据（如 Module 1.1 演示中创建的 "KobeFan" 等）。若旧数据库无重要数据，可跳过。

**Windows 执行说明**：
- `.sh` 脚本在 Windows PowerShell/CMD 中无法直接执行
- 推荐方式：使用 **Git Bash**、**WSL 终端** 或 **MSYS2** 执行 `./scripts/xxx.sh`
- 替代方式：在 PowerShell 中直接运行脚本内的等效 `docker-compose` 命令
- README.md 中将补充详细的 Windows 执行指南

### 步骤 5：添加 `migration:run` 等便捷脚本到 `package.json`

文件路径：`d:/AI_coding_projects/AIcoding_IBA/server/package.json`

在 `scripts` 中新增：
- `"migration:run": "typeorm-ts-node-commonjs migration:run -d src/data-source.ts"`
- `"migration:revert": "typeorm-ts-node-commonjs migration:revert -d src/data-source.ts"`
- `"migration:show": "typeorm-ts-node-commonjs migration:show -d src/data-source.ts"`
- `"migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/data-source.ts"`（预留）

### 步骤 6：创建 `server/.dockerignore`

文件路径：`d:/AI_coding_projects/AIcoding_IBA/server/.dockerignore`

内容：
```
node_modules
dist
coverage
.env
.env.local
.env.development
*.log
.git
```

### 步骤 7：验证流程（TDD 原则 — 先定义验证步骤，再执行）

**验证 A：Docker Compose 构建与启动**
1. 执行 `docker-compose -f docker-compose.dev.yml build backend`
2. 断言：backend 镜像构建成功，无 npm install 错误
3. 执行 `docker-compose -f docker-compose.dev.yml up -d`
4. 执行 `docker-compose -f docker-compose.dev.yml ps`
5. 断言：`postgres`、`redis`、`backend` 三个服务状态均为 `Up (healthy)`
6. 执行 `docker-compose -f docker-compose.dev.yml exec postgres pg_isready -U postgres`
7. 断言：返回 `accepting connections`
8. 执行 `docker-compose -f docker-compose.dev.yml exec redis redis-cli ping`
9. 断言：返回 `PONG`
10. 执行 `docker-compose -f docker-compose.dev.yml logs backend | grep "Nest application successfully started"`
11. 断言：日志中包含 `Nest application successfully started`（当前项目无独立 `/health` 端点，不新增业务代码，通过日志关键字验证）

**验证 B：容器内 Migration 执行**
1. 执行 `./scripts/dev-migrate.sh`（或 `docker-compose run --rm backend npm run migration:run`）
2. 断言：Migration `InitUserAndPlayerEntities1779874031321` 执行成功
3. 执行 `docker-compose exec postgres psql -U postgres -d basketball_platform -c "\dt"`
4. 断言：显示 `users`, `venue_managers`, `players`, `player_positions`, `migrations` 表

**验证 C：容器内运行现有 69 项测试**
1. 执行 `./scripts/dev-test.sh`（或 `docker-compose run --rm backend npm test`）
2. 断言：所有 69 项测试通过
3. 执行 `./scripts/dev-test-cov.sh`
4. 断言：覆盖率 >= 80%（branches/functions/lines/statements）
5. **质量目标**：期望保持现有 92%+ 覆盖率水平，作为非阻塞性质量基准

**验证 D：数据持久化测试**
1. 执行 `docker-compose -f docker-compose.dev.yml down`
2. 执行 `docker-compose -f docker-compose.dev.yml up -d postgres redis`
3. 执行 `docker-compose exec postgres psql -U postgres -d basketball_platform -c "SELECT COUNT(*) FROM migrations;"`
4. 断言：返回 `1`（migration 记录仍在，因命名卷持久化）

**验证 E：源码热重载测试**
1. 修改 `server/src/app.controller.ts` 中的返回字符串
2. 观察 backend 容器日志
3. 断言：NestJS 自动重启，API 返回新值

### 步骤 8：更新 `README.md`

文件路径：`d:/AI_coding_projects/AIcoding_IBA/README.md`

更新内容：
- 环境要求：删除 "PostgreSQL >= 15, Redis >= 7"，改为 "Docker Desktop >= 4.x（或 Docker Engine + Compose Plugin）"
- 后端启动步骤重构为：
  ```bash
  # 1. 启动全部开发环境服务（PostgreSQL + Redis + NestJS Backend）
  docker-compose -f docker-compose.dev.yml up -d

  # 2. 运行数据库迁移（在容器内执行）
  ./scripts/dev-migrate.sh

  # 3. 运行测试（在容器内执行）
  ./scripts/dev-test.sh
  ```
- 新增 "容器内常用命令" 小节，说明各脚本用途
- 保留非容器化 fallback 说明（如需在宿主机运行，复制 `.env.example` 为 `.env` 并自行安装 PostgreSQL/Redis）
- 新增 "Windows 用户特别说明" 小节：
  - `.sh` 脚本在 PowerShell/CMD 中无法直接执行
  - 推荐：使用 **Git Bash**、**WSL 终端** 或 **MSYS2** 执行 `./scripts/xxx.sh`
  - 替代：在 PowerShell 中直接运行等效的 `docker-compose -f docker-compose.dev.yml run --rm backend npm test` 等命令
  - 所有脚本均提供 "Git Bash 方式" 和 "PowerShell 等效命令" 两种写法

## 关键文件清单

| 文件路径 | 操作 | 说明 |
|---------|------|------|
| `server/Dockerfile.dev` | 新建 | NestJS 后端开发镜像 |
| `server/.dockerignore` | 新建 | Docker 构建排除文件 |
| `docker-compose.dev.yml` | 新建 | 全容器化 compose（postgres + redis + backend） |
| `server/.env.development` | 新建 | 容器内后端环境变量 |
| `scripts/init-db.sh` | 新建 | 启动数据库并等待就绪 |
| `scripts/dev-migrate.sh` | 新建 | 容器内运行迁移 |
| `scripts/dev-test.sh` | 新建 | 容器内运行测试 |
| `scripts/dev-test-cov.sh` | 新建 | 容器内运行测试+覆盖率 |
| `scripts/dev-shell.sh` | 新建 | 进入 backend 容器 shell |
| `server/package.json` | 编辑 | 新增 `migration:run` 等脚本 |
| `README.md` | 编辑 | 更新为全容器化启动文档，含 Windows 执行指南 |
| `scripts/migrate-local-data.sh` | 新建 | 旧本地数据库数据迁移到 Docker 容器（可选） |

## 风险与应对

| 风险 | 应对 |
|------|------|
| Windows 上 Docker 端口占用（3000） | 仅 backend:3000 暴露宿主机；postgres/redis 无端口映射，彻底避免 5432/6379 冲突。若 3000 被占用可调整 compose 端口映射 |
| 容器内 `ts-node` / `typeorm-ts-node-commonjs` 运行慢 | 使用 `node:20-alpine` + 预装 `ts-node`；开发场景可接受；生产用多阶段构建 |
| Volume 挂载导致 `node_modules` 被宿主机空目录覆盖 | compose 中声明 `/app/node_modules` 匿名卷，保护容器内安装的依赖 |
| 后端容器启动时数据库尚未就绪 | `depends_on` + `condition: service_healthy` 确保 postgres/redis 健康后才启动 backend |
| 现有 `.env` 被覆盖 | 新建 `.env.development`，不覆盖 `.env`；宿主机开发仍可用 `.env` + localhost |
| Migration 在全新数据库上执行失败 | 验证步骤 B 确保 Migration 完整执行；失败则排查实体与 Migration 一致性 |
| 69 项测试在容器内失败 | 检查数据库连接配置、Redis 连接、加密密钥等环境变量是否与宿主机一致 |

## 验证标准

1. `docker-compose -f docker-compose.dev.yml build backend` 构建成功
2. `docker-compose -f docker-compose.dev.yml up -d` 启动 `postgres`、`redis`、`backend` 三个服务且均健康
3. `./scripts/dev-migrate.sh` 成功执行已有 Migration
4. `./scripts/dev-test.sh` 全部 69 项测试通过
5. `./scripts/dev-test-cov.sh` 覆盖率 >= 80%
6. `docker-compose down && docker-compose up -d postgres redis` 后数据库数据不丢失
7. 源码修改后 backend 容器自动热重载
8. README.md 已更新，新开发者可按文档一键启动完整环境
