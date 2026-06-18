import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { VenueTimeSlot } from '../entities/venue-time-slot.entity';
import { VenueUnavailableSlot } from '../entities/venue-unavailable-slot.entity';

/**
 * VenueBookingService — v2.0 场地预订服务。
 *
 * 职责：
 * - 悲观锁预订场地时段（场地方确认或系统自动确认时调用）
 * - 释放已预订时段（比赛取消时）
 * - 乐观可用性检查（匹配引擎预检查，不加锁）
 *
 * 场地时段模型简化（v2.0）：
 * - 仅记录已占用的时段（不预创建空闲记录）
 * - 判断可预订 = 目标时段不与任何已有记录重叠
 * - 预订 = 直接插入 booked slot
 * - 释放 = 删除 booked slot
 * - 不做"时段拆分"
 *
 * 模块归属：放在 venues 模块内，通过接口被 matching 和 matches 模块调用。
 * 导入方向：matching/matches → venues（单向），避免循环依赖。
 */
@Injectable()
export class VenueBookingService {
  private readonly logger = new Logger(VenueBookingService.name);

  constructor(
    @InjectRepository(VenueTimeSlot)
    private readonly slotRepo: Repository<VenueTimeSlot>,
    @InjectRepository(VenueUnavailableSlot)
    private readonly unavailableSlotRepo: Repository<VenueUnavailableSlot>,
  ) {}

  /**
   * 悲观锁预订场地时段。
   *
   * 调用场景：场地方手动确认 或 系统超时自动确认。
   *
   * 逻辑：
   * 1. SELECT FOR UPDATE 锁定场地当日所有时段记录
   * 2. 检查目标时段不与已有 booked slot / unavailable slot 重叠
   * 3. 插入新的 venue_time_slots 记录 (isBooked=true, matchId=X)
   * 4. 返回 true/false
   *
   * @param manager - EntityManager（必须在事务内调用）
   * @param venueId - 场地 ID
   * @param slotDate - 日期 YYYY-MM-DD
   * @param startTime - 开始时间 HH:mm:ss
   * @param endTime - 结束时间 HH:mm:ss
   * @param matchId - 比赛 ID
   * @returns true 预订成功，false 时段冲突
   */
  async bookSlot(
    manager: EntityManager,
    venueId: number,
    slotDate: string,
    startTime: string,
    endTime: string,
    matchId: number,
  ): Promise<boolean> {
    // Step 1: 悲观锁锁定场地当日所有时段记录
    const existingSlots = await manager
      .createQueryBuilder(VenueTimeSlot, 'slot')
      .setLock('pessimistic_write')
      .where('slot.venue_id = :venueId', { venueId })
      .andWhere('slot.slot_date = :slotDate', { slotDate })
      .getMany();

    // Step 2: 检查已预订时段是否重叠
    const hasBookedConflict = existingSlots.some((slot) => {
      // 排除当前比赛的已有记录（重入场景）
      if (slot.matchId === matchId) return false;
      return this.timesOverlap(startTime, endTime, slot.startTime, slot.endTime);
    });

    if (hasBookedConflict) {
      this.logger.warn(
        `Booking conflict: venue=${venueId}, date=${slotDate}, ` +
          `time=${startTime}-${endTime}, matchId=${matchId}`,
      );
      return false;
    }

    // Step 3: 检查不可用时段是否重叠
    const unavailableSlots = await manager
      .createQueryBuilder(VenueUnavailableSlot, 'us')
      .setLock('pessimistic_write')
      .where('us.venue_id = :venueId', { venueId })
      .andWhere('us.slot_date = :slotDate', { slotDate })
      .getMany();

    const hasUnavailableConflict = unavailableSlots.some((slot) =>
      this.timesOverlap(startTime, endTime, slot.startTime, slot.endTime),
    );

    if (hasUnavailableConflict) {
      this.logger.warn(
        `Unavailable conflict: venue=${venueId}, date=${slotDate}, ` +
          `time=${startTime}-${endTime}, matchId=${matchId}`,
      );
      return false;
    }

    // Step 4: 插入新的 booked slot
    const newSlot = manager.create(VenueTimeSlot, {
      venueId,
      slotDate,
      startTime,
      endTime,
      isBooked: true,
      matchId,
    });
    await manager.save(VenueTimeSlot, newSlot);

    this.logger.log(
      `Slot booked: venue=${venueId}, date=${slotDate}, ` +
        `time=${startTime}-${endTime}, matchId=${matchId}`,
    );
    return true;
  }

  /**
   * 释放已预订时段（比赛取消时调用）。
   *
   * 逻辑：删除 matchId 对应的 booked slot 记录。
   * 若不存在不报错（幂等性）。
   *
   * @param manager - EntityManager（必须在事务内调用）
   * @param matchId - 比赛 ID
   */
  async releaseSlot(
    manager: EntityManager,
    matchId: number,
  ): Promise<void> {
    const result = await manager.delete(VenueTimeSlot, { matchId });

    this.logger.log(
      `Slot released: matchId=${matchId}, affected=${result.affected ?? 0}`,
    );
  }

  /**
   * 乐观可用性检查（匹配引擎预检查，不加锁）。
   *
   * 调用场景：匹配引擎在创建候选比赛前，乐观检查场地时段是否可用。
   * 注意：这是乐观检查，匹配阶段允许少量误判。
   * 精确锁定推迟到场地方确认阶段的 bookSlot。
   *
   * @param venueId - 场地 ID
   * @param slotDate - 日期 YYYY-MM-DD
   * @param startTime - 开始时间 HH:mm:ss
   * @param endTime - 结束时间 HH:mm:ss
   * @returns true 时段可用（无冲突），false 时段已被占用
   */
  async checkAvailability(
    venueId: number,
    slotDate: string,
    startTime: string,
    endTime: string,
  ): Promise<boolean> {
    // 检查已预订时段
    const bookedSlots = await this.slotRepo
      .createQueryBuilder('slot')
      .where('slot.venue_id = :venueId', { venueId })
      .andWhere('slot.slot_date = :slotDate', { slotDate })
      .getMany();

    const hasBookedConflict = bookedSlots.some((slot) =>
      this.timesOverlap(startTime, endTime, slot.startTime, slot.endTime),
    );

    if (hasBookedConflict) return false;

    // 检查不可用时段
    const unavailableSlots = await this.unavailableSlotRepo
      .createQueryBuilder('us')
      .where('us.venue_id = :venueId', { venueId })
      .andWhere('us.slot_date = :slotDate', { slotDate })
      .getMany();

    const hasUnavailableConflict = unavailableSlots.some((slot) =>
      this.timesOverlap(startTime, endTime, slot.startTime, slot.endTime),
    );

    return !hasUnavailableConflict;
  }

  /**
   * 判断两个时间段是否重叠。
   *
   * 时间格式：HH:mm:ss（字符串比较即可，因为格式统一）
   * 重叠条件：start1 < end2 AND start2 < end1
   *
   * @private
   */
  private timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    return start1 < end2 && start2 < end1;
  }
}
