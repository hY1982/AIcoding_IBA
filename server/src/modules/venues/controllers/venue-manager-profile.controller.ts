import {
  Controller,
  Get,
  Put,
  Body,
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
import { VenueManagerProfileService } from '../services/venue-manager-profile.service';
import { VenueManagerProfile, UpdateVenueManagerProfileDto } from '@shared/venue-manager';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';

/**
 * 扩展 Express Request 类型，包含认证后的用户信息
 */
interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

/**
 * 场地方资料响应类型（用于 Swagger 文档）
 */
class VenueManagerProfileResponse implements VenueManagerProfile {
  id!: number;
  userId!: number;
  companyName?: string;
  contactName?: string;
  contactPhone?: string;
  phone!: string;
  nickname!: string;
  realName!: string;
  avatarUrl?: string;
  venues!: Array<{
    id: number;
    name: string;
    address: string;
    pricePerHour: number;
    courtCount: number;
    ratingAvg?: number;
    ratingCount: number;
  }>;
  createdAt!: string;
  updatedAt!: string;
}

/**
 * 场地方资料控制器
 *
 * 提供场地方资料查询/更新接口。
 * 所有端点均需 JWT 认证（通过全局 JwtAuthGuard）。
 */
@ApiTags('场地方资料')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('venue-managers')
export class VenueManagerProfileController {
  constructor(
    private readonly venueManagerProfileService: VenueManagerProfileService,
  ) {}

  /**
   * GET /api/v1/venue-managers/profile
   * 获取当前登录场地方的资料（JWT认证、脱敏响应）
   */
  @Get('profile')
  @ApiOperation({ summary: '获取场地方资料' })
  @ApiResponse({
    status: 200,
    description: '获取成功，返回脱敏后的场地方资料',
    type: VenueManagerProfileResponse,
  })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 404, description: '场地方资料不存在' })
  async getProfile(
    @Req() req: RequestWithUser,
  ): Promise<VenueManagerProfile> {
    const profile = await this.venueManagerProfileService.findByUserId(
      req.user.userId,
    );
    if (!profile) {
      throw new NotFoundException('场地方资料不存在');
    }
    return profile;
  }

  /**
   * PUT /api/v1/venue-managers/profile
   * 更新当前登录场地方的资料
   */
  @Put('profile')
  @ApiOperation({ summary: '更新场地方资料' })
  @ApiBody({ description: '更新的场地方属性', type: Object })
  @ApiResponse({
    status: 200,
    description: '更新成功，返回更新后的脱敏资料',
    type: VenueManagerProfileResponse,
  })
  @ApiResponse({ status: 400, description: '参数校验失败' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 404, description: '场地方资料不存在' })
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateVenueManagerProfileDto,
  ): Promise<VenueManagerProfile> {
    // 先查询出场地方ID
    const profile = await this.venueManagerProfileService.findByUserId(
      req.user.userId,
    );
    if (!profile) {
      throw new NotFoundException('场地方资料不存在');
    }
    return this.venueManagerProfileService.update(profile.id, dto);
  }
}
