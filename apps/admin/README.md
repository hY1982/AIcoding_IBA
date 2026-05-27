# Basketball Match Admin

篮球匹配平台管理后台，基于 React + Vite + Ant Design 构建。

## 技术栈

- React 18 + TypeScript
- Vite 6
- Ant Design 5
- React Router v7
- Axios
- Jest + React Testing Library

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 5173）
npm run dev

# 类型检查
npm run typecheck

# 运行测试
npm run test

# 运行测试（带覆盖率）
npm run test:cov

# 代码检查
npm run lint

# 构建生产包
npm run build
```

## 环境变量

复制 `.env.example` 为 `.env` 并配置：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 基址 | `http://localhost:3000/api/v1` |

## 项目结构

```
src/
  api/           # API 客户端
  components/    # 公共组件
  layouts/       # 布局组件
  pages/         # 页面组件
  router/        # 路由配置
```

## API 客户端使用

```typescript
import { apiClient } from '@/api/client';

// 自动携带 Bearer Token（从 localStorage 读取）
const response = await apiClient.get('/users');
```

## 测试指南

- 单元测试：`*.{spec,test}.{ts,tsx}`
- 组件测试：使用 React Testing Library + jsdom
- 覆盖率阈值：80%（branches/functions/lines/statements）
