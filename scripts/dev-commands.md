# 开发环境命令手册

## 0. 一次性设置：禁用本地 PostgreSQL 服务

> 本地安装的 PostgreSQL 15 会与 Docker 的 PostgreSQL 争抢 5432 端口，导致连接不一致。

```powershell
# 以管理员身份运行 PowerShell
Stop-Service -Name "postgresql-x64-15" -Force
Set-Service -Name "postgresql-x64-15" -StartupType Disabled
```

验证：
```powershell
Get-Service -Name "postgresql-x64-15"
# 状态应为 Stopped
```

---

## 1. 启动开发环境

```powershell
cd d:\AI_coding_projects\AIcoding_IBA

# 1a. 启动 Docker 容器（PostgreSQL + Redis + Backend）
docker-compose -f docker-compose.dev.yml up -d

# 1b. 等待容器就绪（约 10 秒）
Start-Sleep -Seconds 10

# 1c. 检查容器状态
docker-compose -f docker-compose.dev.yml ps

# 1d. 确认只有一个进程监听 5432（应为 Docker）
netstat -ano | findstr ":5432"
```

验证 5432 端口只有一个 PID，且该 PID 对应 `com.docker.backend`：
```powershell
Get-Process -Id (netstat -ano | findstr ":5432" | findstr "LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1) | Select-Object Id, ProcessName
```

---

## 2. 查看 Backend 日志

```powershell
# 查看 backend 容器日志（确认 DB 连接）
docker logs basketball-backend --tail 20

# 实时跟踪日志
docker logs basketball-backend -f
```

---

## 3. 运行 E2E 测试（在 Docker 容器中）

### 3a. 运行 humanDriven 场景（含真人交互）

```powershell
# 在 Docker backend 容器中运行 E2E bot 测试
docker exec -it basketball-backend sh -c "TS_NODE_TRANSPILE_ONLY=true npx ts-node -r tsconfig-paths/register scripts/e2e-bot-test.ts --scenario=humanDriven"
```

> - `-it` 参数确保终端交互可用（按 Enter 继续）
> - 测试脚本在容器内调用 `localhost:3000`（即容器自身的 backend）
> - Mobile App 仍需在本地启动（`cd apps/mobile && npx expo start --web`）

### 3b. 运行其他自动化场景

```powershell
# 列出可用场景
docker exec -it basketball-backend sh -c "TS_NODE_TRANSPILE_ONLY=true npx ts-node -r tsconfig-paths/register scripts/e2e-bot-test.ts --list"

# 运行指定场景（自动模式）
docker exec -it basketball-backend sh -c "TS_NODE_TRANSPILE_ONLY=true npx ts-node -r tsconfig-paths/register scripts/e2e-bot-test.ts --scenario=fullFlow --auto"
```

---

## 4. 运行测试（本地方式，备选）

> 如果容器内运行有问题，可改用本地方式，但需确保本地 PG 已停止。

```powershell
cd d:\AI_coding_projects\AIcoding_IBA\server

# 本地运行 E2E 测试（连接 Docker 的 localhost:5432）
npm run e2e:bot -- --scenario=humanDriven

# 本地启动 server（如果需要独立调试）
npm run start:dev
```

---

## 5. 环境重置（遇到问题时）

```powershell
cd d:\AI_coding_projects\AIcoding_IBA

# 5a. 停止所有本地 Node 进程
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# 5b. 重启 Docker 容器
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d

# 5c. 等待就绪
Start-Sleep -Seconds 10

# 5d. 验证
docker-compose -f docker-compose.dev.yml ps
docker logs basketball-backend --tail 15
netstat -ano | findstr ":5432"
```

---

## 6. 数据库操作

```powershell
# 进入 PostgreSQL 容器执行 SQL
docker exec -it basketball-postgres psql -U postgres -d basketball_platform

# 常用 SQL
# \dt                    -- 列出所有表
# SELECT COUNT(*) FROM users;
# SELECT COUNT(*) FROM intentions WHERE status = 'pending';
# TRUNCATE TABLE intentions CASCADE;
# \q                     -- 退出
```

---

## 常见问题排查

| 症状 | 原因 | 解决 |
|------|------|------|
| `netstat` 显示两个 PID 监听 5432 | 本地 PG 未停止 | `Stop-Service postgresql-x64-15` |
| 测试显示 `users=0` 但 API 成功 | 双 PG 实例 | 停止本地 PG，见上 |
| `connection refused` on 5432 | Docker 未启动 | `docker-compose up -d` |
| Bot 意向 ID 递增不归 1 | TRUNCATE 未生效（不同 DB） | 停止本地 PG + 重跑 |
