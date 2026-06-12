import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/swagger';
import { MatchConfirmationService, ConfirmParticipationResult, AlreadyConfirmedException } from '../services/match-confirmation.service';
import { MatchQueryService } from '../services/match-query.service';
import { MessageService } from '@modules/messages/services/message.service';
import { PlayerService } from '@modules/players/services/player.service';
import { QueryMatchDto } from '../dto/query-match.dto';
import {
  MatchPaginatedResponse,
  MatchDetailResponseDto,
  ConfirmParticipationResponseDto,
  DeclineParticipationResponseDto,
} from '../dto/match-response.dto';
import { SendMessageDto } from '@modules/messages/dto/send-message.dto';
import { QueryMessageDto } from '@modules/messages/dto/query-message.dto';
import { PaginatedResponse } from '@shared/common';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { PlayerProfile } from '@shared/player';

/**
 * 扩展 Express Request 类型，包含认证后的用户信息
 */
interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

// ==================== Controller ====================

/**
 * 比赛控制器
 *
 * 提供比赛列表、详情、确认/拒绝参赛、群聊消息接口。
 * 所有端点均需 JWT 认证，且仅球员角色可访问。
 *
 * 架构说明：
 * - MatchQueryService：负责读操作（列表、详情），内含参赛资格校验
 * - MatchConfirmationService：负责写操作（确认、拒绝），含支付流程
 * - MessageService：负责群聊消息收发，使用 userId 而非 playerId
 *
 * playerId vs userId：
 * - confirmParticipation / declineParticipation 需要 playerId（Player 表主键）
 * - sendMessage / getMessageHistory 需要 userId（User 表主键）
 *
 * 路由顺序注意：GET('my') 必须在 GET(':id') 之前声明，
 * 否则 NestJS 会将 "my" 解析为 :id 参数导致 ParseIntPipe 抛出 400。
 *
 * 未来扩展方向：消息端点可拆分为独立的 MatchMessageController。
 */
@ApiTags('比赛')
@ApiBearerAuth()
@Controller('matches')
export class MatchController {
  constructor(
    private readonly matchQueryService: MatchQueryService,
    private readonly matchConfirmationService: MatchConfirmationService,
    private readonly messageService: MessageService,
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
      throw new ForbiddenException('无权操作：仅球员可访问比赛');
    }

    const profile = await this.playerService.findByUserId(req.user.userId);
    if (!profile) {
      throw new NotFoundException('球员资料不存在');
    }

    return profile;
  }

  /**
   * GET /api/v1/matches/my
   * 查询我的比赛列表（分页 + 状态筛选）
   */
  @Get('my')
  @ApiOperation({ summary: '查询我的比赛列表' })
  @ApiResponse({
    status: 200,
    description: '返回分页比赛列表',
    type: MatchPaginatedResponse,
  })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '非球员角色' })
  async findMyMatches(
    @Req() req: RequestWithUser,
    @Query() query: QueryMatchDto,
  ): Promise<PaginatedResponse<any>> {
    const profile = await this.assertPlayerRole(req);
    return this.matchQueryService.findMyMatches(profile.id, query);
  }

  /**
   * GET /api/v1/matches/:id
   * 比赛详情（含队伍分配和参赛球员列表）
   */
  @Get(':id')
  @ApiOperation({ summary: '比赛详情（含队伍分配）' })
  @ApiParam({ name: 'id', description: '比赛ID', type: Number })
  @ApiResponse({
    status: 200,
    description: '返回比赛详情',
    type: MatchDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '非球员角色' })
  @ApiResponse({ status: 404, description: '比赛不存在或非参与者' })
  async findMatchDetail(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<any> {
    const profile = await this.assertPlayerRole(req);
    return this.matchQueryService.findMatchDetail(id, profile.id);
  }

  /**
   * POST /api/v1/matches/:id/confirm
   * 确认参赛（含模拟支付）
   *
   * 幂等性：已确认的球员重复调用返回 success + alreadyConfirmed=true，不抛异常。
   * 支持前端网络超时重试的「至少一次」语义。
   */
  @Post(':id/confirm')
  @ApiOperation({ summary: '确认参赛（含模拟支付）' })
  @ApiParam({ name: 'id', description: '比赛ID', type: Number })
  @ApiResponse({
    status: 201,
    description: '确认成功',
    type: ConfirmParticipationResponseDto,
  })
  @ApiResponse({ status: 400, description: '已超过截止时间' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '非球员角色' })
  @ApiResponse({ status: 404, description: '比赛不存在或非参与者' })
  @ApiResponse({ status: 409, description: '比赛状态不允许确认（已拒绝等）' })
  async confirmParticipation(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ConfirmParticipationResult | { success: true; message: string; alreadyConfirmed: true }> {
    const profile = await this.assertPlayerRole(req);
    try {
      return await this.matchConfirmationService.confirmParticipation(id, profile.id);
    } catch (err) {
      // 幂等性：已确认球员重复调用返回成功
      if (err instanceof AlreadyConfirmedException) {
        return { success: true, message: '已确认参赛', alreadyConfirmed: true };
      }
      throw err;
    }
  }

  /**
   * POST /api/v1/matches/:id/decline
   * 拒绝参赛
   */
  @Post(':id/decline')
  @ApiOperation({ summary: '拒绝参赛' })
  @ApiParam({ name: 'id', description: '比赛ID', type: Number })
  @ApiResponse({
    status: 201,
    description: '拒绝成功',
    type: DeclineParticipationResponseDto,
  })
  @ApiResponse({ status: 400, description: '状态不允许拒绝' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '非球员角色' })
  @ApiResponse({ status: 404, description: '比赛不存在或非参与者' })
  @ApiResponse({ status: 409, description: '比赛状态不允许拒绝' })
  async declineParticipation(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean; message: string }> {
    const profile = await this.assertPlayerRole(req);
    await this.matchConfirmationService.declineParticipation(id, profile.id);
    return { success: true, message: '已拒绝参赛' };
  }

  /**
   * GET /api/v1/matches/:id/messages
   * 群聊消息历史
   *
   * MessageService 使用 userId（User 表主键）而非 playerId。
   * MessageService 内部已校验用户是否为比赛参与者。
   */
  @Get(':id/messages')
  @ApiOperation({ summary: '查询群聊消息历史' })
  @ApiParam({ name: 'id', description: '比赛ID', type: Number })
  @ApiResponse({ status: 200, description: '返回分页消息历史' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '非球员角色或非参与者' })
  async getMessageHistory(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryMessageDto,
  ): Promise<PaginatedResponse<any>> {
    await this.assertPlayerRole(req);
    return this.messageService.getMessageHistory(id, req.user.userId, query);
  }

  /**
   * POST /api/v1/matches/:id/messages
   * 发送群聊消息
   *
   * MessageService 使用 userId（User 表主键）而非 playerId。
   * MessageService 内部已校验用户是否为比赛参与者。
   */
  @Post(':id/messages')
  @ApiOperation({ summary: '发送群聊消息' })
  @ApiParam({ name: 'id', description: '比赛ID', type: Number })
  @ApiBody({ description: '消息内容', type: SendMessageDto })
  @ApiResponse({ status: 201, description: '发送成功' })
  @ApiResponse({ status: 400, description: '内容校验失败（空内容/超长）' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '非球员角色或非参与者' })
  async sendMessage(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
  ): Promise<any> {
    await this.assertPlayerRole(req);
    return this.messageService.sendMessage(id, req.user.userId, dto);
  }
}
