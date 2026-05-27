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

## 快速启动

### 环境要求

- Node.js >= 20
- PostgreSQL >= 15
- Redis >= 7

### 1. 后端启动

```bash
cd server
cp .env.example .env
# 编辑 .env 配置数据库和 Redis 连接信息
npm install
npm run start:dev
```

- API 地址：`http://localhost:3000/api/v1`
- Swagger 文档：`http://localhost:3000/api/docs`

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
npm run typeorm      # TypeORM CLI
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
