import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { VenueTimeSlot } from '../entities/venue-time-slot.entity';
import { VenueUnavailableSlot } from '../entities/venue-unavailable-slot.entity';
import { Venue } from '../entities/venue.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { VenueBookingRequest } from '../entities/venue-booking-request.entity';
import { UnavailableSlotService } from './unavailable-slot.service';
import { NotificationService } from '@modules/notifications/services/notification.service';

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
    private readonly unavailableSlotService: UnavailableSlotService,
    private readonly notificationService: NotificationService,
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
    // Step 1: 悲观锁锁定场地当日所有已预订时段记录
    const existingSlots = await manager
      .createQueryBuilder(VenueTimeSlot, 'slot')
      .setLock('pessimistic_write')
      .where('slot.venue_id = :venueId', { venueId })
      .andWhere('slot.slot_date = :slotDate', { slotDate })
      .andWhere('slot.is_booked = :isBooked', { isBooked: true })
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

    // 清除缓存，确保后续查询能获取最新状态
    this.unavailableSlotService.invalidateCache(venueId, slotDate);

    // Step 5: 扫描并取消冲突的 pending_venue 比赛
    await this.cancelConflictingPendingVenueMatches(
      manager,
      venueId,
      slotDate,
      startTime,
      endTime,
      matchId,
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
    // 先查询要释放的 slot，获取 venueId 和 slotDate 用于清除缓存
    const slotToRelease = await manager.findOne(VenueTimeSlot, {
      where: { matchId },
    });

    const result = await manager.delete(VenueTimeSlot, { matchId });

    // 清除缓存
    if (slotToRelease) {
      this.unavailableSlotService.invalidateCache(
        slotToRelease.venueId,
        slotToRelease.slotDate,
      );
    }

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
    // 获取场地营业时间（用于后续检查）
    const venue = await this.venueRepo.findOne({
      where: { id: venueId },
      select: ['openTime', 'closeTime'],
    });
    const openTime = venue?.openTime ?? '08:00:00';
    const closeTime = venue?.closeTime ?? '22:00:00';

    // 首先检查请求时段是否在营业时间内
    // 注意：跨天时段（endTime < startTime）需要特殊处理
    const isWithinBusinessHours = this.isWithinBusinessHours(
      startTime, endTime, openTime, closeTime,
    );
    if (!isWithinBusinessHours) {
      this.logger.warn(
        `Request time outside business hours: venue=${venueId}, ` +
          `time=${startTime}-${endTime}, businessHours=${openTime}-${closeTime}`,
      );
      return false;
    }

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
    //
    // 业务逻辑：场地默认可用时段 = 营业时段 - 已预订时段 - 不可用时段
    // 人工发布的 availableSlots（is_booked=false）仅用于维护、包场等例外设置，
    // 不应限制正常营业时段内的预订。请求时段只需满足：
    // 1. 在营业时段内（Step 1 已检查）
    // 2. 不与已预订时段冲突（Step 2 已检查）
    // 3. 不与不可用时段冲突（Step 3 已检查）
    // 因此，经过 Step 1-3 后，时段即视为可用，无需再检查人工发布的 availableSlots。
    return true;
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
   * 时间格式：HH:mm:ss
   * 重叠条件：start1 < end2 AND start2 < end1
   *
   * 注意：当结束时间为 00:00:00 时，表示第二天的午夜，需要特殊处理。
   * 将时间转换为分钟数进行比较：00:00:00 视为 24:00:00（1440 分钟）。
   *
   * @private
   */
  private timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    let s1 = timeToMinutes(start1);
    let e1 = timeToMinutes(end1);
    let s2 = timeToMinutes(start2);
    let e2 = timeToMinutes(end2);

    // 处理跨天情况：如果结束时间小于开始时间，说明跨到了第二天
    // 将结束时间加上 24 小时（1440 分钟）
    if (e1 < s1) {
      e1 += 24 * 60;
    }
    if (e2 < s2) {
      e2 += 24 * 60;
    }

    // 如果两个时段都跨天，需要调整比较基准
    // 确保所有时间都在同一个 24 小时周期内进行比较
    const normalize = (s: number, e: number): [number, number] => {
      if (e > 24 * 60) {
        // 如果结束时间超过 24 小时，将开始和结束时间都减去 24 小时
        // 但这样可能导致负数，所以使用另一种方法
      }
      return [s, e];
    };

    // 更简单的方法：如果两个时段都跨天，比较它们是否重叠
    // 重叠条件：start1 < end2 AND start2 < end1
    return s1 < e2 && s2 < e1;
  }

  /**
   * 检查请求时段是否在营业时间内。
   *
   * 规则：
   * - 开始时间必须 >= 营业时间开始时间
   * - 结束时间必须 <= 营业时间结束时间
   * - 不允许跨天（结束时间 < 开始时间视为跨天，直接拒绝）
   *
   * @param startTime - 请求开始时间 HH:mm:ss
   * @param endTime - 请求结束时间 HH:mm:ss
   * @param openTime - 营业时间开始 HH:mm:ss
   * @param closeTime - 营业时间结束 HH:mm:ss
   * @returns true 在营业时间内，false 超出营业时间
   */
  private isWithinBusinessHours(
    startTime: string,
    endTime: string,
    openTime: string,
    closeTime: string,
  ): boolean {
    // 不允许跨天时段
    if (endTime < startTime) {
      return false;
    }

    // 开始时间必须 >= 营业时间开始时间
    // 结束时间必须 <= 营业时间结束时间
    return startTime >= openTime && endTime <= closeTime;
  }

  /**
   * 扫描并取消冲突的 pending_venue 比赛。
   *
   * 当某个场地的某个时间段被预定后，扫描同一个场地还在等待确认的所有比赛，
   * 如果时间冲突，取消这些比赛，意向分身退回宇宙中，等待下一次匹配。
   *
   * @param manager - EntityManager（必须在事务内调用）
   * @param venueId - 场地 ID
   * @param slotDate - 日期 YYYY-MM-DD
   * @param startTime - 开始时间 HH:mm:ss
   * @param endTime - 结束时间 HH:mm:ss
   * @param matchId - 当前已预订的比赛 ID（排除自己）
   */
  private async cancelConflictingPendingVenueMatches(
    manager: EntityManager,
    venueId: number,
    slotDate: string,
    startTime: string,
    endTime: string,
    matchId: number,
  ): Promise<void> {
    // 查找同一个场地所有 pending_players 和 pending_venue 状态的比赛（排除当前比赛）
    const pendingMatches = await manager
      .createQueryBuilder(Match, 'match')
      .where('match.venue_id = :venueId', { venueId })
      .andWhere('match.status IN (:...statuses)', { statuses: ['pending_players', 'pending_venue'] })
      .andWhere('match.id != :matchId', { matchId })
      .getMany();

    if (pendingMatches.length === 0) {
      return;
    }

    this.logger.log(
      `Scanning ${pendingMatches.length} pending matches for venue=${venueId} ` +
        `after booking matchId=${matchId}`,
    );

    for (const pendingMatch of pendingMatches) {
      // 将比赛时间转换为 slotDate 和 startTime/endTime 格式
      const matchSlotDate = pendingMatch.startTime.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Shanghai',
      });
      const matchStartTime = pendingMatch.startTime.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const matchEndTime = pendingMatch.endTime.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // 检查日期是否相同且时间冲突
      if (matchSlotDate === slotDate &&
          this.timesOverlap(startTime, endTime, matchStartTime, matchEndTime)) {
        // 冲突，取消比赛
        this.logger.warn(
          `Cancelling conflicting match: matchId=${pendingMatch.id}, ` +
            `venue=${venueId}, date=${slotDate}, ` +
            `time=${matchStartTime}-${matchEndTime} ` +
            `conflicts with booked ${startTime}-${endTime}`,
        );

        // 取消比赛：Match.status → cancelled
        await manager
          .createQueryBuilder()
          .update(Match)
          .set({ status: 'cancelled', cancelledReason: 'venue_unavailable' })
          .where('id = :id', { id: pendingMatch.id })
          .execute();

        // 仅 pending_venue 状态的比赛需要更新 VenueBookingRequest 和释放场地
        if (pendingMatch.status === 'pending_venue') {
          // 更新预订请求状态为 rejected
          await manager
            .createQueryBuilder()
            .update(VenueBookingRequest)
            .set({ status: 'rejected', respondedAt: new Date(), rejectionReason: '场地时段已被其他比赛占用' })
            .where('match_id = :matchId', { matchId: pendingMatch.id })
            .andWhere('status = :status', { status: 'pending' })
            .execute();

          // 释放场地（若已预订）
          await this.releaseSlot(manager, pendingMatch.id);
        }

        // 释放所有 confirmed 球员 + 意向回退
        const confirmedPlayers = await manager.find(MatchPlayer, {
          where: { matchId: pendingMatch.id, status: 'confirmed' },
        });

        for (const player of confirmedPlayers) {
          await manager.update(MatchPlayer, { id: player.id }, { status: 'withdrawn' });

          // 意向回退保护：检查意向是否已在其他比赛 confirmed
          if (player.intentionId) {
            const intention = await manager.findOne(Intention, {
              where: { id: player.intentionId },
            });

            if (intention && intention.status !== 'confirmed') {
              // 意向未在其他比赛 confirmed → 回退 pending
              await manager.update(Intention, { id: player.intentionId }, { status: 'pending' });
            }
          }
        }

        // 发送通知给球员
        const allPlayers = await manager.find(MatchPlayer, {
          where: { matchId: pendingMatch.id },
          select: ['playerId', 'status'],
        });

        const playerIds = allPlayers.map((p) => p.playerId);
        if (playerIds.length > 0) {
          const rows = await manager.query(
            `SELECT id, user_id FROM players WHERE id = ANY($1)`,
            [playerIds],
          );
          const playerIdToUserId = new Map<number, number>();
          for (const row of rows) {
            playerIdToUserId.set(Number(row.id), Number(row.user_id));
          }

          for (const player of allPlayers) {
            const userId = playerIdToUserId.get(player.playerId);
            if (!userId) continue;

            const content =
              player.status === 'confirmed'
                ? '您确认参赛的比赛因场地时段已被其他比赛占用已被取消，保证金将原路退回。'
                : '您受邀参赛的比赛因场地时段已被其他比赛占用已被取消。';

            try {
              await this.notificationService.createNotification({
                userId,
                type: 'match_cancelled',
                title: '比赛因场地冲突已取消',
                content,
                data: { matchId: pendingMatch.id },
                regionCode: pendingMatch.regionCode ?? undefined,
              });
            } catch (notifyErr) {
              this.logger.warn(
                `Failed to notify player ${player.playerId} about cancelled match: ${notifyErr instanceof Error ? notifyErr.message : 'unknown error'}`,
              );
            }
          }
        }

        this.logger.log(
          `Cancelled conflicting match: matchId=${pendingMatch.id}, ` +
            `released ${confirmedPlayers.length} players`,
        );
      }
    }
  }
}
