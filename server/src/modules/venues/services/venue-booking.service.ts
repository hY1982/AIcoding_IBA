import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { VenueTimeSlot } from '../entities/venue-time-slot.entity';
import { VenueUnavailableSlot } from '../entities/venue-unavailable-slot.entity';
import { Venue } from '../entities/venue.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';

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
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
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
   * v2.2 修复：支持子时段匹配。请求时段被包含在可用时段内即视为可用。
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
    // 检查已预订时段：请求时段与已预订时段重叠则不可用
    const bookedSlots = await this.slotRepo
      .createQueryBuilder('slot')
      .where('slot.venue_id = :venueId', { venueId })
      .andWhere('slot.slot_date = :slotDate', { slotDate })
      .andWhere('slot.is_booked = true')
      .getMany();

    const hasBookedConflict = bookedSlots.some((slot) =>
      this.timesOverlap(startTime, endTime, slot.startTime, slot.endTime),
    );

    if (hasBookedConflict) return false;

    // 检查不可用时段：请求时段与不可用时段重叠则不可用
    const unavailableSlots = await this.unavailableSlotRepo
      .createQueryBuilder('us')
      .where('us.venue_id = :venueId', { venueId })
      .andWhere('us.slot_date = :slotDate', { slotDate })
      .getMany();

    const hasUnavailableConflict = unavailableSlots.some((slot) =>
      this.timesOverlap(startTime, endTime, slot.startTime, slot.endTime),
    );

    if (hasUnavailableConflict) return false;

    // v2.2: 检查请求时段是否被包含在可用时段内
    // 查询该场地当日所有未预订的可用时段
    const availableSlots = await this.slotRepo
      .createQueryBuilder('slot')
      .where('slot.venue_id = :venueId', { venueId })
      .andWhere('slot.slot_date = :slotDate', { slotDate })
      .andWhere('slot.is_booked = false')
      .orderBy('slot.start_time', 'ASC')
      .getMany();

    // 合并连续的可用时段，然后检查请求时段是否被完全覆盖
    if (availableSlots.length === 0) {
      // 无可用时段记录时，回退到场地默认营业时间
      const venue = await this.venueRepo.findOne({
        where: { id: venueId },
        select: ['openTime', 'closeTime'],
      });
      const openTime = venue?.openTime ?? '08:00:00';
      const closeTime = venue?.closeTime ?? '22:00:00';
      return startTime >= openTime && endTime <= closeTime;
    }

    // 按开始时间排序并合并连续时段
    const sortedSlots = [...availableSlots].sort((a, b) => 
      a.startTime.localeCompare(b.startTime)
    );
    
    const mergedSlots: typeof sortedSlots = [];
    for (const slot of sortedSlots) {
      if (mergedSlots.length === 0 || slot.startTime >= mergedSlots[mergedSlots.length - 1].endTime) {
        mergedSlots.push(slot);
      } else {
        // 连续或重叠，扩展结束时间
        const last = mergedSlots[mergedSlots.length - 1];
        if (slot.endTime > last.endTime) {
          last.endTime = slot.endTime;
        }
      }
    }

    // 请求时段必须被至少一个合并后的可用时段完全包含
    const isContained = mergedSlots.some((slot) =>
      slot.startTime <= startTime && slot.endTime >= endTime,
    );

    return isContained;
  }

  /**
   * v2.2: 场地时段屏蔽 — 当场地被预订后，屏蔽与该时段冲突的 pending 意向。
   *
   * 逻辑：
   * 1. 查询所有 pending 且未被屏蔽的意向
   * 2. 筛选 venueId 匹配且时间窗口与 [slotStart, slotEnd] 重叠的意向
   * 3. 设置 excludedUntil = slotEnd（屏蔽到时段结束）
   * 4. 若意向的所有分身都被屏蔽 → 通知用户"该时段场地已被预订"
   *
   * @param venueId - 场地 ID
   * @param slotStart - 屏蔽时段开始时间
   * @param slotEnd - 屏蔽时段结束时间
   * @returns 被屏蔽的意向数量
   */
  async excludeAvatars(
    manager: EntityManager,
    venueId: number,
    slotStart: Date,
    slotEnd: Date,
  ): Promise<number> {
    // 查询所有 pending 且未被屏蔽（或屏蔽已过期）的意向
    const intentions = await manager.find(Intention, {
      where: [
        { status: 'pending', excludedUntil: IsNull() },
        { status: 'pending', excludedUntil: LessThanOrEqual(new Date()) },
      ],
      relations: ['intentionVenues'],
    });

    let excludedCount = 0;

    for (const intention of intentions) {
      // 检查该意向是否包含目标场地
      const hasVenue = intention.intentionVenues?.some(
        (iv) => iv.venueId === venueId,
      );
      if (!hasVenue) continue;

      // 检查时间窗口是否重叠
      // 意向时间窗口: [startTime, startTime + acceptableWaitMinutes]
      const windowEnd = new Date(
        intention.startTime.getTime() + intention.acceptableWaitMinutes * 60 * 1000,
      );

      const overlaps =
        intention.startTime < slotEnd && slotStart < windowEnd;

      if (overlaps) {
        // 设置屏蔽截止时间 = max(当前屏蔽, slotEnd)
        const newExcludedUntil = intention.excludedUntil && intention.excludedUntil > slotEnd
          ? intention.excludedUntil
          : slotEnd;

        await manager.update(
          Intention,
          { id: intention.id },
          { excludedUntil: newExcludedUntil },
        );

        excludedCount++;
        this.logger.log(
          `Intention excluded: intentionId=${intention.id}, venueId=${venueId}, ` +
            `excludedUntil=${newExcludedUntil.toISOString()}`,
        );
      }
    }

    this.logger.log(
      `Venue exclusion completed: venueId=${venueId}, excludedIntentions=${excludedCount}`,
    );

    return excludedCount;
  }

  /**
   * v2.2: 解除场地屏蔽 — 当预订取消后，恢复被屏蔽的意向。
   *
   * 逻辑：
   * 1. 查询所有 excludedUntil >= slotStart 的意向
   * 2. 检查该意向是否仍与其他已预订时段冲突
   * 3. 若无冲突 → 清除 excludedUntil
   *
   * @param venueId - 场地 ID
   * @param slotStart - 原屏蔽时段开始时间
   * @param slotEnd - 原屏蔽时段结束时间
   * @returns 解除屏蔽的意向数量
   */
  async releaseExcludedAvatars(
    manager: EntityManager,
    venueId: number,
    slotStart: Date,
    slotEnd: Date,
  ): Promise<number> {
    // 查询所有被屏蔽且包含该场地的意向
    const intentions = await manager.find(Intention, {
      where: {
        status: 'pending',
        excludedUntil: MoreThanOrEqual(slotStart),
      },
      relations: ['intentionVenues'],
    });

    let releasedCount = 0;

    for (const intention of intentions) {
      const hasVenue = intention.intentionVenues?.some(
        (iv) => iv.venueId === venueId,
      );
      if (!hasVenue) continue;

      // 检查该意向是否仍与其他已预订时段冲突
      const windowEnd = new Date(
        intention.startTime.getTime() + intention.acceptableWaitMinutes * 60 * 1000,
      );

      // 查询该场地在意向时间窗口内的其他已预订时段
      const otherBookedSlots = await manager
        .createQueryBuilder(VenueTimeSlot, 'slot')
        .where('slot.venue_id = :venueId', { venueId })
        .andWhere('slot.is_booked = true')
        .andWhere('slot.start_time < :windowEnd', { windowEnd: windowEnd.toISOString() })
        .andWhere('slot.end_time > :startTime', { startTime: intention.startTime.toISOString() })
        .getMany();

      const stillConflicts = otherBookedSlots.some((slot) => {
        const slotStartTime = new Date(slot.startTime);
        const slotEndTime = new Date(slot.endTime);
        return intention.startTime < slotEndTime && slotStartTime < windowEnd;
      });

      if (!stillConflicts) {
        await manager.update(
          Intention,
          { id: intention.id },
          { excludedUntil: null },
        );

        releasedCount++;
        this.logger.log(
          `Intention exclusion released: intentionId=${intention.id}, venueId=${venueId}`,
        );
      }
    }

    this.logger.log(
      `Venue exclusion release completed: venueId=${venueId}, releasedIntentions=${releasedCount}`,
    );

    return releasedCount;
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
