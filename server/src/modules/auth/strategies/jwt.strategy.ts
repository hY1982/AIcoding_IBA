import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';

/**
 * JWT Payload 结构
 */
export interface JwtPayload {
  sub: number; // userId
  phone: string;
  userType: string;
  type: string; // 'access' | 'refresh'
}

/**
 * 验证后的用户信息（附加到 Request 对象）
 */
export interface AuthenticatedUser {
  userId: number;
  phone: string;
  userType: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || '',
    });
  }

  /**
   * 验证 JWT Payload
   *
   * 注意：此方法在 Passport 验证签名和过期时间后被调用。
   * 由于 JWT 是无状态的，已签发的 accessToken 在有效期内始终有效。
   * 为降低用户被封禁后仍能访问的风险，我们在此进行二次校验：
   * 1. 查询数据库确认用户存在
   * 2. 确认用户状态非 banned
   *
   * 这会导致每次请求都查询数据库，但这是确保安全的必要代价。
   * 未来可通过 Redis 缓存用户状态来优化性能。
   *
   * 对于需要准实时失效的场景（如用户被封禁后立即生效），
   * 可扩展为查询 Redis 中的 "用户失效时间戳" 黑名单。
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Only validate access tokens here
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token 类型错误');
    }

    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.status === 'banned') {
      throw new UnauthorizedException('账号已被封禁');
    }

    return {
      userId: payload.sub,
      phone: payload.phone,
      userType: payload.userType,
    };
  }
}
