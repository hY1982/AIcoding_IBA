import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager, LessThan } from 'typeorm';
import { Match } from '../entities/match.entity';
import { MatchPlayer } from '../entities/match-player.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { VenueBookingRequest } from '@modules/venues/entities/venue-booking-request.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { NotificationService } from '@modules/notifications/services/notification.service';
import { VenueBookingService } from '@modules/venues/services/venue-booking.service';
import {
  PaymentProviderInterface,
  PAYMENT_PROVIDER,
  PaymentCallbackInput,
} from '@modules/payments/interfaces/payment-provider.interface';
import {
  GroupChatProviderInterface,
  GROUP_CHAT_PROVIDER,
} from '../interfaces/group-chat-provider.interface';
import { MatchStatus, MatchPlayerStatus } from '@shared/match';
import { TeamBalancerService } from '@modules/matching/services/team-balancer.service';

/**
 * 自定义异常：球员已确认参赛（幂等性场景）
 */
export class AlreadyConfirmedException extends ConflictException {
  constructor() {
    super('已确认参赛');
  }
}

export interface ConfirmParticipationResult {
  success: boolean;
  matchId: number;
  playerId: number;
  orderNo: string;
  status: MatchPlayerStatus;
  matchStatus: MatchStatus;
  message: string;
}

export interface FinalizeMatchResult {
  matchId: number;
  status: MatchStatus;
  confirmedPlayers: number;
  requiredPlayers: number;
  groupChatId?: string;
}

export interface BatchFinalizeResult {
  processed: number;
  confirmed: number;
  failed: number;
}

/**
 * Match Confirmation Service — v2.0 二阶段确认 + Saga支付
 *
 * 完整比赛确认生命周期：
 *
 * **阶段一：球员确认（先到先得）**
 * - Saga支付模式：事务外支付 → 事务内状态变更 → 事务失败补偿退款
 * - 确认后释放其他比赛邀请
 * - 满员触发场地确认流程
 *
 * **阶段二：场地方确认**
 * - 创建 VenueBookingRequest（30分钟响应窗口）
 * - 场地方手动确认 → 悲观锁预订 → 分队 → 通知
 * - 场地方拒绝 → 释放球员（意向回退保护）→ 退款
 * - 30分钟超时 → 自动尝试预订 → 成功/失败
 *
 * 并发安全：
 * - Match 行悲观锁 (SELECT FOR UPDATE)
 * - 支付在事务外执行（避免持锁期间调用外部服务）
 * - 事务失败触发 Saga 补偿退款
 */
@Injectable()
export class MatchConfirmationService {
  private readonly logger = new Logger(MatchConfirmationService.name);
  private readonly VENUE_CONFIRM_MINUTES = 30;

  constructor(
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    @InjectRepository(MatchPlayer)
    private readonly matchPlayerRepo: Repository<MatchPlayer>,
    @InjectRepository(VenueTimeSlot)
    private readonly slotRepo: Repository<VenueTimeSlot>,
    @InjectRepository(VenueBookingRequest)
    private readonly bookingRequestRepo: Repository<VenueBookingRequest>,
    @InjectRepository(Intention)
    private readonly intentionRepo: Repository<Intention>,
    private readonly notificationService: NotificationService,
    @InjectRepository(Format)
    private readonly formatRepo: Repository<Format>,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentService: PaymentProviderInterface,
    @Inject(GROUP_CHAT_PROVIDER)
    private readonly groupChatService: GroupChatProviderInterface,
    private readonly venueBookingService: VenueBookingService,
    private readonly teamBalancer: TeamBalancerService,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== PLAYER CONFIRMATION (Saga Pattern) ====================

  /**
   * 球员确认参赛 — v2.0 Saga支付模式。
   *
   * Flow:
   * 1. 【验证】悲观锁 Match → 校验 pending_players 且 confirmedPlayers < requiredPlayers
   * 2. 【Saga Step 1】事务外支付（调用 PaymentProvider）
   * 3. 【Saga Step 2】事务内：
   *    a. MatchPlayer → confirmed, depositPaid=true
   *    b. Match.confirmedPlayers++
   *    c. 该球员在其他候选比赛中的 MatchPlayer → withdrawn
   *    d. 意向状态 → confirmed
   * 4. 事务失败 → 【Saga 补偿】PaymentProvider.refund(orderNo)
   * 5. 检查满员 → 触发场地确认流程
   */
  async confirmParticipation(
    matchId: number,
    playerId: number,
  ): Promise<ConfirmParticipationResult> {
    // Step 1: 【事务外】校验 + 创建支付订单（避免在悲观锁期间执行外部 I/O）
    // 1a. 读取 Match 快照数据（不加锁，仅用于创建订单）
    const matchSnapshot = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!matchSnapshot) {
      throw new NotFoundException(`比赛不存在: matchId=${matchId}`);
    }

    const matchPlayerSnapshot = await this.matchPlayerRepo.findOne({
      where: { matchId, playerId },
    });
    if (!matchPlayerSnapshot) {
      throw new NotFoundException(
        `球员未受邀参赛: matchId=${matchId}, playerId=${playerId}`,
      );
    }

    this.assertCanConfirm(matchSnapshot, matchPlayerSnapshot);

    if (matchSnapshot.confirmedPlayers >= matchSnapshot.requiredPlayers) {
      throw new ConflictException('比赛已满员');
    }

    const depositAmount = matchSnapshot.depositAmount;
    const intentionId = matchPlayerSnapshot.intentionId;

    // 1b. 【事务外】创建支付订单（外部 I/O，不在悲观锁内）
    const orderResult = await this.paymentService.createOrder({
      matchId,
      playerId,
      amount: depositAmount,
      description: `比赛保证金 matchId=${matchId}`,
    });
    const orderNo = orderResult.orderNo;

    // Step 2: 【Saga Step 1】事务外支付
    const paymentResult = await this.paymentService.processPayment(orderNo);

    if (!paymentResult.success) {
      throw new BadRequestException(`支付失败: ${paymentResult.errorMessage}`);
    }

    // Step 3: 【Saga Step 2】事务内状态变更（悲观锁）
    try {
      return await this.dataSource.transaction(async (manager) => {
        // 悲观锁读取最新状态
        const match = await manager
          .createQueryBuilder(Match, 'match')
          .setLock('pessimistic_write')
          .where('match.id = :matchId', { matchId })
          .getOne();

        if (!match) {
          throw new NotFoundException(`比赛不存在: matchId=${matchId}`);
        }

        // 再次校验（可能在支付期间状态已变化）
        const matchPlayer = await manager.findOne(MatchPlayer, {
          where: { matchId, playerId },
        });
        if (!matchPlayer) {
          throw new NotFoundException(
            `球员未受邀参赛: matchId=${matchId}, playerId=${playerId}`,
          );
        }

        // 再次检查满员（可能在支付期间其他球员已确认）
        if (match.confirmedPlayers >= match.requiredPlayers) {
          await this.compensatePayment(orderNo, depositAmount);
          throw new ConflictException('比赛已满员，已自动退款');
        }

        // 保存 orderNo 到 MatchPlayer
        await manager.update(
          MatchPlayer,
          { matchId, playerId },
          { depositOrderNo: orderNo },
        );

        // a. 更新 MatchPlayer → confirmed
        const updateResult = await manager
          .createQueryBuilder()
          .update(MatchPlayer)
          .set({
            status: 'confirmed',
            depositPaid: true,
            confirmedAt: new Date(),
          })
          .where('match_id = :matchId', { matchId })
          .andWhere('player_id = :playerId', { playerId })
          .andWhere('status = :status', { status: 'invited' })
          .execute();

        if (updateResult.affected === 0) {
          // 状态已被其他操作修改 → Saga 补偿退款
          await this.compensatePayment(orderNo, depositAmount);
          throw new ConflictException('球员状态已被修改，已自动退款');
        }

        // b. Match.confirmedPlayers++
        const newConfirmedCount = match.confirmedPlayers + 1;
        await manager
          .createQueryBuilder()
          .update(Match)
          .set({ confirmedPlayers: newConfirmedCount })
          .where('id = :id', { id: matchId })
          .execute();

        // c. 释放该球员在其他候选比赛中的邀请
        await this.withdrawFromOtherMatches(manager, playerId, matchId);

        // d. 更新意向状态 → confirmed
        if (intentionId) {
          await manager.update(
            Intention,
            { id: intentionId, status: 'pending' },
            { status: 'confirmed' },
          );
        }

        // 检查满员 → 触发场地确认
        const isFull = newConfirmedCount >= match.requiredPlayers;
        if (isFull) {
          await this.triggerVenueConfirmation(manager, match);
        }

        const message = isFull
          ? '确认参赛成功，比赛已满员，等待场地方确认'
          : '确认参赛成功，等待其他球员确认';

        this.logger.log(
          `Player confirmed (Saga): matchId=${matchId}, playerId=${playerId}, orderNo=${orderNo}, full=${isFull}`,
        );

        return {
          success: true,
          matchId,
          playerId,
          orderNo,
          status: 'confirmed',
          matchStatus: isFull ? 'pending_venue' : 'pending_players',
          message,
        };
      });
    } catch (error) {
      // 如果错误不是我们主动抛出的（说明事务异常）→ Saga 补偿退款
      if (
        !(error instanceof ConflictException) &&
        !(error instanceof NotFoundException) &&
        !(error instanceof BadRequestException)
      ) {
        this.logger.error(
          `Transaction failed, triggering Saga compensation: matchId=${matchId}, playerId=${playerId}, orderNo=${orderNo}`,
        );
        await this.compensatePayment(orderNo, depositAmount);
      }
      throw error;
    }
  }

  /**
   * Saga 补偿：退款
   *
   * 事务失败时调用，退款失败记录异常日志 + 告警，人工介入。
   */
  private async compensatePayment(
    orderNo: string,
    amount: string,
  ): Promise<void> {
    try {
      if (this.paymentService.refund) {
        await this.paymentService.refund(orderNo);
        this.logger.log(`Saga compensation refund success: orderNo=${orderNo}`);
      } else {
        this.logger.warn(
          `PaymentProvider.refund not implemented, manual intervention needed: orderNo=${orderNo}, amount=${amount}`,
        );
      }
    } catch (refundError) {
      this.logger.error(
        `Saga compensation refund FAILED: orderNo=${orderNo}, amount=${amount}, ` +
          `error=${(refundError as Error).message}. MANUAL INTERVENTION REQUIRED.`,
      );
    }
  }

  /**
   * 释放球员在其他候选比赛中的邀请（v2.0）。
   *
   * 球员确认某个比赛后，其在其他 pending_players 状态比赛中的邀请变为 withdrawn。
   */
  private async withdrawFromOtherMatches(
    manager: EntityManager,
    playerId: number,
    currentMatchId: number,
  ): Promise<void> {
    const result = await manager
      .createQueryBuilder()
      .update(MatchPlayer)
      .set({ status: 'withdrawn' })
      .where('player_id = :playerId', { playerId })
      .andWhere('status = :status', { status: 'invited' })
      .andWhere('match_id != :currentMatchId', { currentMatchId })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(
        `Player withdrawn from ${result.affected} other match(es): playerId=${playerId}`,
      );
    }
  }

  // ==================== VENUE CONFIRMATION (Stage 2) ====================

  /**
   * 满员后触发场地确认流程（v2.0）。
   *
   * 1. Match.status → 'pending_venue'
   * 2. 创建 VenueBookingRequest (status='pending', deadline=now+30min)
   * 3. 通知场地方
   * 4. 通知未确认球员：比赛已满员，MatchPlayer 改 withdrawn，意向回 pending
   */
  private async triggerVenueConfirmation(
    manager: EntityManager,
    match: Match,
  ): Promise<void> {
    const now = new Date();
    const responseDeadline = new Date(
      now.getTime() + this.VENUE_CONFIRM_MINUTES * 60 * 1000,
    );

    // 1. 更新 Match 状态
    await manager
      .createQueryBuilder()
      .update(Match)
      .set({
        status: 'pending_venue',
        venueConfirmDeadline: responseDeadline,
      })
      .where('id = :id', { id: match.id })
      .execute();

    // 2. 创建 VenueBookingRequest
    const slotDate = match.startTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    const startTimeStr = match.startTime.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Shanghai', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const endTimeStr = match.endTime.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Shanghai', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    const bookingRequest = manager.create(VenueBookingRequest, {
      matchId: match.id,
      venueId: match.venueId,
      slotDate,
      startTime: startTimeStr,
      endTime: endTimeStr,
      status: 'pending',
      requestedAt: now,
      responseDeadline,
    });
    await manager.save(VenueBookingRequest, bookingRequest);

    // 3. 通知未确认的被邀请球员：已满员
    await this.notifyUnconfirmedPlayersFull(manager, match);

    this.logger.log(
      `Venue confirmation triggered: matchId=${match.id}, deadline=${responseDeadline.toISOString()}`,
    );
  }

  /**
   * 通知未确认的被邀请球员：比赛已满员。
   * 其 MatchPlayer 改 withdrawn，意向回 pending。
   */
  private async notifyUnconfirmedPlayersFull(
    manager: EntityManager,
    match: Match,
  ): Promise<void> {
    const unconfirmedPlayers = await manager.find(MatchPlayer, {
      where: { matchId: match.id, status: 'invited' },
    });

    for (const player of unconfirmedPlayers) {
      await manager.update(MatchPlayer, { id: player.id }, { status: 'withdrawn' });

      // 意向回退 pending（仅当意向仍为 pending 时）
      if (player.intentionId) {
        await manager.update(
          Intention,
          { id: player.intentionId, status: 'pending' },
          { status: 'pending' }, // 保持 pending
        );
      }
    }

    if (unconfirmedPlayers.length > 0) {
      this.logger.log(
        `Notified ${unconfirmedPlayers.length} unconfirmed players: matchId=${match.id} is full`,
      );
    }
  }

  /**
   * 场地方确认预订（v2.0）。
   *
   * 1. VenueBookingService.bookSlot（悲观锁）
   * 2. Match.status → 'confirmed'
   * 3. 分队（蛇形选秀）
   * 4. 创建群聊
   * 5. 通知球员
   */
  async confirmVenueBooking(
    matchId: number,
    bookingRequestId: number,
  ): Promise<{ success: boolean; message: string }> {
    return this.dataSource.transaction(async (manager) => {
      const match = await manager
        .createQueryBuilder(Match, 'match')
        .setLock('pessimistic_write')
        .where('match.id = :matchId', { matchId })
        .getOne();

      if (!match || match.status !== 'pending_venue') {
        throw new ConflictException('比赛状态不允许场地确认');
      }

      const bookingRequest = await manager.findOne(VenueBookingRequest, {
        where: { id: bookingRequestId, matchId },
      });

      if (!bookingRequest || bookingRequest.status !== 'pending') {
        throw new ConflictException('预订请求状态不允许确认');
      }

      // 1. 悲观锁预订场地
      const booked = await this.venueBookingService.bookSlot(
        manager,
        match.venueId,
        bookingRequest.slotDate,
        bookingRequest.startTime,
        bookingRequest.endTime,
        matchId,
      );

      if (!booked) {
        // 场地已被占 → cancelled
        return this.handleVenueRejection(manager, match, bookingRequest, '场地时段已被占用');
      }

      // 2. 更新预订请求状态
      await manager.update(VenueBookingRequest, { id: bookingRequestId }, {
        status: 'confirmed',
        respondedAt: new Date(),
      });

      // 3. 确认比赛
      return this.confirmMatchAfterVenue(manager, match);
    });
  }

  /**
   * 场地方拒绝预订（v2.0）。
   *
   * Match.status → cancelled → 释放球员（意向回退保护）→ 退款
   */
  async rejectVenueBooking(
    matchId: number,
    bookingRequestId: number,
    rejectionReason: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.dataSource.transaction(async (manager) => {
      const match = await manager
        .createQueryBuilder(Match, 'match')
        .setLock('pessimistic_write')
        .where('match.id = :matchId', { matchId })
        .getOne();

      if (!match || match.status !== 'pending_venue') {
        throw new ConflictException('比赛状态不允许场地操作');
      }

      const bookingRequest = await manager.findOne(VenueBookingRequest, {
        where: { id: bookingRequestId, matchId },
      });

      if (!bookingRequest || bookingRequest.status !== 'pending') {
        throw new ConflictException('预订请求状态不允许操作');
      }

      return this.handleVenueRejection(manager, match, bookingRequest, rejectionReason);
    });
  }

  /**
   * 系统自动确认场地预订（超时调度器调用）。
   *
   * 与 confirmVenueBooking 类似，但不要求传入 bookingRequestId，
   * 自动查找该比赛的 pending 预订请求。
   *
   * - 预订成功 → confirmed + 分队 + 通知
   * - 预订失败（时段已被占）→ cancelled + 释放球员 + 退款
   */
  async autoConfirmVenueBooking(
    matchId: number,
  ): Promise<{ success: boolean; message: string }> {
    return this.dataSource.transaction(async (manager) => {
      const match = await manager
        .createQueryBuilder(Match, 'match')
        .setLock('pessimistic_write')
        .where('match.id = :matchId', { matchId })
        .getOne();

      if (!match || match.status !== 'pending_venue') {
        return { success: false, message: '比赛状态不允许自动确认' };
      }

      const bookingRequest = await manager.findOne(VenueBookingRequest, {
        where: { matchId, status: 'pending' },
      });

      if (!bookingRequest) {
        return { success: false, message: '无待处理的预订请求' };
      }

      // 尝试悲观锁预订场地
      const booked = await this.venueBookingService.bookSlot(
        manager,
        match.venueId,
        bookingRequest.slotDate,
        bookingRequest.startTime,
        bookingRequest.endTime,
        matchId,
      );

      if (!booked) {
        return this.handleVenueRejection(
          manager, match, bookingRequest, '场地时段已被占用（系统自动处理）',
        );
      }

      // 更新预订请求状态为 auto_confirmed
      await manager.update(VenueBookingRequest, { id: bookingRequest.id }, {
        status: 'auto_confirmed',
        respondedAt: new Date(),
      });

      return this.confirmMatchAfterVenue(manager, match);
    });
  }

  /**
   * 处理场地方拒绝/场地不可用。
   *
   * - Match.status → cancelled
   * - 释放所有 confirmed 球员（意向回退保护）
   * - 退款
   */
  private async handleVenueRejection(
    manager: EntityManager,
    match: Match,
    bookingRequest: VenueBookingRequest,
    reason: string,
  ): Promise<{ success: boolean; message: string }> {
    // 更新预订请求
    await manager.update(VenueBookingRequest, { id: bookingRequest.id }, {
      status: 'rejected',
      respondedAt: new Date(),
      rejectionReason: reason,
    });

    // Match → cancelled
    await manager
      .createQueryBuilder()
      .update(Match)
      .set({ status: 'cancelled' })
      .where('id = :id', { id: match.id })
      .execute();

    // 释放所有 confirmed 球员 + 意向回退保护
    const confirmedPlayers = await manager.find(MatchPlayer, {
      where: { matchId: match.id, status: 'confirmed' },
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
        // 若意向已是 confirmed（球员已确认其他比赛）→ 不回退意向，仅 withdrawn MatchPlayer

      }

      // 退款
      if (player.depositOrderNo) {
        await this.compensatePayment(player.depositOrderNo, match.depositAmount);
      }
    }

    this.logger.log(
      `Venue rejected: matchId=${match.id}, reason=${reason}, released ${confirmedPlayers.length} players`,
    );

    return { success: true, message: `场地已拒绝: ${reason}` };
  }

  /**
   * 场地确认后完成比赛确认。
   *
   * - Match.status → confirmed
   * - 蛇形分队
   * - 创建群聊
   * - 通知球员
   */
  private async confirmMatchAfterVenue(
    manager: EntityManager,
    match: Match,
  ): Promise<{ success: boolean; message: string }> {
    // 获取赛制信息用于分队
    const format = await manager.findOne(Format, { where: { id: match.formatId } });
    if (!format) {
      throw new InternalServerErrorException(`赛制不存在: formatId=${match.formatId}`);
    }

    // 获取已确认球员用于分队
    const confirmedPlayers = await manager.find(MatchPlayer, {
      where: { matchId: match.id, status: 'confirmed' },
    });

    // 蛇形分队
    const playerPicks = confirmedPlayers.map((p) => ({
      id: p.playerId,
      totalAbilityScore: 50, // TODO: 从 Player 表获取真实能力值
    }));

    if (playerPicks.length > 0 && format) {
      const teams = this.teamBalancer.snakeDraft({ players: playerPicks, format });
      // 更新 MatchPlayer 的 teamNumber
      for (const team of teams) {
        for (const player of team.players) {
          await manager.update(
            MatchPlayer,
            { matchId: match.id, playerId: player.id },
            { teamNumber: team.teamNumber },
          );
        }
      }
    }

    // 创建群聊
    const groupChatId = await this.createGroupChatForMatch(manager, match);

    // 更新 Match → confirmed
    await manager
      .createQueryBuilder()
      .update(Match)
      .set({
        status: 'confirmed',
        groupChatId,
      })
      .where('id = :id', { id: match.id })
      .execute();

    // 通知
    await this.notifyMatchConfirmed(match, confirmedPlayers.length);

    this.logger.log(
      `Match confirmed after venue approval: matchId=${match.id}, players=${confirmedPlayers.length}`,
    );

    return { success: true, message: '场地已确认，比赛正式生效' };
  }

  // ==================== PLAYER DECLINE ====================

  /**
   * Player declines participation.
   */
  async declineParticipation(matchId: number, playerId: number): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const match = await manager
        .createQueryBuilder(Match, 'match')
        .setLock('pessimistic_write')
        .where('match.id = :matchId', { matchId })
        .getOne();

      if (!match) {
        throw new NotFoundException(`比赛不存在: matchId=${matchId}`);
      }

      if (match.status !== 'pending_players') {
        throw new ConflictException(`比赛状态为 ${match.status}，不可拒绝参赛`);
      }

      const matchPlayer = await manager.findOne(MatchPlayer, {
        where: { matchId, playerId },
      });

      if (!matchPlayer) {
        throw new NotFoundException(
          `球员未受邀参赛: matchId=${matchId}, playerId=${playerId}`,
        );
      }

      if (matchPlayer.status !== 'invited') {
        throw new ConflictException(
          `当前状态为 ${matchPlayer.status}，无法拒绝参赛`,
        );
      }

      await manager.update(
        MatchPlayer,
        { matchId, playerId },
        { status: 'withdrawn' },
      );

      this.logger.log(
        `Player declined: matchId=${matchId}, playerId=${playerId}`,
      );
    });
  }

  // ==================== PAYMENT CALLBACK ====================

  /**
   * Handle payment callback from third-party provider.
   */
  async handlePaymentCallback(
    dto: PaymentCallbackInput,
  ): Promise<{ success: boolean; message: string }> {
    const callbackResult = await this.paymentService.handleCallback(dto);

    if (!callbackResult.success && !callbackResult.processed) {
      return { success: false, message: callbackResult.message };
    }

    if (callbackResult.processed && dto.status === 'success') {
      await this.dataSource.transaction(async (manager) => {
        const matchPlayer = await manager.findOne(MatchPlayer, {
          where: { depositOrderNo: dto.orderNo },
        });

        if (!matchPlayer) {
          this.logger.warn(`MatchPlayer not found for orderNo=${dto.orderNo}`);
          return;
        }

        if (!matchPlayer.depositPaid) {
          // 悲观锁读取 Match 最新状态
          const match = await manager
            .createQueryBuilder(Match, 'match')
            .setLock('pessimistic_write')
            .where('match.id = :matchId', { matchId: matchPlayer.matchId })
            .getOne();

          if (!match || match.status !== 'pending_players') {
            this.logger.warn(
              `Payment callback skipped: match ${matchPlayer.matchId} status=${match?.status ?? 'not found'}`,
            );
            return;
          }

          // 再次检查满员（可能在回调期间其他球员已确认）
          if (match.confirmedPlayers >= match.requiredPlayers) {
            this.logger.warn(
              `Payment callback skipped: match ${match.id} already full`,
            );
            return;
          }

          // 更新 MatchPlayer → confirmed
          await manager.update(
            MatchPlayer,
            { id: matchPlayer.id },
            { depositPaid: true, status: 'confirmed', confirmedAt: new Date() },
          );

          // confirmedPlayers++
          const newCount = match.confirmedPlayers + 1;
          await manager.update(Match, { id: match.id }, { confirmedPlayers: newCount });

          // 释放该球员在其他候选比赛中的邀请
          await this.withdrawFromOtherMatches(manager, matchPlayer.playerId, match.id);

          // 更新意向状态 → confirmed
          if (matchPlayer.intentionId) {
            await manager.update(
              Intention,
              { id: matchPlayer.intentionId, status: 'pending' },
              { status: 'confirmed' },
            );
          }

          // 检查满员 → 触发场地确认
          if (newCount >= match.requiredPlayers) {
            await this.triggerVenueConfirmation(manager, match);
          }
        }
      });
    }

    return { success: callbackResult.success, message: callbackResult.message };
  }

  /**
   * Reconcile payment status by querying payment provider.
   */
  async reconcilePaymentStatus(
    matchId: number,
    playerId: number,
  ): Promise<boolean> {
    const matchPlayer = await this.matchPlayerRepo.findOne({
      where: { matchId, playerId },
    });

    if (!matchPlayer) {
      throw new NotFoundException(
        `球员未受邀参赛: matchId=${matchId}, playerId=${playerId}`,
      );
    }

    if (matchPlayer.depositPaid) return true;

    if (!matchPlayer.depositOrderNo) {
      this.logger.warn(
        `No orderNo found: matchId=${matchId}, playerId=${playerId}`,
      );
      return false;
    }

    try {
      const orderStatus = await this.paymentService.queryOrder(
        matchPlayer.depositOrderNo,
      );

      if (orderStatus.status === 'paid') {
        await this.matchPlayerRepo.update(
          { id: matchPlayer.id },
          { depositPaid: true, status: 'confirmed', confirmedAt: new Date() },
        );
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Reconciliation failed: matchId=${matchId}, playerId=${playerId}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  // ==================== MATCH FINALIZATION ====================

  /**
   * Finalize a single match (called by scheduler for expired matches).
   */
  async finalizeMatch(matchId: number): Promise<FinalizeMatchResult> {
    return this.dataSource.transaction(async (manager) => {
      const match = await manager
        .createQueryBuilder(Match, 'match')
        .setLock('pessimistic_write')
        .where('match.id = :matchId', { matchId })
        .getOne();

      if (!match) {
        throw new NotFoundException(`比赛不存在: matchId=${matchId}`);
      }

      if (match.status !== 'pending_players') {
        throw new ConflictException(
          `比赛状态为 ${match.status}，不可进行确认操作`,
        );
      }

      const confirmedCount = await manager.count(MatchPlayer, {
        where: { matchId, status: 'confirmed', depositPaid: true },
      });

      const requiredPlayers = match.requiredPlayers;
      let newStatus: MatchStatus;
      let groupChatId: string | undefined;

      if (confirmedCount >= requiredPlayers) {
        // v2.0: 满员后进入场地确认阶段（不直接 confirmed）
        await this.triggerVenueConfirmation(manager, match);
        newStatus = 'pending_venue';

        this.logger.log(
          `Match full → pending_venue: matchId=${matchId}, confirmedPlayers=${confirmedCount}/${requiredPlayers}`,
        );
      } else {
        newStatus = 'expired';

        await manager
          .createQueryBuilder()
          .update(Match)
          .set({ status: 'expired', confirmedPlayers: confirmedCount })
          .where('id = :id', { id: matchId })
          .execute();

        // 释放 invited 球员，意向回 pending
        await manager
          .createQueryBuilder()
          .update(MatchPlayer)
          .set({ status: 'withdrawn' })
          .where('match_id = :matchId', { matchId })
          .andWhere('status = :status', { status: 'invited' })
          .execute();

        // 退款已支付保证金的 confirmed 球员（资金安全）
        const confirmedPaidPlayers = await manager.find(MatchPlayer, {
          where: { matchId, status: 'confirmed', depositPaid: true },
        });

        for (const player of confirmedPaidPlayers) {
          await manager.update(
            MatchPlayer,
            { id: player.id },
            { status: 'withdrawn' },
          );

          // 意向回退保护：检查意向是否已在其他比赛 confirmed
          if (player.intentionId) {
            const intention = await manager.findOne(Intention, {
              where: { id: player.intentionId },
            });
            if (intention && intention.status !== 'confirmed') {
              await manager.update(
                Intention,
                { id: player.intentionId },
                { status: 'pending' },
              );
            }
          }

          // Saga 补偿：退款
          if (player.depositOrderNo) {
            await this.compensatePayment(player.depositOrderNo, match.depositAmount);
          }
        }

        await this.notifyMatchFailed(match, confirmedCount);

        this.logger.log(
          `Match expired: matchId=${matchId}, confirmedPlayers=${confirmedCount}/${requiredPlayers}, ` +
            `refunded=${confirmedPaidPlayers.length}`,
        );
      }

      return {
        matchId,
        status: newStatus,
        confirmedPlayers: confirmedCount,
        requiredPlayers,
        groupChatId,
      };
    });
  }

  /**
   * Finalize all pending matches that have passed their confirmation deadline.
   */
  async finalizePendingMatches(): Promise<BatchFinalizeResult> {
    const pendingMatches = await this.matchRepo.find({
      where: {
        status: 'pending_players',
        confirmDeadline: LessThan(new Date()),
      },
      select: ['id'],
    });

    let confirmed = 0;
    let failed = 0;

    for (const match of pendingMatches) {
      try {
        const result = await this.finalizeMatch(match.id);
        if (result.status === 'pending_venue' || result.status === 'confirmed') {
          confirmed++;
        } else {
          failed++;
        }
      } catch (error) {
        this.logger.error(
          `Failed to finalize match ${match.id}: ${(error as Error).message}`,
        );
        failed++;
      }
    }

    this.logger.log(
      `Batch finalize: processed=${pendingMatches.length}, confirmed=${confirmed}, failed=${failed}`,
    );

    return { processed: pendingMatches.length, confirmed, failed };
  }

  // ==================== PRIVATE HELPERS ====================

  private assertCanConfirm(match: Match, matchPlayer: MatchPlayer): void {
    if (match.status !== 'pending_players') {
      throw new ConflictException(`比赛状态为 ${match.status}，不可确认参赛`);
    }

    // v2.0: 使用 confirmDeadline 判断截止时间
    if (match.confirmDeadline && new Date() > match.confirmDeadline) {
      throw new BadRequestException('已超过确认截止时间');
    }

    if (matchPlayer.status === 'confirmed') {
      throw new AlreadyConfirmedException();
    }

    if (matchPlayer.status === 'withdrawn') {
      throw new ConflictException('已拒绝参赛，无法重新确认');
    }

    if (matchPlayer.status !== 'invited') {
      throw new BadRequestException(
        `当前状态为 ${matchPlayer.status}，不可确认参赛`,
      );
    }
  }

  private async createGroupChatForMatch(
    manager: EntityManager,
    match: Match,
  ): Promise<string> {
    const confirmedPlayers = await manager.find(MatchPlayer, {
      where: { matchId: match.id, status: 'confirmed' },
      select: ['playerId'],
    });

    const playerIds = confirmedPlayers.map((p) => p.playerId);
    const groupChatId = await this.groupChatService.createGroupChat(
      match.id,
      playerIds,
    );

    this.logger.log(`Group chat created: ${groupChatId} for match=${match.id}`);
    return groupChatId;
  }

  // ==================== NOTIFICATIONS ====================

  private async notifyMatchConfirmed(
    match: Match,
    confirmedCount: number,
  ): Promise<void> {
    const confirmedPlayers = await this.matchPlayerRepo.find({
      where: { matchId: match.id, status: 'confirmed' },
      select: ['playerId'],
    });

    const playerIds = confirmedPlayers.map((p) => p.playerId);
    if (playerIds.length === 0) return;

    const userIds = await this.resolvePlayerIdsToUserIds(playerIds);
    if (userIds.length === 0) return;

    await this.createNotificationWithRetry(() =>
      this.notificationService.batchCreateNotifications({
        userIds,
        type: 'match_success',
        title: '比赛已确认',
        content: `您参与的比赛已确认，共 ${confirmedCount} 人参赛。请准时到场。`,
        data: { matchId: match.id },
        regionCode: match.regionCode ?? undefined,
      }),
    );
  }

  private async notifyMatchFailed(
    match: Match,
    confirmedCount: number,
  ): Promise<void> {
    const allPlayers = await this.matchPlayerRepo.find({
      where: { matchId: match.id },
      select: ['playerId', 'status'],
    });

    const playerIds = allPlayers.map((p) => p.playerId);
    const playerIdToUserId = await this.resolvePlayerIdsToUserIdMap(playerIds);

    for (const player of allPlayers) {
      const userId = playerIdToUserId.get(player.playerId);
      if (!userId) continue;

      const content =
        player.status === 'confirmed'
          ? `您确认参赛的比赛因人数不足已取消，保证金将原路退回。已确认人数: ${confirmedCount}`
          : `您受邀参赛的比赛因人数不足已取消。`;

      await this.createNotificationWithRetry(() =>
        this.notificationService.createNotification({
          userId,
          type: 'match_failed',
          title: '比赛人数不足，已取消',
          content,
          data: { matchId: match.id },
          regionCode: match.regionCode ?? undefined,
        }),
      );
    }
  }

  private async createNotificationWithRetry<T>(
    operation: () => Promise<T>,
  ): Promise<T | undefined> {
    const maxRetries = 3;
    const baseDelayMs = 100;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn(
            `Notification attempt ${attempt} failed, retrying in ${delay}ms: ${message}`,
          );
          await this.sleep(delay);
        } else {
          this.logger.error(
            `Notification failed after ${maxRetries} attempts: ${message}`,
          );
        }
      }
    }

    return undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async resolvePlayerIdsToUserIds(playerIds: number[]): Promise<number[]> {
    if (playerIds.length === 0) return [];
    const rows = await this.dataSource.query(
      `SELECT user_id FROM players WHERE id = ANY($1)`,
      [playerIds],
    );
    return rows.map((r: { user_id: string | number }) => Number(r.user_id));
  }

  private async resolvePlayerIdsToUserIdMap(
    playerIds: number[],
  ): Promise<Map<number, number>> {
    if (playerIds.length === 0) return new Map();
    const rows = await this.dataSource.query(
      `SELECT id, user_id FROM players WHERE id = ANY($1)`,
      [playerIds],
    );
    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(Number(row.id), Number(row.user_id));
    }
    return map;
  }
}
