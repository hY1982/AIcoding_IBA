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
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { Public } from '@modules/auth/decorators/public.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { VenueService } from '../services/venue.service';
import { UnavailableSlotService } from '../services/unavailable-slot.service';
import { VenueManagerProfileService } from '../services/venue-manager-profile.service';
import { CreateVenueDto } from '../dto/create-venue.dto';
import { UpdateVenueDto } from '../dto/update-venue.dto';
import { QueryVenueDto } from '../dto/query-venue.dto';
import { CreateTimeSlotDto } from '../dto/create-time-slot.dto';
import { CreateTimeSlotsDto } from '../dto/create-time-slots.dto';
import { CreateUnavailableSlotsDto } from '../dto/create-unavailable-slot.dto';
import {
  VenueDetail,
  VenueListItem,
  VenueTimeSlot,
  VenueDisplaySlot,
  FLOOR_MATERIALS,
  FloorMaterial,
  COURT_TYPES,
  CourtType,
  VENUE_STATUSES,
  VenueStatus,
} from '@shared/venue';
import { PaginatedResponse } from '@shared/common';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';

/**
 * 扩展 Express Request 类型，包含认证后的用户信息
 */
interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

// ==================== Swagger 响应类型类 ====================
// 注：以下响应类定义在 Controller 同文件内，符合现有项目模式。
// 未来若需复用，可抽取到 dto/response/ 目录。

class VenueDisplaySlotResponse implements VenueDisplaySlot {
  @ApiProperty({ description: '开始时间 HH:mm' })
  startTime!: string;

  @ApiProperty({ description: '结束时间 HH:mm' })
  endTime!: string;

  @ApiProperty({ enum: ['available', 'unavailable', 'booked'], description: '时段状态' })
  status!: 'available' | 'unavailable' | 'booked';

  @ApiProperty({ required: false, description: '状态原因（如维护、包场、非营业时间）' })
  reason?: string;
}

class VenueTimeSlotResponse implements VenueTimeSlot {
  @ApiProperty({ description: '时段ID' })
  id!: number;

  @ApiProperty({ description: '场地ID' })
  venueId!: number;

  @ApiProperty({ description: '日期 YYYY-MM-DD' })
  slotDate!: string;

  @ApiProperty({ description: '开始时间 HH:mm' })
  startTime!: string;

  @ApiProperty({ description: '结束时间 HH:mm' })
  endTime!: string;

  @ApiProperty({ description: '是否已预订' })
  isBooked!: boolean;

  @ApiProperty({ required: false, description: '关联比赛ID' })
  matchId?: number;
}

class VenueListItemResponse implements VenueListItem {
  @ApiProperty({ description: '场地ID' })
  id!: number;

  @ApiProperty({ description: '场地名称' })
  name!: string;

  @ApiProperty({ description: '地址' })
  address!: string;

  @ApiProperty({ description: '每小时价格' })
  pricePerHour!: number;

  @ApiProperty({ description: '球场数量' })
  courtCount!: number;

  @ApiProperty({ enum: FLOOR_MATERIALS, required: false, description: '地面材质' })
  floorMaterial?: FloorMaterial;

  @ApiProperty({ enum: COURT_TYPES, required: false, description: '场地类型' })
  courtType?: CourtType;

  @ApiProperty({ required: false, description: '是否有通风' })
  ventilation?: boolean;

  @ApiProperty({ required: false, description: '是否有大吊扇' })
  bigFan?: boolean;

  @ApiProperty({ required: false, description: '是否有空调' })
  airCondition?: boolean;

  @ApiProperty({ required: false, description: '是否有停车位' })
  parking?: boolean;

  @ApiProperty({ required: false, description: '是否有厕所' })
  restroom?: boolean;

  @ApiProperty({ required: false, description: '是否有淋浴' })
  shower?: boolean;

  @ApiProperty({ required: false, description: '是否有更衣室' })
  lockerRoom?: boolean;

  @ApiProperty({ required: false, description: '是否有比赛录像' })
  videoRecord?: boolean;

  @ApiProperty({ enum: VENUE_STATUSES, description: '场地状态' })
  status!: VenueStatus;

  @ApiProperty({ required: false, description: '平均评分' })
  ratingAvg?: number;

  @ApiProperty({ required: false, description: '评分数量' })
  ratingCount?: number;
}

class VenueDetailResponse extends VenueListItemResponse implements VenueDetail {
  @ApiProperty({ description: '场地方ID' })
  managerId!: number;

  @ApiProperty({ required: false, description: '纬度' })
  latitude?: number;

  @ApiProperty({ required: false, description: '经度' })
  longitude?: number;

  @ApiProperty({ required: false, description: '灯光' })
  lighting?: string;

  @ApiProperty({ required: false, description: '翻场时间（分钟）' })
  turnoverTime?: number;

  @ApiProperty({ required: false, description: '地区编码' })
  regionCode?: string;

  @ApiProperty({ description: '创建时间 ISO8601' })
  createdAt!: string;

  @ApiProperty({ description: '更新时间 ISO8601' })
  updatedAt!: string;

  @ApiProperty({ type: [VenueTimeSlotResponse], required: false, description: '可预订时段列表' })
  timeSlots?: VenueTimeSlotResponse[];

  @ApiProperty({ required: false, description: '营业时间（开始）HH:mm' })
  openTime?: string;

  @ApiProperty({ required: false, description: '营业时间（结束）HH:mm' })
  closeTime?: string;
}

class VenueListResponse implements PaginatedResponse<VenueListItem> {
  @ApiProperty({ description: '当前页码' })
  page!: number;

  @ApiProperty({ description: '每页数量' })
  pageSize!: number;

  @ApiProperty({ description: '总记录数' })
  total!: number;

  @ApiProperty({ type: [VenueListItemResponse], description: '场地列表' })
  list!: VenueListItemResponse[];
}

/**
 * 场地控制器
 *
 * 提供场地的 CRUD 接口和时段管理接口。
 * 所有端点均需 JWT 认证（通过全局 JwtAuthGuard）。
 * 场地创建/更新/删除/时段创建仅限场地方角色。
 */
@ApiTags('场地')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('venues')
export class VenueController {
  constructor(
    private readonly venueService: VenueService,
    private readonly unavailableSlotService: UnavailableSlotService,
    private readonly venueManagerProfileService: VenueManagerProfileService,
  ) {}

  /**
   * 断言当前用户为场地方角色，否则抛出 ForbiddenException
   */
  private assertVenueManagerRole(req: RequestWithUser): void {
    if (req.user.userType !== 'venue_manager') {
      throw new ForbiddenException('无权操作：仅场地方可管理场地');
    }
  }

  /**
   * POST /api/v1/venues
   * 创建场地（仅限场地方角色）
   */
  @Post()
  @ApiOperation({ summary: '创建场地' })
  @ApiBody({ description: '场地信息', type: CreateVenueDto })
  @ApiResponse({
    status: 201,
    description: '创建成功，返回场地详情',
    type: VenueDetailResponse,
  })
  @ApiResponse({ status: 400, description: '参数校验失败' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '无权操作：仅场地方可创建场地' })
  @ApiResponse({ status: 404, description: '场地方资料不存在' })
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateVenueDto,
  ): Promise<VenueDetail> {
    this.assertVenueManagerRole(req);

    const profile = await this.venueManagerProfileService.findByUserId(req.user.userId);
    if (!profile) {
      throw new NotFoundException('场地方资料不存在');
    }
    // 使用 userId 作为 manager_id，确保与权限校验一致
    return this.venueService.create(req.user.userId, dto);
  }

  /**
   * GET /api/v1/venues
   * 查询场地列表（分页、地区筛选、状态筛选）
   * 公开接口：无需登录即可浏览
   */
  @Get()
  @Public()
  @ApiOperation({ summary: '查询场地列表' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码，默认1' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: '每页数量，默认10' })
  @ApiQuery({ name: 'regionCode', required: false, type: String, description: '地区编码' })
  @ApiQuery({ name: 'status', required: false, enum: VENUE_STATUSES, description: '场地状态' })
  @ApiResponse({
    status: 200,
    description: '查询成功，返回分页场地列表',
    type: VenueListResponse,
  })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  async findAll(
    @Query() query: QueryVenueDto,
  ): Promise<PaginatedResponse<VenueListItem>> {
    return this.venueService.findAll(query);
  }

  /**
   * GET /api/v1/venues/my
   * 获取当前登录场地方的所有场地
   */
  @Get('my')
  @ApiOperation({ summary: '获取我的场地列表' })
  @ApiResponse({
    status: 200,
    description: '获取成功，返回场地列表',
    type: [VenueListItemResponse],
  })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '无权操作：仅场地方可查看我的场地' })
  @ApiResponse({ status: 404, description: '场地方资料不存在' })
  async findMyVenues(
    @Req() req: RequestWithUser,
  ): Promise<VenueListItem[]> {
    this.assertVenueManagerRole(req);

    const profile = await this.venueManagerProfileService.findByUserId(req.user.userId);
    if (!profile) {
      throw new NotFoundException('场地方资料不存在');
    }
    // 使用 userId 查询场地列表
    return this.venueService.findByManagerId(req.user.userId);
  }

  /**
   * GET /api/v1/venues/:id
   * 获取场地详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取场地详情' })
  @ApiParam({ name: 'id', description: '场地ID' })
  @ApiResponse({
    status: 200,
    description: '获取成功，返回场地详情',
    type: VenueDetailResponse,
  })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 404, description: '场地不存在' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<VenueDetail> {
    return this.venueService.findById(id);
  }

  /**
   * PUT /api/v1/venues/:id
   * 更新场地信息（仅限场地方角色且为所有者）
   */
  @Put(':id')
  @ApiOperation({ summary: '更新场地信息' })
  @ApiParam({ name: 'id', description: '场地ID' })
  @ApiBody({ description: '更新的场地属性', type: UpdateVenueDto })
  @ApiResponse({
    status: 200,
    description: '更新成功，返回更新后的场地详情',
    type: VenueDetailResponse,
  })
  @ApiResponse({ status: 400, description: '参数校验失败' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '无权操作该场地' })
  @ApiResponse({ status: 404, description: '场地不存在' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVenueDto,
  ): Promise<VenueDetail> {
    this.assertVenueManagerRole(req);

    const profile = await this.venueManagerProfileService.findByUserId(req.user.userId);
    if (!profile) {
      throw new NotFoundException('场地方资料不存在');
    }
    // 使用 userId 更新场地
    return this.venueService.update(id, req.user.userId, dto);
  }

  /**
   * DELETE /api/v1/venues/:id
   * 删除场地（仅限场地方角色且为所有者）
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除场地' })
  @ApiParam({ name: 'id', description: '场地ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '无权操作该场地' })
  @ApiResponse({ status: 404, description: '场地不存在' })
  async remove(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    this.assertVenueManagerRole(req);

    const profile = await this.venueManagerProfileService.findByUserId(req.user.userId);
    if (!profile) {
      throw new NotFoundException('场地方资料不存在');
    }
    // 使用 userId 删除场地
    return this.venueService.remove(id, req.user.userId);
  }

  /**
   * GET /api/v1/venues/:id/slots
   * 查询场地展示时段（连续时间轴，含可预订/不可预订/已占用）
   * 公开接口：无需登录即可查看
   */
  @Get(':id/slots')
  @Public()
  @ApiOperation({ summary: '查询场地展示时段' })
  @ApiParam({ name: 'id', description: '场地ID' })
  @ApiQuery({ name: 'slotDate', required: false, type: String, description: '日期 YYYY-MM-DD，默认为今天' })
  @ApiResponse({
    status: 200,
    description: '查询成功，返回连续时段列表',
    type: [VenueDisplaySlotResponse],
  })
  @ApiResponse({ status: 400, description: '参数校验失败' })
  @ApiResponse({ status: 404, description: '场地不存在' })
  async findTimeSlots(
    @Param('id', ParseIntPipe) id: number,
    @Query('slotDate') slotDate?: string,
  ): Promise<VenueDisplaySlot[]> {
    // 默认使用今天
    const targetDate = slotDate || new Date().toISOString().slice(0, 10);

    // 校验日期格式
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      throw new BadRequestException('slotDate 格式必须为 YYYY-MM-DD');
    }

    // 校验日期有效性
    const [year, month, day] = targetDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      throw new BadRequestException('slotDate 不是有效日期');
    }

    return this.unavailableSlotService.getDisplaySlots(id, targetDate);
  }

  /**
   * POST /api/v1/venues/:id/unavailable-slots
   * 创建不可预订时段（仅限场地方角色且为所有者）
   */
  @Post(':id/unavailable-slots')
  @ApiOperation({ summary: '创建不可预订时段' })
  @ApiParam({ name: 'id', description: '场地ID' })
  @ApiBody({ description: '不可预订时段列表', type: CreateUnavailableSlotsDto })
  @ApiResponse({
    status: 201,
    description: '创建成功，返回不可预订时段列表',
    type: [VenueTimeSlotResponse],
  })
  @ApiResponse({ status: 400, description: '参数校验失败或时段重叠' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '无权操作该场地' })
  @ApiResponse({ status: 404, description: '场地不存在' })
  async createUnavailableSlots(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateUnavailableSlotsDto,
  ): Promise<VenueTimeSlot[]> {
    this.assertVenueManagerRole(req);

    const profile = await this.venueManagerProfileService.findByUserId(req.user.userId);
    if (!profile) {
      throw new NotFoundException('场地方资料不存在');
    }

    // 使用 userId 创建不可预订时段
    return this.unavailableSlotService.createUnavailableSlots(
      id,
      req.user.userId,
      dto.slots,
    ) as unknown as VenueTimeSlot[];
  }

  /**
   * GET /api/v1/venues/:id/unavailable-slots
   * 查询不可预订时段列表（场地方管理用）
   */
  @Get(':id/unavailable-slots')
  @ApiOperation({ summary: '查询不可预订时段列表' })
  @ApiParam({ name: 'id', description: '场地ID' })
  @ApiQuery({ name: 'slotDate', required: false, type: String, description: '日期 YYYY-MM-DD' })
  @ApiResponse({
    status: 200,
    description: '查询成功，返回不可预订时段列表',
    type: [VenueTimeSlotResponse],
  })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '场地不存在' })
  async findUnavailableSlots(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('slotDate') slotDate?: string,
  ): Promise<VenueTimeSlot[]> {
    this.assertVenueManagerRole(req);

    const profile = await this.venueManagerProfileService.findByUserId(req.user.userId);
    if (!profile) {
      throw new NotFoundException('场地方资料不存在');
    }

    // 校验归属
    await this.venueService.findById(id);

    return this.unavailableSlotService.findUnavailableSlots(id, slotDate) as unknown as VenueTimeSlot[];
  }

  /**
   * DELETE /api/v1/venues/:id/unavailable-slots/:slotId
   * 删除不可预订时段（仅限场地方角色且为所有者）
   */
  @Delete(':id/unavailable-slots/:slotId')
  @ApiOperation({ summary: '删除不可预订时段' })
  @ApiParam({ name: 'id', description: '场地ID' })
  @ApiParam({ name: 'slotId', description: '时段ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '无权操作该场地' })
  @ApiResponse({ status: 404, description: '场地或时段不存在' })
  async deleteUnavailableSlot(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('slotId', ParseIntPipe) slotId: number,
  ): Promise<void> {
    this.assertVenueManagerRole(req);

    const profile = await this.venueManagerProfileService.findByUserId(req.user.userId);
    if (!profile) {
      throw new NotFoundException('场地方资料不存在');
    }

    // 使用 userId 删除不可预订时段
    return this.unavailableSlotService.deleteUnavailableSlot(slotId, id, req.user.userId);
  }

  /**
   * POST /api/v1/venues/:id/slots
   * 创建场地可预订时段（仅限场地方角色且为所有者）
   */
  @Post(':id/slots')
  @ApiOperation({ summary: '创建场地可预订时段' })
  @ApiParam({ name: 'id', description: '场地ID' })
  @ApiBody({ description: '时段列表', type: CreateTimeSlotsDto })
  @ApiResponse({
    status: 201,
    description: '创建成功，返回时段列表',
    type: [VenueTimeSlotResponse],
  })
  @ApiResponse({ status: 400, description: '参数校验失败或时段重叠' })
  @ApiResponse({ status: 401, description: '未登录或Token无效' })
  @ApiResponse({ status: 403, description: '无权操作该场地' })
  @ApiResponse({ status: 404, description: '场地不存在' })
  async createTimeSlots(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTimeSlotsDto,
  ): Promise<VenueTimeSlot[]> {
    this.assertVenueManagerRole(req);

    const profile = await this.venueManagerProfileService.findByUserId(req.user.userId);
    if (!profile) {
      throw new NotFoundException('场地方资料不存在');
    }

    // 先验证场地存在，所有权由 Service.createTimeSlots 验证
    await this.venueService.findById(id);

    // 使用 userId 创建时段
    return this.venueService.createTimeSlots(id, req.user.userId, dto.slots);
  }
}
