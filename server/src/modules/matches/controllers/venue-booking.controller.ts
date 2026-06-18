import {
  Controller,
  Put,
  Body,
  Param,
  Req,
  ParseIntPipe,
  NotFoundException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { MatchConfirmationService } from '../services/match-confirmation.service';
import { VenueBookingRequest } from '@modules/venues/entities/venue-booking-request.entity';
import { VenueManagerProfileService } from '@modules/venues/services/venue-manager-profile.service';
import { RejectBookingDto } from '../dto/reject-booking.dto';

interface RequestWithUser extends Request {
  user: { userId: number; phone: string; userType: string };
}

/**
 * 场地预订确认控制器
 *
 * 提供场地方确认/拒绝预订请求的接口。
 * 路由挂载在 venues 路径下（符合 RESTful 嵌套资源语义），
 * 但实现在 matches 模块内（避免 venues → matches 循环依赖）。
 *
 * 权限控制：仅场地管理员（userType='venue_manager'）可操作，
 * 且只能操作自己管理的场地。
 *
 * 接口：
 * - PUT /venues/:venueId/bookings/:bookingId/confirm
 * - PUT /venues/:venueId/bookings/:bookingId/reject
 */
@ApiTags('场地预订')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('venues')
export class VenueBookingController {
  constructor(
    private readonly confirmationService: MatchConfirmationService,
    @InjectRepository(VenueBookingRequest)
    private readonly bookingRequestRepo: Repository<VenueBookingRequest>,
    private readonly venueManagerProfileService: VenueManagerProfileService,
  ) {}

  /**
   * PUT /api/v1/venues/:venueId/bookings/:bookingId/confirm
   * 场地方确认预订请求。
   *
   * 流程：权限校验 → 悲观锁预订场地 → 比赛 confirmed → 分队 → 通知
   */
  @Put(':venueId/bookings/:bookingId/confirm')
  @ApiOperation({ summary: '场地方确认预订' })
  @ApiParam({ name: 'venueId', description: '场地ID' })
  @ApiParam({ name: 'bookingId', description: '预订请求ID' })
  @ApiResponse({ status: 200, description: '确认成功，比赛正式生效' })
  @ApiResponse({ status: 403, description: '无权操作该场地' })
  @ApiResponse({ status: 404, description: '预订请求不存在' })
  @ApiResponse({ status: 409, description: '比赛状态不允许确认 / 场地时段冲突' })
  async confirmBooking(
    @Req() req: RequestWithUser,
    @Param('venueId', ParseIntPipe) venueId: number,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ): Promise<{ success: boolean; message: string }> {
    await this.assertVenueManagerOwnsVenue(req, venueId);

    const bookingRequest = await this.bookingRequestRepo.findOne({
      where: { id: bookingId, venueId },
    });

    if (!bookingRequest) {
      throw new NotFoundException(
        `预订请求不存在: venueId=${venueId}, bookingId=${bookingId}`,
      );
    }

    return this.confirmationService.confirmVenueBooking(
      bookingRequest.matchId,
      bookingId,
    );
  }

  /**
   * PUT /api/v1/venues/:venueId/bookings/:bookingId/reject
   * 场地方拒绝预订请求。
   *
   * 流程：权限校验 → 比赛 cancelled → 释放球员（意向回退保护）→ 退款
   */
  @Put(':venueId/bookings/:bookingId/reject')
  @ApiOperation({ summary: '场地方拒绝预订' })
  @ApiParam({ name: 'venueId', description: '场地ID' })
  @ApiParam({ name: 'bookingId', description: '预订请求ID' })
  @ApiBody({ type: RejectBookingDto })
  @ApiResponse({ status: 200, description: '拒绝成功，比赛已取消' })
  @ApiResponse({ status: 403, description: '无权操作该场地' })
  @ApiResponse({ status: 404, description: '预订请求不存在' })
  @ApiResponse({ status: 409, description: '比赛状态不允许拒绝' })
  async rejectBooking(
    @Req() req: RequestWithUser,
    @Param('venueId', ParseIntPipe) venueId: number,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: RejectBookingDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.assertVenueManagerOwnsVenue(req, venueId);

    const bookingRequest = await this.bookingRequestRepo.findOne({
      where: { id: bookingId, venueId },
    });

    if (!bookingRequest) {
      throw new NotFoundException(
        `预订请求不存在: venueId=${venueId}, bookingId=${bookingId}`,
      );
    }

    return this.confirmationService.rejectVenueBooking(
      bookingRequest.matchId,
      bookingId,
      dto.rejectionReason,
    );
  }

  /**
   * 校验当前用户为场地管理员且拥有目标场地。
   *
   * 1. 检查 userType === 'venue_manager'
   * 2. 查询场地管理员 Profile
   * 3. 检查目标场地是否在该管理员的场地列表中
   */
  private async assertVenueManagerOwnsVenue(
    req: RequestWithUser,
    venueId: number,
  ): Promise<void> {
    if (req.user.userType !== 'venue_manager') {
      throw new ForbiddenException('无权操作：仅场地方可管理场地预订');
    }

    const profile = await this.venueManagerProfileService.findByUserId(
      req.user.userId,
    );
    if (!profile) {
      throw new NotFoundException('场地方资料不存在');
    }

    const ownsVenue = profile.venues.some((v) => v.id === venueId);
    if (!ownsVenue) {
      throw new ForbiddenException(
        `无权操作场地 venueId=${venueId}：您不是该场地的管理员`,
      );
    }
  }
}
