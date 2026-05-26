# Module 0.1 — Git 版本控制初始化 实施计划

## 上下文

根据 `basketball-match-platform-specs.md` 的分模块开发计划，Module 0.1 是整个项目的第一步基础设施任务。当前工作目录 `d:/AI_coding_projects/AIcoding_IBA` 尚未初始化 Git 仓库，需要建立版本控制基础。

## 目标

建立 Git 仓库，配置 `.gitignore`，创建初始 commit。

## 当前状态

- 工作目录：`d:/AI_coding_projects/AIcoding_IBA`
- Git 仓库状态：未初始化（`fatal: not a git repository`）
- 现有文件：`.qoder/` 目录、`docs/` 目录（空）
- 待纳入版本控制的文档：`basketball-match-platform-blueprint.md`、`basketball-match-platform-specs.md`

## 需要创建的文件

### 1. `.gitignore`

覆盖以下类别的忽略规则：

| 类别 | 忽略模式 | 说明 |
|------|----------|------|
| Node.js | `node_modules/`、`npm-debug.log*`、`yarn-error.log*`、`package-lock.json`、`yarn.lock` | 依赖目录和日志 |
| Expo / React Native | `.expo/`、`.expo-shared/`、`*.jks`、`*.p8`、`*.p12`、`*.key`、`*.mobileprovision`、`.metro-health-check*` | Expo 构建产物和密钥 |
| React / Vite | `dist/`、`build/`、`.vite/`、`*.local` | 构建输出 |
| IDE / Editor | `.idea/`、`.vscode/`、`*.swp`、`*.swo`*、`.DS_Store`、`Thumbs.db` | IDE 配置和临时文件 |
| 环境变量 | `.env`、`.env.local`、`.env.*.local`、`.env.development`、`.env.production` | 敏感配置 |
| 测试 / 日志 | `coverage/`、`*.log`、`logs/` | 测试报告和日志 |
| Docker | `.docker/data/` | Docker 数据卷 |
| 系统文件 | `*.tmp`、`*.temp` | 临时文件 |

### 2. Git 仓库初始化

- 执行 `git init`
- 配置初始分支名为 `main`
- 将现有文档（blueprint、specs）和 `.gitignore` 加入暂存区
- 创建初始 commit：`init: bootstrap basketball match platform repository`

## 验证步骤（TDD 原则）

按照 specs 要求，Module 0.1 的测试验证如下：

1. **`git status` 验证**：执行后无未跟踪的应忽略文件（如 `node_modules` 若存在则被忽略）
2. **`git log` 验证**：显示初始 commit，message 为 `init: bootstrap basketball match platform repository`
3. **`git branch` 验证**：当前分支为 `main`
4. **`.gitignore` 内容验证**：包含 Node.js、Expo、React、IDE、环境变量等关键忽略规则
5. **文件追踪验证**：blueprint 和 specs 文档已被纳入版本控制

## 执行命令序列

```bash
# 1. 初始化仓库
git init

# 2. 配置初始分支
git checkout -b main

# 3. 创建 .gitignore（通过 Write 工具写入文件内容）

# 4. 将文件加入暂存区
git add .gitignore basketball-match-platform-blueprint.md basketball-match-platform-specs.md

# 5. 创建初始 commit
git commit -m "init: bootstrap basketball match platform repository"

# 6. 验证
git status
git log --oneline
git branch
```

## 关键路径

- `d:/AI_coding_projects/AIcoding_IBA/.gitignore`
- `d:/AI_coding_projects/AIcoding_IBA/.git/`

## 风险与注意事项

- 不提交 `.qoder/` 目录（IDE 内部配置）
- 不提交任何 `.env` 文件
- 确保 `.gitignore` 在首次 add 前已创建，避免误将应忽略文件纳入版本控制
