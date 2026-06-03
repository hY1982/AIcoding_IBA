# Module 2.2 — 认证服务（AuthService + JWT Strategy）

## Context

Module 1.1（用户与认证实体）已完成，包含 User/VenueManager/Player/PlayerPosition 实体、AES 加密工具、bcryptjs 和 @nestjs/jwt 等依赖。shared/types/auth.ts 已定义完整 DTO 契约。本模块实现核心认证逻辑，为后续所有受保护接口提供身份验证基础。

## 关键决策

- **注册范围**：注册时同时创建 User + Player/VenueManager 记录
- **JWT 配置**：Payload 含 userId/phone/userType；accessToken 有效期 2h，refreshToken 有效期 7d
- **测试策略**：真实数据库集成测试（连接 basketball_platform_test）

## 交付文件

### DTO（class-validator 装饰器）
- `server/src/modules/auth/dto/register.dto.ts`
- `server/src/modules/auth/dto/login.dto.ts`
- `server/src/modules/auth/dto/refresh-token.dto.ts`

### Service & Tests
- `server/src/modules/auth/services/auth.service.ts`
- `server/src/modules/auth/services/auth.service.spec.ts`

### JWT Strategy & Guard
- `server/src/modules/auth/strategies/jwt.strategy.ts`
- `server/src/modules/auth/strategies/jwt.strategy.spec.ts`
- `server/src/modules/auth/guards/jwt-auth.guard.ts`
- `server/src/modules/auth/guards/jwt-auth.guard.spec.ts`

### Decorators
- `server/src/modules/auth/decorators/current-user.decorator.ts`
- `server/src/modules/auth/decorators/public.decorator.ts`

### Module
- `server/src/modules/auth/auth.module.ts`

### 更新现有文件
- `server/src/app.module.ts`（注册 AuthModule）

## 测试覆盖

### AuthService 测试（真实数据库）
1. 球员注册成功（创建 User + Player）
2. 场地方注册成功（创建 User + VenueManager）
3. 重复手机号注册拒绝（ConflictException）
4. 无效球员数据拒绝（BadRequestException）
5. 手机号加密存储验证（数据库中为密文）
6. 密码 bcrypt 哈希验证（非明文，含 salt）
7. 正确密码登录成功（返回 AuthResponse）
8. 手机号不存在登录拒绝（UnauthorizedException）
9. 密码错误登录拒绝（UnauthorizedException）
10. 响应中手机号脱敏（138****8888）
11. 有效 refreshToken 刷新成功（返回新 TokenPair）
12. 无效 refreshToken 刷新拒绝（UnauthorizedException）

### JwtStrategy 测试
1. 有效 payload 验证通过（返回 userId/phone/userType）
2. 不存在用户拒绝（UnauthorizedException）
3. 被禁用户拒绝（UnauthorizedException）

### JwtAuthGuard 测试
1. 有效 JWT 允许访问
2. 无 JWT 拒绝访问
3. @Public() 路由允许匿名访问
4. 无效 JWT 拒绝访问

## 验证步骤

1. `cd server && npm run build` — 无编译错误
2. `cd server && npm test -- auth.service.spec.ts` — 全部通过
3. `cd server && npm run test:cov -- --testPathPattern=auth` — 覆盖率 ≥ 80%
4. Git commit: `module(2.2): 认证服务 - tests passing`
