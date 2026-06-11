import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Venue } from '../entities/venue.entity';
import { VenueTimeSlot } from '../entities/venue-time-slot.entity';
import { CreateVenueDto } from '../dto/create-venue.dto';
import { UpdateVenueDto } from '../dto/update-venue.dto';
import { QueryVenueDto } from '../dto/query-venue.dto';
import { CreateTimeSlotDto } from '../dto/create-time-slot.dto';
import {
  VenueDetail,
  VenueListItem,
  VenueTimeSlot as VenueTimeSlotType,
} from '@shared/venue';
import { PaginatedResponse } from '@shared/common';

/**
 * 场地服务
 *
 * 负责场地的 CRUD、时段管理、权限验证。
 * 核心设计原则：
 * - 权限隔离：仅场地所属 manager 可修改/删除场地及其时段
 * - 事务完整性：批量创建时段操作包裹在事务中
 * - 数据校验：pricePerHour > 0, courtCount >= 1
 */
@Injectable()
export class VenueService {
  private readonly logger = new Logger(VenueService.name);

  constructor(
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    @InjectRepository(VenueTimeSlot)
    private readonly slotRepo: Repository<VenueTimeSlot>,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== CREATE ====================

  /**
   * 创建场地
   *
   * @param managerId 场地经理ID（从JWT中提取）
   * @param dto 场地信息
   * @throws BadRequestException pricePerHour <= 0 或 courtCount < 1
   */
  async create(managerId: number, dto: CreateVenueDto): Promise<VenueDetail> {
    this.validateCreateDto(dto);

    const venue = this.venueRepo.create({
      managerId,
      name: dto.name,
      address: dto.address,
      pricePerHour: dto.pricePerHour,
      courtCount: dto.courtCount ?? 1,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      floorMaterial: dto.floorMaterial ?? null,
      lighting: dto.lighting ?? null,
      courtType: dto.courtType ?? null,
      ventilation: dto.ventilation ?? false,
      bigFan: dto.bigFan ?? false,
      airCondition: dto.airCondition ?? false,
      turnoverTime: dto.turnoverTime ?? null,
      openTime: dto.openTime ?? null,
      closeTime: dto.closeTime ?? null,
      parking: dto.parking ?? false,
      restroom: dto.restroom ?? false,
      shower: dto.shower ?? false,
      lockerRoom: dto.lockerRoom ?? false,
      videoRecord: dto.videoRecord ?? false,
      regionCode: dto.regionCode || null,
      status: 'active',
    });

    const saved = await this.venueRepo.save(venue);
    this.logger.log(
      `场地创建成功: venueId=${saved.id}, managerId=${managerId}, name=${saved.name}`,
    );

    return this.findById(saved.id);
  }

  // ==================== READ ====================

  /**
   * 分页查询场地列表
   *
   * 默认只返回 active 状态的场地。管理后台可通过显式传入 status 查询其他状态。
   * 支持按 regionCode 和 status 筛选。
   */
  async findAll(
    query: QueryVenueDto,
  ): Promise<PaginatedResponse<VenueListItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const qb = this.venueRepo.createQueryBuilder('venue');

    // 默认只返回营业中的场地
    qb.andWhere('venue.status = :status', { status: query.status ?? 'active' });

    if (query.regionCode) {
      qb.andWhere('venue.regionCode = :regionCode', {
        regionCode: query.regionCode,
      });
    }

    qb.orderBy('venue.createdAt', 'DESC').skip(skip).take(pageSize);

    const [venues, total] = await qb.getManyAndCount();

    const list: VenueListItem[] = venues.map((v) => this.mapToVenueListItem(v));

    return { page, pageSize, total, list };
  }

  /**
   * 按场地方ID查询场地列表（数据库层过滤）
   *
   * 替代内存过滤，避免大数据量时的性能问题。
   */
  async findByManagerId(managerId: number): Promise<VenueListItem[]> {
    const venues = await this.venueRepo.find({
      where: { managerId },
      order: { createdAt: 'DESC' },
    });

    return venues.map((v) => this.mapToVenueListItem(v));
  }

  /**
   * 按ID查询场地详情（含时段列表）
   *
   * @throws NotFoundException 场地不存在
   */
  async findById(venueId: number): Promise<VenueDetail> {
    const venue = await this.venueRepo
      .createQueryBuilder('venue')
      .leftJoinAndSelect('venue.timeSlots', 'timeSlot')
      .where('venue.id = :venueId', { venueId })
      .orderBy('timeSlot.slotDate', 'ASC')
      .addOrderBy('timeSlot.startTime', 'ASC')
      .getOne();

    if (!venue) {
      throw new NotFoundException(`场地不存在: venueId=${venueId}`);
    }

    return this.toVenueDetail(venue);
  }

  // ==================== UPDATE ====================

  /**
   * 更新场地信息
   *
   * @param venueId 场地ID
   * @param managerId 当前操作者managerID
   * @param dto 更新字段
   * @throws NotFoundException 场地不存在
   * @throws ForbiddenException 非所属manager
   */
  async update(
    venueId: number,
    managerId: number,
    dto: UpdateVenueDto,
  ): Promise<VenueDetail> {
    const venue = await this.assertVenueOwnership(venueId, managerId);

    if (dto.pricePerHour !== undefined && dto.pricePerHour <= 0) {
      throw new BadRequestException('每小时价格必须大于0');
    }

    if (dto.courtCount !== undefined && dto.courtCount < 1) {
      throw new BadRequestException('球场数量必须至少为1');
    }

    const updateData: Partial<Venue> = {};

    Object.keys(dto).forEach((key) => {
      const value = dto[key as keyof UpdateVenueDto];
      if (value !== undefined) {
        (updateData as any)[key] = value;
      }
    });

    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(Venue)
        .set(updateData)
        .where('id = :id', { id: venueId })
        .andWhere('version = :version', { version: venue.version })
        .execute();

      if (result.affected === 0) {
        throw new ConflictException('数据已被其他操作修改，请刷新后重试');
      }
    });

    this.logger.log(`场地更新成功: venueId=${venueId}, managerId=${managerId}`);
    return this.findById(venueId);
  }

  // ==================== DELETE ====================

  /**
   * 删除场地
   *
   * @throws NotFoundException 场地不存在
   * @throws ForbiddenException 非所属manager
   */
  async remove(venueId: number, managerId: number): Promise<void> {
    const venue = await this.assertVenueOwnership(venueId, managerId);

    await this.venueRepo.remove(venue);
    this.logger.log(`场地删除成功: venueId=${venueId}, managerId=${managerId}`);
  }

  // ==================== TIME SLOTS ====================

  /**
   * 为场地批量创建可预订时段
   *
   * @throws NotFoundException 场地不存在
   * @throws ForbiddenException 非所属manager
   */
  async createTimeSlots(
    venueId: number,
    managerId: number,
    dtos: CreateTimeSlotDto[],
  ): Promise<VenueTimeSlotType[]> {
    await this.assertVenueOwnership(venueId, managerId);

    // 校验时段重叠：同一日期内，startTime < otherEndTime 且 endTime > otherStartTime
    this.validateTimeSlotOverlap(dtos);

    const slots = await this.dataSource.transaction(async (manager) => {
      const entities = dtos.map((dto) =>
        manager.create(VenueTimeSlot, {
          venueId,
          slotDate: dto.slotDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          isBooked: false,
        }),
      );
      return manager.save(VenueTimeSlot, entities);
    });

    this.logger.log(
      `时段创建成功: venueId=${venueId}, count=${slots.length}, managerId=${managerId}`,
    );

    return slots.map((s) => this.toTimeSlotType(s));
  }

  /**
   * 查询场地的可预订时段
   *
   * @param venueId 场地ID
   * @param slotDate 可选：按日期筛选（YYYY-MM-DD）
   */
  async findTimeSlots(
    venueId: number,
    slotDate?: string,
  ): Promise<VenueTimeSlotType[]> {
    // 轻量检查场地是否存在（避免 findById 的 leftJoinAndSelect 开销）
    const venue = await this.venueRepo.findOne({ where: { id: venueId }, select: ['id'] });
    if (!venue) {
      throw new NotFoundException(`场地不存在: venueId=${venueId}`);
    }

    const where: Record<string, unknown> = { venueId };
    if (slotDate) {
      where.slotDate = slotDate;
    }

    const slots = await this.slotRepo.find({
      where,
      order: { slotDate: 'ASC', startTime: 'ASC' },
    });

    return slots.map((s) => this.toTimeSlotType(s));
  }

  // ==================== Private Helpers ====================

  /**
   * 将 Venue 实体映射为 VenueListItem
   */
  private mapToVenueListItem(v: Venue): VenueListItem {
    return {
      id: v.id,
      name: v.name,
      address: v.address,
      pricePerHour: Number(v.pricePerHour),
      courtCount: v.courtCount,
      floorMaterial: v.floorMaterial ?? undefined,
      courtType: v.courtType ?? undefined,
      ventilation: v.ventilation ?? undefined,
      bigFan: v.bigFan ?? undefined,
      airCondition: v.airCondition ?? undefined,
      parking: v.parking ?? undefined,
      restroom: v.restroom ?? undefined,
      shower: v.shower ?? undefined,
      lockerRoom: v.lockerRoom ?? undefined,
      videoRecord: v.videoRecord ?? undefined,
      status: v.status,
      ratingAvg: v.ratingAvg ? Number(v.ratingAvg) : undefined,
      ratingCount: v.ratingCount ?? 0,
    };
  }

  /**
   * 验证创建场地的 DTO
   */
  private validateCreateDto(dto: CreateVenueDto): void {
    if (dto.pricePerHour <= 0) {
      throw new BadRequestException('每小时价格必须大于0');
    }

    if (dto.courtCount !== undefined && dto.courtCount < 1) {
      throw new BadRequestException('球场数量必须至少为1');
    }
  }

  /**
   * 校验时段列表是否存在重叠
   *
   * 同一日期内，若两个时段的时间范围有交集则视为重叠。
   * 时间格式支持 HH:mm 和 HH:mm:ss。
   */
  private validateTimeSlotOverlap(dtos: CreateTimeSlotDto[]): void {
    // 按日期分组
    const grouped = new Map<string, CreateTimeSlotDto[]>();
    for (const dto of dtos) {
      const list = grouped.get(dto.slotDate) ?? [];
      list.push(dto);
      grouped.set(dto.slotDate, list);
    }

    for (const [slotDate, slots] of grouped) {
      // 按开始时间排序
      const sorted = [...slots].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      );

      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        if (current.endTime > next.startTime) {
          throw new BadRequestException(
            `时段重叠: ${slotDate} ${current.startTime}-${current.endTime} 与 ${next.startTime}-${next.endTime}`,
          );
        }
      }
    }
  }

  /**
   * 断言场地归属权
   *
   * @returns 场地实体（若验证通过）
   * @throws NotFoundException 场地不存在
   * @throws ForbiddenException 当前manager不是场地所有者
   */
  private async assertVenueOwnership(
    venueId: number,
    managerId: number,
  ): Promise<Venue> {
    const venue = await this.venueRepo.findOneBy({ id: venueId });

    if (!venue) {
      throw new NotFoundException(`场地不存在: venueId=${venueId}`);
    }

    if (venue.managerId !== managerId) {
      throw new ForbiddenException('无权操作该场地');
    }

    return venue;
  }

  /**
   * 将 Venue 实体转换为 VenueDetail 响应对象
   */
  private toVenueDetail(venue: Venue): VenueDetail {
    const timeSlots = venue.timeSlots || [];

    return {
      id: venue.id,
      managerId: venue.managerId,
      name: venue.name,
      address: venue.address,
      pricePerHour: Number(venue.pricePerHour),
      courtCount: venue.courtCount,
      latitude: venue.latitude ?? undefined,
      longitude: venue.longitude ?? undefined,
      floorMaterial: venue.floorMaterial ?? undefined,
      lighting: venue.lighting ?? undefined,
      courtType: venue.courtType ?? undefined,
      ventilation: venue.ventilation ?? undefined,
      bigFan: venue.bigFan ?? undefined,
      airCondition: venue.airCondition ?? undefined,
      turnoverTime: venue.turnoverTime ?? undefined,
      parking: venue.parking ?? undefined,
      restroom: venue.restroom ?? undefined,
      shower: venue.shower ?? undefined,
      lockerRoom: venue.lockerRoom ?? undefined,
      videoRecord: venue.videoRecord ?? undefined,
      ratingAvg: venue.ratingAvg ? Number(venue.ratingAvg) : undefined,
      ratingCount: venue.ratingCount ?? undefined,
      status: venue.status,
      regionCode: venue.regionCode ?? undefined,
      createdAt: venue.createdAt.toISOString(),
      updatedAt: venue.updatedAt.toISOString(),
      timeSlots: timeSlots.map((s) => this.toTimeSlotType(s)),
    };
  }

  /**
   * 将 VenueTimeSlot 实体转换为类型安全对象
   */
  private toTimeSlotType(slot: VenueTimeSlot): VenueTimeSlotType {
    return {
      id: slot.id,
      venueId: slot.venueId,
      slotDate: slot.slotDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isBooked: slot.isBooked ?? false,
      matchId: slot.matchId ?? undefined,
    };
  }
}
