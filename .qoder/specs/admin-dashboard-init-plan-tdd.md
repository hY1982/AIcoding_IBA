# Module 0.4 — 管理后台基础依赖与项目初始化 实施计划

## Context

Module 0.1（Git 初始化）、Module 0.2（后端 NestJS 初始化）、Module 0.3（移动端 Expo 初始化）均已完成并通过审查。根据 `basketball-match-platform-specs.md` 的分模块开发计划，Module 0.4 是 Phase 0 基础设施的第四步，目标是在 `apps/admin/` 目录下初始化 React + Vite + Ant Design 管理后台项目，配置 TypeScript 严格模式、路径别名、基础路由框架，确保项目能编译、构建、启动。本模块为后续管理后台页面开发（Module 5.7）提供运行基础。

## 目标

1. 初始化 React + Vite + TypeScript 项目结构（`apps/admin/` 目录）
2. 配置 TypeScript 严格模式 + 绝对路径别名（`@/*` → `src/*`）
3. 配置 Ant Design 组件库（按需引入样式）+ axios + react-router-dom
4. 在 `App.tsx` 中搭建最简路由框架（BrowserRouter + 基础 Layout + 占位路由）
5. 创建 API 客户端 `src/api/client.ts`（多环境支持，参照移动端模式）
6. 配置 Jest + React Testing Library 测试环境（含 `@/` 路径别名映射）
7. 配置 ESLint + Prettier 代码质量工具
8. 遵循 TDD 原则：先写测试（项目结构测试 + 组件渲染测试），再创建文件，最后验证
9. 确保 `npm install`、`npm run build`、`npm run dev`、`npm run test`、`npm run lint` 全部通过

## 当前状态

- 工作目录：`d:/AI_coding_projects/AIcoding_IBA`
- Git 状态：`main` 分支，5 个 commits，工作树干净
- `apps/admin/` 目录：不存在（需新建）
- Node.js：v24.14.0，npm：11.9.0
- 已完成模块参考：
  - `apps/mobile/`：Expo + RN 项目，含 `__tests__/project-structure.spec.ts` TDD 测试模式
  - `server/`：NestJS 项目，含 Jest 配置、路径别名、严格 TypeScript

## 实现计划

### Step 1：创建 TDD 项目结构测试（红阶段）

创建 `apps/admin/__tests__/project-structure.spec.ts`，验证以下文件必须存在且内容正确：
- `package.json`：包含 react、vite、typescript、antd、axios、react-router-dom 依赖；scripts 含 dev/build/test/typecheck/lint
- `tsconfig.json`：strict 模式、路径别名 `@/*`
- `vite.config.ts`：React 插件、路径别名配置
- `jest.config.js`：moduleNameMapper 配置 `@/` 路径别名
- `.env.example`：包含 `VITE_API_BASE_URL` 模板
- `index.html`：指向 `src/main.tsx`
- `src/main.tsx`：React 18 `createRoot` 渲染 `App`
- `src/App.tsx`：使用 `BrowserRouter` + 基础 Layout + 占位路由
- `src/api/client.ts`：axios 实例，从 `import.meta.env.VITE_API_BASE_URL` 读取 baseURL

运行测试确认全部失败（红阶段）。

### Step 2：创建 package.json 并安装依赖

创建 `apps/admin/package.json`，包含以下依赖：

**生产依赖：**
- `react@^18.3.0`, `react-dom@^18.3.0`
- `react-router-dom@^7.0.0`
- `antd@^5.22.0`
- `axios@^1.7.0`

**开发依赖：**
- `vite@^6.0.0`, `@vitejs/plugin-react@^4.3.0`
- `typescript@^5.7.0`
- `@types/react@^18.3.0`, `@types/react-dom@^18.3.0`
- `jest@^30.0.0`, `@types/jest@^30.0.0`, `ts-jest@^29.0.0`
- `@testing-library/react@^16.0.0`, `@testing-library/jest-dom@^6.0.0`, `@testing-library/user-event@^14.0.0`
- `jest-environment-jsdom@^30.0.0`
- `eslint@^9.0.0`, `eslint-config-prettier@^10.0.0`, `eslint-plugin-prettier@^5.0.0`, `eslint-plugin-react-hooks@^5.0.0`, `@typescript-eslint/eslint-plugin@^8.0.0`, `@typescript-eslint/parser@^8.0.0`
- `prettier@^3.4.0`
- `globals@^17.0.0`

**Scripts：**
- `dev`: `vite`
- `build`: `tsc --noEmit && vite build`
- `preview`: `vite preview`
- `test`: `jest`
- `test:cov`: `jest --coverage`
- `typecheck`: `tsc --noEmit`
- `lint`: `eslint "src/**/*.{ts,tsx}" --fix`
- `format`: `prettier --write "src/**/*.{ts,tsx}"

### Step 3：创建 tsconfig.json

- `compilerOptions.strict`: `true`
- `compilerOptions.jsx`: `react-jsx`
- `compilerOptions.baseUrl`: `.`
- `compilerOptions.paths`: `{ "@/*": ["./src/*"] }`
- `compilerOptions.types`: 包含 `jest`, `@testing-library/jest-dom`
- `include`: `["src/**/*", "__tests__/**/*"]`

### Step 4：创建 vite.config.ts

- 导入 `@vitejs/plugin-react`
- 配置 `resolve.alias`: `{ '@': path.resolve(__dirname, './src') }`
- 导出默认配置

> 注：Ant Design 5.x 使用 CSS-in-JS，无需额外样式引入插件。Vite 生产构建时 antd 样式会自动按需加载。

### Step 5：创建 index.html 与 .env.example

**index.html：**
- 标准 Vite HTML 模板
- `<script type="module" src="/src/main.tsx"></script>`
- `<title>Basketball Match Admin</title>`

**.env.example：**
- `VITE_API_BASE_URL=http://localhost:3000/api/v1`
- 说明：Vite 环境变量必须以 `VITE_` 前缀暴露给客户端

### Step 6：创建 src/vite-env.d.ts

- `/// <reference types="vite/client" />`
- 扩展 `ImportMetaEnv` 接口，声明 `VITE_API_BASE_URL: string`

### Step 7：创建 src/main.tsx

- 导入 `react` 和 `react-dom/client`
- 使用 `React.StrictMode`
- `createRoot(document.getElementById('root')!).render(<App />)`

### Step 8：创建 src/App.tsx 与基础 Layout

**src/layouts/AdminLayout.tsx：**
- 使用 Ant Design `Layout` 组件搭建基础管理后台布局
- 包含 `Sider`（侧边栏，占位 Logo + 菜单）、`Header`（顶部栏）、`Content`（内容区）
- 使用 `Outlet` from `react-router-dom` 渲染子路由内容
- 预留 `theme` 配置入口（ConfigProvider token 定制品牌色）

**src/App.tsx：**
- 导入 `BrowserRouter`, `Routes`, `Route` from `react-router-dom`
- 导入 `ConfigProvider` from `antd`
- 导入 `AdminLayout`
- 创建占位页面 `DashboardPage`（显示 "Admin Dashboard"）
- 导出 `App` 组件，包裹 `BrowserRouter` 和 `ConfigProvider`
- 配置基础路由 `/` → `AdminLayout` → `DashboardPage`

### Step 9：创建 Jest 配置与 ESLint/Prettier 配置

**jest.config.js：**
- `testEnvironment: 'jsdom'`
- `transform: { '^.+\\.(t|j)sx?$': 'ts-jest' }`
- `moduleNameMapper`: `{ '^@/(.*)$': '<rootDir>/src/$1' }`
- `setupFilesAfterInject`: `['<rootDir>/__tests__/setup.ts']`
- `collectCoverageFrom`: `['src/**/*.{ts,tsx}', '!src/**/*.d.ts']`
- `coverageThreshold`: branches/functions/lines/statements 均 >= 80%

**__tests__/setup.ts：**
- 导入 `@testing-library/jest-dom`

**.eslintrc.js：**
- `extends`: `['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended', 'prettier']`
- `parser`: `@typescript-eslint/parser`
- `plugins`: `['@typescript-eslint', 'prettier']`

**.prettierrc：**
- `semi: true`, `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100`

### Step 10：创建 API 客户端

**src/api/client.ts：**
- 导入 `axios`
- 使用 `axios.create` 创建实例
- `baseURL` 从 `import.meta.env.VITE_API_BASE_URL` 读取，fallback 到 `http://localhost:3000/api/v1`
- 添加请求拦截器注入 token（从 localStorage 读取）
- 导出 `apiClient`

**src/api/client.spec.ts：**
- 测试 axios 实例创建成功
- 测试 baseURL 配置正确
- 测试拦截器已注册

### Step 11：运行测试确认通过（绿阶段）

执行：
```bash
cd apps/admin
npm install
npx jest __tests__/project-structure.spec.ts
npx jest src/api/client.spec.ts
npx jest src/layouts/AdminLayout.spec.ts
npx tsc --noEmit
npm run lint
npm run build
```

### Step 12：Git 提交

```bash
git add apps/admin/
git commit -m "module(0.4): admin dashboard init - React, Vite, Ant Design, tests passing"
```

## 需要创建的文件清单

| 文件路径 | 说明 |
|---------|------|
| `apps/admin/package.json` | 依赖定义与 scripts |
| `apps/admin/tsconfig.json` | TypeScript 严格模式 + 路径别名 |
| `apps/admin/vite.config.ts` | Vite 配置（React 插件 + 路径别名） |
| `apps/admin/index.html` | HTML 入口 |
| `apps/admin/.env.example` | 环境变量模板 |
| `apps/admin/src/vite-env.d.ts` | Vite 环境类型声明 |
| `apps/admin/src/main.tsx` | React 应用入口（createRoot） |
| `apps/admin/src/App.tsx` | 基础路由框架（BrowserRouter + Routes） |
| `apps/admin/src/layouts/AdminLayout.tsx` | 管理后台基础布局（Sider + Header + Content） |
| `apps/admin/src/layouts/AdminLayout.spec.ts` | Layout 组件渲染测试 |
| `apps/admin/src/api/client.ts` | Axios 基础配置（多环境支持） |
| `apps/admin/src/api/client.spec.ts` | API 客户端单元测试 |
| `apps/admin/jest.config.js` | Jest 配置（jsdom 环境 + `@/` 路径别名映射） |
| `apps/admin/__tests__/setup.ts` | 测试全局 setup（jest-dom） |
| `apps/admin/__tests__/project-structure.spec.ts` | 项目结构 TDD 测试 |
| `apps/admin/.eslintrc.js` | ESLint 配置（TypeScript + React Hooks + Prettier） |
| `apps/admin/.prettierrc` | Prettier 格式化配置 |

## 验证步骤

1. **项目结构测试**：`npx jest __tests__/project-structure.spec.ts` 全部通过
2. **API 客户端单元测试**：`npx jest src/api/client.spec.ts` 通过
3. **Layout 组件渲染测试**：`npx jest src/layouts/AdminLayout.spec.ts` 通过（React Testing Library + jsdom）
4. **依赖安装**：`npm install` 成功，无 peer dependency 冲突
5. **类型检查**：`npx tsc --noEmit` 无 TypeScript 编译错误
6. **Lint 检查**：`npm run lint` 无 ESLint 错误
7. **构建验证**：`npm run build` 成功，`dist/` 目录生成
8. **开发服务器验证**：`npm run dev` 能正常启动（端口 5173 默认）
9. **Git 验证**：`git log --oneline` 显示 Module 0.4 的 commit

## 关键路径

- `apps/admin/src/main.tsx` — React 应用入口
- `apps/admin/vite.config.ts` — Vite 构建配置
- `apps/admin/tsconfig.json` — TypeScript 配置（含路径别名）
- `apps/admin/src/App.tsx` — 基础路由框架
- `apps/admin/src/layouts/AdminLayout.tsx` — 管理后台布局骨架
- `apps/admin/src/api/client.ts` — 多环境 API 客户端
- `apps/admin/jest.config.js` — Jest 测试配置（含 `@/` 别名映射）

## 风险与应对

| 风险 | 应对策略 |
|------|----------|
| Vite 6 与 React 18 类型冲突 | 使用 `@vitejs/plugin-react@^4.3` 稳定版，配置 `jsx: react-jsx` |
| Ant Design 5 与 React 18 兼容 | 使用 antd 5.22+ 官方支持 React 18 |
| Jest 无法直接测试 Vite 项目 | 使用 ts-jest 独立运行测试，不依赖 Vite 构建 |
| 路径别名在 Jest 中不解析 | 在 jest.config.js 中配置 `moduleNameMapper`，映射 `@/` → `src/` |
| Windows 路径问题 | 使用 `path.resolve` 在 vite.config.ts 中配置 alias |
| React Testing Library 与 jsdom 版本冲突 | 使用 jest 30.x 配套的 `jest-environment-jsdom` |
| ESLint v9 flat config 兼容性问题 | 使用传统 `.eslintrc.js` 格式，确保与当前生态兼容 |

## 状态管理策略（文档记录）

> 管理后台前期采用 **React 内置状态 + Context** 进行全局状态管理。当前阶段（Module 0.4）无需引入额外状态库，原因：
> - 管理后台页面以 CRUD 表格为主，局部状态占主导
> - 全局状态需求简单（用户登录态、侧边栏折叠），Context 足以覆盖
> - 后续若出现复杂跨页面数据共享（如多标签页表单、全局筛选条件），再评估引入 Zustand 或 Redux Toolkit
>
> 此决策记录于本文档，避免后续开发中的随意技术选型。
