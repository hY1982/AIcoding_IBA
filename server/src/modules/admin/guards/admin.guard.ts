import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { hashForQuery } from '@common/utils/encrypt.util';

/**
 * 管理员权限 Guard
 *
 * 基于 JWT 认证后的用户信息，额外校验该用户是否在管理员白名单中。
 * 白名单通过环境变量 ADMIN_PHONES 配置，值为逗号分隔的手机号列表。
 * 校验时使用 HMAC-SHA256 hash 匹配（与 users.phone_hash 一致）。
 *
 * 内置超级管理员：userType === 'admin' 时直接放行，无需白名单校验。
 *
 * 使用方式：
 * @UseGuards(JwtAuthGuard, AdminGuard) 或 @UseGuards(AdminGuard)
 * （若全局已注册 JwtAuthGuard，则只需 @UseGuards(AdminGuard)）
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly adminPhoneHashes: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const adminPhones = this.configService.get<string>('ADMIN_PHONES') || '';
    this.adminPhoneHashes = new Set(
      adminPhones
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => hashForQuery(p)),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as
      | { userId: number; phone: string; userType: string }
      | undefined;

    if (!user) {
      throw new ForbiddenException('请先登录');
    }

    // 内置超级管理员直接放行
    if (user.userType === 'admin') {
      return true;
    }

    const phoneHash = hashForQuery(user.phone);
    if (!this.adminPhoneHashes.has(phoneHash)) {
      throw new ForbiddenException('无权访问：您不是管理员');
    }

    return true;
  }
}
