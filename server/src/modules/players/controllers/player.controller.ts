import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { PlayerService } from '../services/player.service';
import { ShootingService } from '../services/shooting.service';
import { UpdatePlayerDto } from '../dto/update-player.dto';
import { CreateShootingRecordDto } from '../dto/create-shooting-record.dto';
import { PlayerProfile, ShootingStats, PlayerPosition } from '@shared/player';
import { PlayerShootingRecord } from '../entities/player-shooting-record.entity';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';

/**
 * 扩展 Express Request 类型，包含认证后的用户信息
 */
interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

/**
 * 球员资料响应类型（用于 Swagger 文档）
 */
class PlayerProfileResponse implements PlayerProfile {
  id!: number;
  userId!: number;
  age!: number;
  basketballAge!: number;
  gender!: 'male' | 'female';
  height!: number;
  weight?: number;
  wingspan?: number;
  standingReach?: number;
  jumpingReach?: number;
  positions!: PlayerPosition[];
  regionCode?: string;
  baseAbilityScore!: number;
  matchAdjustValue!: number;
  totalAbilityScore!: number;
  phone!: string;
  nickname!: string;
  realName!: string;
  avatarUrl?: string;
  createdAt!: string;
  updatedAt!: string;
}

/**
 * 投篮统计响应类型（用于 Swagger 文档）
 */
class ShootingStatsResponse implements ShootingStats {
  recordType!: 'free_throw' | 'three_point';
  totalAttempted!: number;
  totalMade!: number;
  percentage!: number;
}

/**
 * 球员控制器
 *
 * 提供球员资料查询/更新、投篮记录录入/统计等接口。
 * 所有端点均需 JWT 认证（通过全局 JwtAuthGuard）。
 *
 * 设计权衡说明：
 * - JWT 中仅存储 userId，每次请求需通过 findByUserId 查询 playerId，产生一次额外 DB 查询。
 * - 此设计在 MVP 阶段可接受（调用频率不高），后续如需优化可在 JwtStrategy 中预加载 playerId。
 */
@ApiTags('球员')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('players')
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly shootingService: ShootingService,
  ) {}

  /**
   * 获取当前登录球员的资料
   *
   * 通过 userId 查询球员资料，若不存在则抛出 NotFoundException。
   * 所有端点共用此辅助方法，避免重复校验逻辑。
   */
  private async getCurrentPlayer(req: RequestWithUser): Promise<PlayerProfile> {
    const profile = await this.playerService.findByUserId(req.user.userId);
    if (!profile) {
      throw new NotFoundException('球员资料不存在');
    }
    return profile;
  }

  /**
   * GET /api/v1/players/profile
   * 获取当前登录球员的资料（JWT认证、脱敏响应）
   */
  @Get('profile')
  @ApiOperation({ summary: '获取球员资料' })
  @ApiResponse({
    status: 200,
    description: '获取成功，返回脱敏后的球员资料',
    type: PlayerProfileResponse,
  })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 404, description: '球员资料不存在' })
  async getProfile(
    @Req() req: RequestWithUser,
  ): Promise<PlayerProfile> {
    return this.getCurrentPlayer(req);
  }

  /**
   * PUT /api/v1/players/profile
   * 更新当前登录球员的资料
   *
   * 属性更新后，若涉及能力相关字段（age, basketballAge, gender, height, weight,
   * wingspan, standingReach, jumpingReach），会自动触发基础能力值重算。
   */
  @Put('profile')
  @ApiOperation({ summary: '更新球员资料' })
  @ApiBody({ description: '更新的球员属性', type: UpdatePlayerDto })
  @ApiResponse({
    status: 200,
    description: '更新成功，返回更新后的脱敏资料',
    type: PlayerProfileResponse,
  })
  @ApiResponse({ status: 400, description: '参数校验失败' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 404, description: '球员资料不存在' })
  @ApiResponse({ status: 409, description: '数据并发冲突（乐观锁失败）' })
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() dto: UpdatePlayerDto,
  ): Promise<PlayerProfile> {
    const profile = await this.getCurrentPlayer(req);
    return this.playerService.update(profile.id, dto);
  }

  /**
   * POST /api/v1/players/shooting
   * 录入投篮记录
   */
  @Post('shooting')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '录入投篮记录' })
  @ApiBody({ description: '投篮记录', type: CreateShootingRecordDto })
  @ApiResponse({
    status: 200,
    description: '录入成功',
    type: PlayerShootingRecord,
  })
  @ApiResponse({ status: 400, description: '参数校验失败或业务规则不满足' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  async createShootingRecord(
    @Req() req: RequestWithUser,
    @Body() dto: CreateShootingRecordDto,
  ): Promise<PlayerShootingRecord> {
    const profile = await this.getCurrentPlayer(req);
    return this.shootingService.createRecord(profile.id, dto);
  }

  /**
   * GET /api/v1/players/shooting
   * 查询投篮统计（半年滚动）
   */
  @Get('shooting')
  @ApiOperation({ summary: '查询投篮统计' })
  @ApiResponse({
    status: 200,
    description: '返回半年滚动投篮统计',
    type: [ShootingStatsResponse],
  })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  async getShootingStats(
    @Req() req: RequestWithUser,
  ): Promise<ShootingStats[]> {
    const profile = await this.getCurrentPlayer(req);
    return this.shootingService.getShootingStats(profile.id);
  }
}
