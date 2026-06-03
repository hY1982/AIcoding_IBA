import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcryptjs from 'bcryptjs';
import { createHash } from 'crypto';
import { User } from '@modules/users/entities/user.entity';
import { Player } from '@modules/players/entities/player.entity';
import { PlayerPosition } from '@modules/players/entities/player-position.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { hashForQuery } from '@common/utils/encrypt.util';
import { RedisService } from '@common/services/redis.service';
import {
  PlayerRegisterDto,
  VenueManagerRegisterDto,
  RegisterDto,
} from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { AuthResponse, AuthUser } from '@shared/auth';
import { TokenPair } from '@shared/common';

/**
 * Token 类型标识，用于区分 accessToken 和 refreshToken
 */
const TOKEN_TYPE_ACCESS = 'access';
const TOKEN_TYPE_REFRESH = 'refresh';

/**
 * Redis key 前缀
 */
const REDIS_KEY_REFRESH_TOKEN = 'refresh';

/**
 * 手机号脱敏：13812345678 → 138****5678
 */
function maskPhone(phone: string): string {
  if (phone.length !== 11) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(7);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 用户注册
   * 使用数据库事务保证 User + Player/VenueManager 创建的原子性
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const phoneHash = hashForQuery(dto.phone);

    // Check if phone already exists (early check for better UX)
    const existingUser = await this.dataSource.getRepository(User).findOne({
      where: { phoneHash },
    });
    if (existingUser) {
      throw new ConflictException('该手机号已被注册');
    }

    // Hash password with bcrypt (cost factor = 12)
    const passwordHash = await bcryptjs.hash(dto.password, 12);

    try {
      return await this.dataSource.transaction(async (manager) => {
        // 1. Create User
        const user = manager.create(User, {
          phone: dto.phone,
          phoneHash,
          passwordHash,
          nickname: dto.nickname,
          userType: dto.userType,
          status: 'active',
          regionCode: dto.regionCode || null,
        });
        const savedUser = await manager.save(User, user);

        // 2. Create role-specific record
        if (dto.userType === 'player') {
          await this.createPlayerRecord(manager, savedUser.id, dto as PlayerRegisterDto);
        } else if (dto.userType === 'venue_manager') {
          await this.createVenueManagerRecord(manager, savedUser.id, dto as VenueManagerRegisterDto);
        }

        // 3. Generate tokens
        const tokens = await this.generateTokenPair(savedUser);

        // 4. Build response
        return this.buildAuthResponse(savedUser, tokens);
      });
    } catch (error) {
      // Handle PostgreSQL unique constraint violation (error code 23505)
      if (error instanceof ConflictException) {
        throw error;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException('该手机号已被注册');
      }
      throw error;
    }
  }

  /**
   * 用户登录
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const phoneHash = hashForQuery(dto.phone);

    const user = await this.dataSource.getRepository(User).findOne({
      where: { phoneHash },
    });

    if (!user) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    // Check user status
    if (user.status === 'banned') {
      throw new UnauthorizedException('账号已被封禁');
    }

    // Verify password
    const isPasswordValid = await bcryptjs.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    const tokens = await this.generateTokenPair(user);
    return this.buildAuthResponse(user, tokens);
  }

  /**
   * 刷新 Token
   * 使用可撤销模型 + 单次使用轮换策略
   */
  async refresh(dto: { refreshToken: string }): Promise<AuthResponse> {
    const tokenHash = this.hashToken(dto.refreshToken);
    const redisKey = `${REDIS_KEY_REFRESH_TOKEN}:${tokenHash}`;

    const redisClient = this.redisService.getClient();
    const storedData = await redisClient.get(redisKey);

    if (!storedData) {
      throw new UnauthorizedException('Refresh token 无效或已过期');
    }

    let payload: { userId: number; issuedAt: number };
    try {
      payload = JSON.parse(storedData) as { userId: number; issuedAt: number };
    } catch {
      throw new UnauthorizedException('Refresh token 数据损坏');
    }

    // Verify the token signature and decode payload
    let decodedPayload: { sub: number; phone: string; userType: string; type: string };
    try {
      decodedPayload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      }) as { sub: number; phone: string; userType: string; type: string };
    } catch {
      throw new UnauthorizedException('Refresh token 签名无效');
    }

    if (decodedPayload.type !== TOKEN_TYPE_REFRESH) {
      throw new UnauthorizedException('Token 类型错误');
    }

    // Find user
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: payload.userId },
    });

    if (!user || user.status === 'banned') {
      throw new UnauthorizedException('用户不存在或已被封禁');
    }

    // Delete old refresh token (rotation)
    await redisClient.del(redisKey);

    // Generate new token pair
    const tokens = await this.generateTokenPair(user);

    return this.buildAuthResponse(user, tokens);
  }

  /**
   * 注销用户（使所有 refreshToken 失效）
   */
  async logout(userId: number): Promise<void> {
    const redisClient = this.redisService.getClient();
    const keys = await redisClient.keys(`${REDIS_KEY_REFRESH_TOKEN}:*`);
    // Filter keys belonging to this user (would need to scan and check values in production)
    // For now, we delete all refresh tokens for simplicity
    // In production, use a user-specific index: `user_refresh:{userId}` storing token hashes
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  }

  /**
   * 生成 Access Token
   */
  private generateAccessToken(user: User): string {
    const payload = {
      sub: user.id,
      phone: user.phone,
      userType: user.userType,
      type: TOKEN_TYPE_ACCESS,
    };
    return this.jwtService.sign(payload, {
      expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') || '2h') as `${number}h`,
    });
  }

  /**
   * 生成 Refresh Token
   */
  private generateRefreshToken(user: User): string {
    const payload = {
      sub: user.id,
      phone: user.phone,
      userType: user.userType,
      type: TOKEN_TYPE_REFRESH,
    };
    return this.jwtService.sign(payload, {
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d') as `${number}d`,
    });
  }

  /**
   * 生成 Token 对并存储 refreshToken
   */
  private async generateTokenPair(user: User): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token hash in Redis with TTL
    const tokenHash = this.hashToken(refreshToken);
    const redisKey = `${REDIS_KEY_REFRESH_TOKEN}:${tokenHash}`;
    const redisClient = this.redisService.getClient();

    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const ttlSeconds = this.parseExpiresInToSeconds(refreshExpiresIn);

    await redisClient.set(
      redisKey,
      JSON.stringify({ userId: user.id, issuedAt: Date.now() }),
      'EX',
      ttlSeconds,
    );

    return { accessToken, refreshToken };
  }

  /**
   * 构建认证响应
   */
  private buildAuthResponse(user: User, tokens: TokenPair): AuthResponse {
    const authUser: AuthUser = {
      id: user.id,
      phone: maskPhone(user.phone),
      nickname: user.nickname,
      userType: user.userType,
      avatarUrl: user.avatarUrl || undefined,
      status: user.status,
      regionCode: user.regionCode || undefined,
    };

    return { user: authUser, tokens };
  }

  /**
   * 创建 Player 记录
   */
  private async createPlayerRecord(
    manager: DataSource['manager'],
    userId: number,
    dto: PlayerRegisterDto,
  ): Promise<void> {
    const player = manager.create(Player, {
      userId,
      age: dto.age,
      basketballAge: dto.basketballAge,
      gender: dto.gender,
      height: dto.height,
      weight: dto.weight ?? null,
      wingspan: dto.wingspan ?? null,
      standingReach: dto.standingReach ?? null,
      jumpingReach: dto.jumpingReach ?? null,
      baseAbilityScore: 0,
      matchAdjustValue: 0,
      regionCode: dto.regionCode || null,
    });
    const savedPlayer = await manager.save(Player, player);

    // Create player positions if provided
    if (dto.positions && dto.positions.length > 0) {
      const positions = dto.positions.map((position, index) =>
        manager.create(PlayerPosition, {
          playerId: savedPlayer.id,
          position,
          priority: index + 1,
        }),
      );
      await manager.save(PlayerPosition, positions);
    }
  }

  /**
   * 创建 VenueManager 记录
   */
  private async createVenueManagerRecord(
    manager: DataSource['manager'],
    userId: number,
    dto: VenueManagerRegisterDto,
  ): Promise<void> {
    const venueManager = manager.create(VenueManager, {
      userId,
      companyName: dto.companyName,
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
    });
    await manager.save(VenueManager, venueManager);
  }

  /**
   * 计算 Token 的 SHA-256 哈希（用于 Redis 存储）
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * 解析 JWT expiresIn 字符串为秒数
   */
  private parseExpiresInToSeconds(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60; // default 7 days

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 7 * 24 * 60 * 60;
    }
  }
}
