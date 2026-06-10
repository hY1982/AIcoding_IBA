import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { VenueUnavailableSlot } from '../entities/venue-unavailable-slot.entity';
import { Venue } from '../entities/venue.entity';
import { VenueTimeSlot } from '../entities/venue-time-slot.entity';
import {
  VenueUnavailableSlot as VenueUnavailableSlotType,
  VenueDisplaySlot,
} from '@shared/venue';

/**
 * 不可预订时段服务
 *
 * 核心职责：
 * 1. 场地方录入/删除不可预订时段（维护、包场等）
 * 2. 根据"不可预订时段 + 已预订时段"生成连续的自然时间展示
 * 3. 翻场时间自动叠加到不可预订范围
 *
 * 设计原则：
 * - "默认全可用，例外才记录"：新建场地后无需手动创建时段
 * - 状态优先级：booked > unavailable > available
 * - 营业时间范围：非营业时间默认不可预订
 */
@Injectable()
export class UnavailableSlotService {
  private readonly logger = new Logger(UnavailableSlotService.name);

  // 简单内存缓存：(venueId, slotDate) -> { data, expiry }
  private readonly cache = new Map<string, { data: VenueDisplaySlot[]; expiry: number }>();
  private readonly CACHE_TTL_MS = 60_000; // 60秒

  constructor(
    @InjectRepository(VenueUnavailableSlot)
    private readonly unavailableRepo: Repository<VenueUnavailableSlot>,
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    @InjectRepository(VenueTimeSlot)
    private readonly timeSlotRepo: Repository<VenueTimeSlot>,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== CREATE ====================

  /**
   * 创建不可预订时段
   *
   * @param venueId 场地ID
   * @param managerId 场地方managerID
   * @param slots 不可预订时段列表
   * @throws NotFoundException 场地不存在
   * @throws ForbiddenException 非所属manager
   * @throws BadRequestException 校验失败（重叠、跨天、粒度不对等）
   */
  async createUnavailableSlots(
    venueId: number,
    managerId: number,
    slots: Array<{
      slotDate: string;
      startTime: string;
      endTime: string;
      reason?: string;
    }>,
  ): Promise<VenueUnavailableSlotType[]> {
    // 1. 校验场地归属
    const venue = await this.assertVenueOwnership(venueId, managerId);

    // 2. 校验每个时段
    for (const slot of slots) {
      this.validateSlot(slot, venue);
    }

    // 3. 校验与现有 unavailable_slots 不重叠
    await this.validateNoOverlapWithExisting(venueId, slots);

    // 4. 翻场时间处理 + 事务插入
    const turnoverTime = venue.turnoverTime ?? 0;
    const result = await this.dataSource.transaction(async (manager) => {
      const entities: VenueUnavailableSlot[] = [];

      for (const slot of slots) {
        const effectiveEndTime = this.addMinutes(slot.endTime, turnoverTime);
        const endTimeMinutes = this.parseMinutes(slot.endTime);
        const effectiveEndMinutes = this.parseMinutes(effectiveEndTime);

        if (effectiveEndMinutes > endTimeMinutes) {
          // 未跨天（effectiveEndTime 在同一天内）
          entities.push(
            manager.create(VenueUnavailableSlot, {
              venueId,
              slotDate: slot.slotDate,
              startTime: slot.startTime,
              endTime: effectiveEndTime,
              reason: slot.reason ?? null,
            }),
          );
        } else {
          // 跨天：拆分为两条记录
          // 当天部分
          entities.push(
            manager.create(VenueUnavailableSlot, {
              venueId,
              slotDate: slot.slotDate,
              startTime: slot.startTime,
              endTime: '23:59:59',
              reason: slot.reason ?? null,
            }),
          );
          // 次日部分
          const nextDate = this.addDays(slot.slotDate, 1);
          entities.push(
            manager.create(VenueUnavailableSlot, {
              venueId,
              slotDate: nextDate,
              startTime: '00:00:00',
              endTime: effectiveEndTime,
              reason: slot.reason ?? null,
            }),
          );
        }
      }

      return manager.save(VenueUnavailableSlot, entities);
    });

    // 5. 清除缓存
    for (const slot of slots) {
      this.invalidateCache(venueId, slot.slotDate);
    }

    this.logger.log(
      `不可预订时段创建成功: venueId=${venueId}, count=${result.length}, managerId=${managerId}`,
    );

    return result.map((s) => this.toUnavailableSlotType(s));
  }

  // ==================== READ ====================

  /**
   * 查询场地的不可预订时段列表（原始数据，场地方管理用）
   */
  async findUnavailableSlots(
    venueId: number,
    slotDate?: string,
  ): Promise<VenueUnavailableSlotType[]> {
    const where: Record<string, unknown> = { venueId };
    if (slotDate) {
      where.slotDate = slotDate;
    }

    const slots = await this.unavailableRepo.find({
      where,
      order: { slotDate: 'ASC', startTime: 'ASC' },
    });

    return slots.map((s) => this.toUnavailableSlotType(s));
  }

  /**
   * 获取展示时段（核心算法）
   *
   * 根据"不可预订时段 + 已预订时段"生成连续的自然时间展示。
   * 结果覆盖 00:00-24:00，无 gaps。
   *
   * 算法复杂度：O(n log n)，n = unavailable + booked 时段总数
   *
   * @param venueId 场地ID
   * @param slotDate 日期 YYYY-MM-DD
   * @returns 连续时段列表，按时间顺序排列
   */
  async getDisplaySlots(
    venueId: number,
    slotDate: string,
  ): Promise<VenueDisplaySlot[]> {
    // 1. 检查缓存
    const cacheKey = `${venueId}:${slotDate}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // 2. 获取场地信息
    const venue = await this.venueRepo.findOne({
      where: { id: venueId },
      select: ['id', 'openTime', 'closeTime', 'turnoverTime'],
    });
    if (!venue) {
      throw new NotFoundException(`场地不存在: venueId=${venueId}`);
    }

    const openTime = venue.openTime ?? '08:00:00';
    const closeTime = venue.closeTime ?? '22:00:00';

    // 3. 获取 unavailable_slots
    const unavailableSlots = await this.unavailableRepo.find({
      where: { venueId, slotDate },
      order: { startTime: 'ASC' },
    });

    // 4. 获取 booked_slots（已预订的 time_slots）
    const bookedSlots = await this.timeSlotRepo.find({
      where: { venueId, slotDate, isBooked: true },
      order: { startTime: 'ASC' },
    });

    // 5. 合并为 blockedIntervals，标记来源
    interface BlockedInterval {
      start: string;
      end: string;
      type: 'unavailable' | 'booked';
      reason?: string;
    }

    const blockedIntervals: BlockedInterval[] = [];
    for (const slot of unavailableSlots) {
      blockedIntervals.push({
        start: slot.startTime,
        end: slot.endTime,
        type: 'unavailable',
        reason: slot.reason ?? undefined,
      });
    }
    for (const slot of bookedSlots) {
      blockedIntervals.push({
        start: slot.startTime,
        end: slot.endTime,
        type: 'booked',
      });
    }

    // 6. 按开始时间排序，合并重叠区间
    blockedIntervals.sort((a, b) => a.start.localeCompare(b.start));

    const merged: BlockedInterval[] = [];
    for (const interval of blockedIntervals) {
      if (merged.length === 0 || interval.start > merged[merged.length - 1].end) {
        merged.push({ ...interval });
      } else {
        // 重叠：扩展结束时间，类型优先级 booked > unavailable
        const last = merged[merged.length - 1];
        if (interval.end > last.end) {
          last.end = interval.end;
        }
        if (interval.type === 'booked') {
          last.type = 'booked';
          last.reason = undefined; // booked 不显示 reason
        }
      }
    }

    // 7. 生成营业时间内连续区间
    const displaySlots: VenueDisplaySlot[] = [];
    let currentTime = openTime;

    for (const interval of merged) {
      if (currentTime < interval.start) {
        // 可预订区间
        displaySlots.push({
          startTime: currentTime.slice(0, 5), // HH:mm
          endTime: interval.start.slice(0, 5),
          status: 'available',
        });
      }
      // 不可预订区间
      displaySlots.push({
        startTime: (currentTime > interval.start ? currentTime : interval.start).slice(0, 5),
        endTime: interval.end.slice(0, 5),
        status: interval.type,
        reason: interval.reason,
      });
      currentTime = interval.end;
    }

    // 剩余时间到 closeTime
    if (currentTime < closeTime) {
      displaySlots.push({
        startTime: currentTime.slice(0, 5),
        endTime: closeTime.slice(0, 5),
        status: 'available',
      });
    }

    // 8. 非营业时间标记为 unavailable
    if (openTime > '00:00:00') {
      displaySlots.unshift({
        startTime: '00:00',
        endTime: openTime.slice(0, 5),
        status: 'unavailable',
        reason: '非营业时间',
      });
    }
    if (closeTime < '24:00:00') {
      displaySlots.push({
        startTime: closeTime.slice(0, 5),
        endTime: '24:00',
        status: 'unavailable',
        reason: '非营业时间',
      });
    }

    // 9. 写入缓存
    this.cache.set(cacheKey, { data: displaySlots, expiry: Date.now() + this.CACHE_TTL_MS });

    return displaySlots;
  }

  // ==================== DELETE ====================

  /**
   * 删除不可预订时段
   *
   * @throws NotFoundException 时段不存在
   * @throws ForbiddenException 非所属manager
   */
  async deleteUnavailableSlot(
    slotId: number,
    venueId: number,
    managerId: number,
  ): Promise<void> {
    // 校验场地归属
    await this.assertVenueOwnership(venueId, managerId);

    const slot = await this.unavailableRepo.findOne({
      where: { id: slotId, venueId },
    });

    if (!slot) {
      throw new NotFoundException(`不可预订时段不存在: slotId=${slotId}`);
    }

    await this.unavailableRepo.remove(slot);

    // 清除缓存
    this.invalidateCache(venueId, slot.slotDate);

    this.logger.log(
      `不可预订时段删除成功: slotId=${slotId}, venueId=${venueId}, managerId=${managerId}`,
    );
  }

  // ==================== CACHE ====================

  /**
   * 清除指定场地的缓存
   */
  invalidateCache(venueId: number, slotDate: string): void {
    const cacheKey = `${venueId}:${slotDate}`;
    this.cache.delete(cacheKey);
    this.logger.debug(`缓存已清除: ${cacheKey}`);
  }

  /**
   * 清除指定场地的所有日期缓存（用于批量操作）
   */
  invalidateAllCacheForVenue(venueId: number): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${venueId}:`)) {
        this.cache.delete(key);
      }
    }
    this.logger.debug(`场地缓存已清除: venueId=${venueId}`);
  }

  // ==================== Private Helpers ====================

  /**
   * 校验单个时段的合法性
   */
  private validateSlot(
    slot: { slotDate: string; startTime: string; endTime: string },
    venue: Venue,
  ): void {
    // 1. 日期格式
    if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.slotDate)) {
      throw new BadRequestException(`slotDate 格式必须为 YYYY-MM-DD: ${slot.slotDate}`);
    }

    // 2. 时间格式 HH:mm 或 HH:mm:ss
    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
    if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
      throw new BadRequestException('startTime/endTime 格式必须为 HH:mm 或 HH:mm:ss');
    }

    // 3. 开始时间 < 结束时间
    if (slot.startTime >= slot.endTime) {
      throw new BadRequestException(
        `开始时间必须早于结束时间: ${slot.startTime} - ${slot.endTime}`,
      );
    }

    // 4. 分钟数必须是 15 的倍数
    const startMinutes = this.parseMinutes(slot.startTime);
    const endMinutes = this.parseMinutes(slot.endTime);
    if (startMinutes % 15 !== 0 || endMinutes % 15 !== 0) {
      throw new BadRequestException('时间分钟数必须是 15 的倍数（00, 15, 30, 45）');
    }

    // 5. 在营业时间范围内
    const openTime = venue.openTime ?? '08:00:00';
    const closeTime = venue.closeTime ?? '22:00:00';
    if (slot.startTime < openTime || slot.endTime > closeTime) {
      throw new BadRequestException(
        `时段必须在营业时间 ${openTime.slice(0, 5)}-${closeTime.slice(0, 5)} 范围内`,
      );
    }
  }

  /**
   * 校验与现有 unavailable_slots 不重叠
   */
  private async validateNoOverlapWithExisting(
    venueId: number,
    slots: Array<{ slotDate: string; startTime: string; endTime: string }>,
  ): Promise<void> {
    for (const slot of slots) {
      const existing = await this.unavailableRepo.find({
        where: { venueId, slotDate: slot.slotDate },
        order: { startTime: 'ASC' },
      });

      for (const ex of existing) {
        // 重叠判断：start < otherEnd && end > otherStart
        if (slot.startTime < ex.endTime && slot.endTime > ex.startTime) {
          throw new BadRequestException(
            `时段重叠: ${slot.slotDate} ${slot.startTime}-${slot.endTime} 与现有 ${ex.startTime}-${ex.endTime}`,
          );
        }
      }
    }
  }

  /**
   * 断言场地归属权
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
   * 将 HH:mm:ss 时间加上若干分钟
   * @returns 新的时间字符串 HH:mm:ss（可能跨天，如 23:45 + 30min = 00:15）
   */
  private addMinutes(time: string, minutes: number): string {
    const [h, m, s = 0] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * 日期加一天
   */
  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  /**
   * 解析时间为当天分钟数
   */
  private parseMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * 实体转类型
   */
  private toUnavailableSlotType(slot: VenueUnavailableSlot): VenueUnavailableSlotType {
    return {
      id: slot.id,
      venueId: slot.venueId,
      slotDate: slot.slotDate,
      startTime: slot.startTime.slice(0, 5),
      endTime: slot.endTime.slice(0, 5),
      reason: slot.reason ?? undefined,
    };
  }
}
