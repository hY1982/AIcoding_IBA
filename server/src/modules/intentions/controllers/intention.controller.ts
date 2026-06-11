import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiProperty,
} from '@nestjs/swagger';
import { IntentionService, IntentionResponse } from '../services/intention.service';
import { PlayerService } from '@modules/players/services/player.service';
import { CreateIntentionDto } from '../dto/create-intention.dto';
import { UpdateIntentionDto } from '../dto/update-intention.dto';
import { QueryIntentionDto } from '../dto/query-intention.dto';
import { IntentionStatus, INTENTION_STATUSES } from '@shared/intention';
import { PaginatedResponse } from '@shared/common';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { PlayerProfile } from '@shared/player';

/**
 * 扩展 Express Request 类型，包含认证后的用户信息
 */
interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

// ==================== Swagger 响应类型类 ====================

class IntentionVenueResponse {
  @ApiProperty({ description: '场地ID' }) venueId!: number;
  @ApiProperty({ description: '优先级（1=最高）' }) priority!: number;
  @ApiProperty({ required: false, description: '场地名称' }) venueName?: string;
}

class IntentionFormatResponse {
  @ApiProperty({ description: '赛制ID' }) formatId!: number;
  @ApiProperty({ description: '优先级（1=最高）' }) priority!: number;
  @ApiProperty({ required: false, description: '赛制名称' }) formatName?: string;
}

class IntentionDetailResponse implements IntentionResponse {
  @ApiProperty({ description: '意向ID', example: 1 }) id!: number;
  @ApiProperty({ description: '球员ID', example: 42 }) playerId!: number;
  @ApiProperty({ description: '开始时间 ISO8601', example: '2026-06-12T10:00:00.000Z' }) startTime!: string;
  @ApiProperty({ description: '持续时长（分钟）', example: 120 }) durationMinutes!: number;
  @ApiProperty({ description: '可接受等待时长（分钟）', example: 30 }) acceptableWaitMinutes!: number;
  @ApiProperty({ description: '结束时间 ISO8601', example: '2026-06-12T12:00:00.000Z' }) endTime!: string;
  @ApiProperty({ enum: INTENTION_STATUSES, description: '意向状态', example: 'pending' }) status!: IntentionStatus;
  @ApiProperty({ required: false, description: '关联比赛ID', example: null }) matchId!: number | null;
  @ApiProperty({ required: false, description: '地区编码', example: 'shenzhen_futian' }) regionCode!: string | null;
  @ApiProperty({ description: '提交时间 ISO8601', example: '2026-06-11T08:00:00.000Z' }) submittedAt!: string;
  @ApiProperty({ description: '更新时间 ISO8601', example: '2026-06-11T08:00:00.000Z' }) updatedAt!: string;
  @ApiProperty({ description: '过期时间 ISO8601', example: '2026-06-12T12:00:00.000Z' }) expiresAt!: string;
  @ApiProperty({ type: [IntentionVenueResponse], description: '场地偏好列表' }) venues!: IntentionVenueResponse[];
  @ApiProperty({ type: [IntentionFormatResponse], description: '赛制偏好列表' }) formats!: IntentionFormatResponse[];
}

class IntentionListResponse implements PaginatedResponse<IntentionResponse> {
  @ApiProperty({ description: '当前页码' }) page!: number;
  @ApiProperty({ description: '每页数量' }) pageSize!: number;
  @ApiProperty({ description: '总记录数' }) total!: number;
  @ApiProperty({ type: [IntentionDetailResponse], description: '意向列表' }) list!: IntentionDetailResponse[];
}

// ==================== Controller ====================

/**
 * 意向控制器
 *
 * 提供比赛意向的提交、查询、修改、取消接口。
 * 所有端点均需 JWT 认证，且仅球员角色可访问。
 *
 * 设计说明：
 * - JWT 中仅存储 userId，每次请求通过 PlayerService.findByUserId 获取 playerId
 * - 此设计在 MVP 阶段可接受，后续可通过 JWT payload 或短期缓存优化
 */
@ApiTags('比赛意向')
@ApiBearerAuth()
// Auth: globally guarded by JwtAuthGuard (registered via APP_GUARD in app.module.ts)
@Controller('intentions')
export class IntentionController {
  constructor(
    private readonly intentionService: IntentionService,
    private readonly playerService: PlayerService,
  ) {}

  /**
   * 角色校验：确保当前用户为球员角色，并返回球员资料
   *
   * @throws ForbiddenException 非球员角色
   * @throws NotFoundException 球员资料不存在
   */
  private async assertPlayerRole(req: RequestWithUser): Promise<PlayerProfile> {
    if (req.user.userType !== 'player') {
      throw new ForbiddenException('无权操作：仅球员可管理比赛意向');
    }

    const profile = await this.playerService.findByUserId(req.user.userId);
    if (!profile) {
      throw new NotFoundException('球员资料不存在');
    }

    return profile;
  }

  /**
   * POST /api/v1/intentions
   * 提交比赛意向
   */
  @Post()
  @ApiOperation({ summary: '提交比赛意向' })
  @ApiBody({ description: '意向信息', type: CreateIntentionDto })
  @ApiResponse({
    status: 201,
    description: '创建成功，返回意向详情',
    type: IntentionDetailResponse,
  })
  @ApiResponse({ status: 400, description: '参数校验失败' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '非球员角色' })
  @ApiResponse({ status: 404, description: '球员/场地/赛制不存在' })
  @ApiResponse({ status: 409, description: '时间重叠' })
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateIntentionDto,
  ): Promise<IntentionResponse> {
    const profile = await this.assertPlayerRole(req);
    return this.intentionService.create(profile.id, dto);
  }

  /**
   * GET /api/v1/intentions/my
   * 查询我的意向列表（支持状态筛选、分页）
   */
  @Get('my')
  @ApiOperation({ summary: '查询我的意向列表' })
  @ApiResponse({
    status: 200,
    description: '返回分页意向列表',
    type: IntentionListResponse,
  })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '非球员角色' })
  async findMyIntentions(
    @Req() req: RequestWithUser,
    @Query() query: QueryIntentionDto,
  ): Promise<PaginatedResponse<IntentionResponse>> {
    const profile = await this.assertPlayerRole(req);
    return this.intentionService.findByPlayer(profile.id, query);
  }

  /**
   * PUT /api/v1/intentions/:id
   * 修改比赛意向（仅 pending 状态可修改）
   */
  @Put(':id')
  @ApiOperation({ summary: '修改比赛意向' })
  @ApiParam({ name: 'id', description: '意向ID', type: Number })
  @ApiBody({ description: '更新字段', type: UpdateIntentionDto })
  @ApiResponse({
    status: 200,
    description: '更新成功，返回更新后的意向详情',
    type: IntentionDetailResponse,
  })
  @ApiResponse({ status: 400, description: '参数校验失败或状态不允许修改' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '非球员角色或非归属球员' })
  @ApiResponse({ status: 404, description: '意向不存在' })
  @ApiResponse({ status: 409, description: '时间重叠' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIntentionDto,
  ): Promise<IntentionResponse> {
    const profile = await this.assertPlayerRole(req);
    return this.intentionService.update(id, profile.id, dto);
  }

  /**
   * DELETE /api/v1/intentions/:id
   * 取消比赛意向
   */
  @Delete(':id')
  @ApiOperation({ summary: '取消比赛意向' })
  @ApiParam({ name: 'id', description: '意向ID', type: Number })
  @ApiResponse({
    status: 200,
    description: '取消成功，返回被取消的意向详情',
    type: IntentionDetailResponse,
  })
  @ApiResponse({ status: 400, description: '状态不允许取消' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '非球员角色或非归属球员' })
  @ApiResponse({ status: 404, description: '意向不存在' })
  async cancel(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<IntentionResponse> {
    const profile = await this.assertPlayerRole(req);
    return this.intentionService.cancel(id, profile.id);
  }
}
