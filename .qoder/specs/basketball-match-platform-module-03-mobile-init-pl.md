# Module 0.3 — 移动端基础依赖与项目初始化 实施计划

## Context

Module 0.1（Git 初始化）和 Module 0.2（后端 NestJS 初始化）已完成。根据 `basketball-match-platform-specs.md`，Module 0.3 是 Phase 0 基础设施的第三步，目标是在 `apps/mobile/` 目录下初始化 React Native (Expo) 移动端项目，配置 TypeScript、Zustand 状态管理、React Navigation 和 Axios，确保项目能编译运行。

## 目标

1. 初始化 Expo + React Native 项目结构（`apps/mobile/` 目录）
2. 配置 TypeScript 严格模式 + 绝对路径别名（`@/*` → `src/*`）
3. 配置 Axios API 客户端基础封装（支持多环境动态 baseURL）
4. 配置 Zustand 基础状态管理 store（含单元测试）
5. 配置 ESLint + Prettier 代码质量工具
6. 在 App.tsx 中搭建最简 NavigationContainer 导航框架
7. 确保 `npm install`、`npx tsc --noEmit`、`npm run lint`、`npm run test` 全部通过
8. 遵循 TDD 原则：先写测试（项目结构测试 + 单元测试），再创建文件，最后验证

## 当前状态

- 工作目录：`d:/AI_coding_projects/AIcoding_IBA`
- `apps/mobile/` 目录已创建，但仅包含 `__tests__/` 和 `src/` 空目录
- `__tests__/project-structure.spec.ts` 测试文件已编写（TDD 第一步完成）
- 项目文件（package.json、tsconfig.json、App.tsx 等）尚未创建

## 实现计划

### Step 1：运行测试确认当前失败（红阶段）

测试文件 `apps/mobile/__tests__/project-structure.spec.ts` 已存在，运行确认所有测试因文件缺失而失败。

### Step 2：创建 package.json 并安装依赖

创建 `apps/mobile/package.json`，包含以下依赖：

**生产依赖：**
- `expo@~52.0.0`
- `react-native@0.76.0`
- `react@18.3.1`
- `zustand@^5.0.0`
- `@react-navigation/native@^7.0.0`
- `@react-navigation/native-stack@^7.0.0`
- `react-native-screens@~4.0.0`
- `react-native-safe-area-context@~4.12.0`
- `axios@^1.7.0`

**开发依赖：**
- `typescript@^5.7.0`
- `@types/react@^18.3.0`
- `jest@^30.0.0`
- `@types/jest@^30.0.0`
- `ts-jest@^29.0.0`
- `eslint@^9.0.0`
- `eslint-config-prettier@^10.0.0`
- `eslint-plugin-prettier@^5.0.0`
- `prettier@^3.4.0`
- `@typescript-eslint/eslint-plugin@^8.0.0`
- `@typescript-eslint/parser@^8.0.0`

**Scripts：**
- `typecheck`: `tsc --noEmit`
- `test`: `jest`
- `lint`: `eslint "src/**/*.{ts,tsx}" --fix`
- `format`: `prettier --write "src/**/*.{ts,tsx}"

### Step 3：创建 tsconfig.json

- `extends`: `expo/tsconfig.base`
- `compilerOptions.strict`: `true`
- `compilerOptions.baseUrl`: `.`
- `compilerOptions.paths`: `{ "@/*": ["./src/*"] }`
- `include`: `["src/**/*", "App.tsx"]`

### Step 4：创建 app.json

- `expo.name`: `BasketballMatch`
- `expo.slug`: `basketball-match-mobile`
- `expo.version`: `1.0.0`
- `expo.orientation`: `portrait`

### Step 5：创建 App.tsx

- 导入 `NavigationContainer` 和 `createNativeStackNavigator`
- 创建占位屏幕 `HomeScreen`
- 导出默认函数组件 `App`，包裹 `NavigationContainer` 和 `Stack.Navigator`
- 确立导航模式，为后续业务开发提供入口框架

### Step 6：创建 src/api/client.ts

- 导入 `axios`
- 使用 `axios.create` 创建实例
- 动态配置 `baseURL`：优先读取 `process.env.EXPO_PUBLIC_API_URL`，fallback 到 `http://localhost:3000/api/v1`
- 添加请求/响应拦截器（注入 token、统一错误处理）
- 导出 `apiClient`

### Step 6b：创建 src/api/client.spec.ts（单元测试）

- 测试 `apiClient` 实例创建成功
- 测试 baseURL 配置正确
- 测试拦截器已注册

### Step 7：创建 src/stores/index.ts

- 从 `zustand` 导入 `create`
- 定义基础 store 接口（token、user、setToken、setUser、clearAuth）
- 导出 `useAppStore`

### Step 7b：创建 src/stores/index.spec.ts（单元测试）

- 测试 store 初始状态正确（token 为 null，user 为 null）
- 测试 `setToken` 更新 token
- 测试 `setUser` 更新 user
- 测试 `clearAuth` 重置状态

### Step 8：创建代码质量配置文件

- `.eslintrc.js`：配置 TypeScript ESLint 规则（含 Prettier 集成）
- `.prettierrc`：配置代码格式化规则

### Step 9：运行测试确认通过（绿阶段）

执行：
```bash
cd apps/mobile
npm install
npx jest __tests__/project-structure.spec.ts
npx jest src/api/client.spec.ts
npx jest src/stores/index.spec.ts
npx tsc --noEmit
npm run lint
```

### Step 10：Git 提交

```bash
git add apps/mobile/
git commit -m "module(0.3): mobile Expo init - React Native, TypeScript, Zustand, tests passing"
```

## 需要创建的文件清单

| 文件路径 | 说明 |
|---------|------|
| `apps/mobile/package.json` | 依赖定义与 scripts |
| `apps/mobile/tsconfig.json` | TypeScript 配置（继承 expo base + 路径别名） |
| `apps/mobile/.eslintrc.js` | ESLint 配置（TypeScript + Prettier） |
| `apps/mobile/.prettierrc` | Prettier 格式化配置 |
| `apps/mobile/app.json` | Expo 应用配置 |
| `apps/mobile/App.tsx` | 应用入口组件（含导航框架） |
| `apps/mobile/src/api/client.ts` | Axios 基础配置（多环境支持） |
| `apps/mobile/src/api/client.spec.ts` | API 客户端单元测试 |
| `apps/mobile/src/stores/index.ts` | Zustand 基础 store |
| `apps/mobile/src/stores/index.spec.ts` | Store 单元测试 |
| `apps/mobile/__tests__/project-structure.spec.ts` | 项目结构 TDD 测试（已存在） |

## 验证步骤

1. **项目结构测试**：`npx jest __tests__/project-structure.spec.ts` 全部通过
2. **API 客户端单元测试**：`npx jest src/api/client.spec.ts` 通过
3. **Store 单元测试**：`npx jest src/stores/index.spec.ts` 通过
4. **依赖安装**：`npm install` 成功，无 peer dependency 冲突
5. **类型检查**：`npx tsc --noEmit` 无 TypeScript 编译错误
6. **Lint 检查**：`npm run lint` 无 ESLint 错误
7. **Git 验证**：`git log --oneline` 显示 Module 0.3 的 commit

## 关键路径

- `apps/mobile/App.tsx` — 应用入口（含导航框架）
- `apps/mobile/tsconfig.json` — TypeScript 配置（含路径别名）
- `apps/mobile/package.json` — 依赖管理
- `apps/mobile/src/api/client.ts` — 多环境 API 客户端
- `apps/mobile/src/stores/index.ts` — Zustand 状态管理

## 风险与应对

| 风险 | 应对策略 |
|------|----------|
| Expo 版本与 React Native 版本不兼容 | 使用 Expo 52 官方推荐的 RN 0.76 版本矩阵 |
| React Navigation 依赖冲突 | 使用 v7 稳定版，配合 screens/safe-area-context |
| Windows 上 Jest 运行问题 | 使用 ts-jest + node 测试环境 |
| 环境变量在 Expo 中读取方式不同 | 使用 `process.env.EXPO_PUBLIC_*` 前缀，遵循 Expo 官方环境变量规范 |
| ESLint v9 flat config 兼容性问题 | 使用传统 `.eslintrc.js` 格式，确保与当前生态兼容 |
