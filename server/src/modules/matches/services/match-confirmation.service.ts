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
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { NotificationService } from '@modules/notifications/services/notification.service';
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
 * Match Confirmation Service
 *
 * Handles the complete match confirmation lifecycle:
 * - Player confirmation/decline participation
 * - Deposit payment flow (via PaymentProviderInterface)
 * - Payment callback handling with idempotency
 * - Match finalization (confirmed/failed) based on participant count
 * - Venue time slot booking
 * - Group chat creation
 * - Notification generation
 *
 * Concurrency safety:
 * - Uses SELECT FOR UPDATE (pessimistic lock) on Match row
 * - All state-changing operations run within transactions
 * - Payment operations are executed OUTSIDE database transactions
 *   to avoid holding locks during external service calls
 *
 * Known risk (documented):
 * - Venue time slots are not pre-locked during the confirmation window.
 *   Current assumption: matching engine will not reassign the same slot.
 */
@Injectable()
export class MatchConfirmationService {
  private readonly logger = new Logger(MatchConfirmationService.name);
  private readonly confirmationDeadlineHours = 1;

  constructor(
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    @InjectRepository(MatchPlayer)
    private readonly matchPlayerRepo: Repository<MatchPlayer>,
    @InjectRepository(VenueTimeSlot)
    private readonly slotRepo: Repository<VenueTimeSlot>,
    private readonly notificationService: NotificationService,
    @InjectRepository(Format)
    private readonly formatRepo: Repository<Format>,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentService: PaymentProviderInterface,
    @Inject(GROUP_CHAT_PROVIDER)
    private readonly groupChatService: GroupChatProviderInterface,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== PLAYER CONFIRMATION ====================

  /**
   * Player confirms participation in a match.
   *
   * Flow (three-phase to avoid holding DB locks during payment):
   * 1. Pre-confirm (transaction): Validate + create payment order + save orderNo
   * 2. Process payment (outside transaction): Call payment provider
   * 3. Finalize confirmation (transaction): Update player status + check match confirmation
   */
  async confirmParticipation(
    matchId: number,
    playerId: number,
  ): Promise<ConfirmParticipationResult> {
    // Phase 1: Pre-confirm (within transaction)
    const { orderNo, depositAmount } = await this.dataSource.transaction(
      async (manager) => {
        const match = await manager
          .createQueryBuilder(Match, 'match')
          .setLock('pessimistic_write')
          .where('match.id = :matchId', { matchId })
          .getOne();

        if (!match) {
          throw new NotFoundException(`比赛不存在: matchId=${matchId}`);
        }

        const matchPlayer = await manager.findOne(MatchPlayer, {
          where: { matchId, playerId },
        });

        if (!matchPlayer) {
          throw new NotFoundException(
            `球员未受邀参赛: matchId=${matchId}, playerId=${playerId}`,
          );
        }

        this.assertCanConfirm(match, matchPlayer);

        const orderResult = await this.paymentService.createOrder({
          matchId,
          playerId,
          amount: match.depositAmount,
          description: `比赛保证金 matchId=${matchId}`,
        });

        // Save orderNo to MatchPlayer for reconciliation and callback handling
        await manager.update(
          MatchPlayer,
          { matchId, playerId },
          { orderNo: orderResult.orderNo },
        );

        return {
          orderNo: orderResult.orderNo,
          depositAmount: match.depositAmount,
        };
      },
    );

    // Phase 2: Process payment (outside transaction)
    const paymentResult = await this.paymentService.processPayment(orderNo);

    if (!paymentResult.success) {
      // Rollback: clear orderNo from MatchPlayer
      await this.matchPlayerRepo.update(
        { matchId, playerId },
        { orderNo: null },
      );
      throw new BadRequestException(`支付失败: ${paymentResult.errorMessage}`);
    }

    // Phase 3: Finalize confirmation (within transaction)
    return this.dataSource.transaction(async (manager) => {
      const match = await manager
        .createQueryBuilder(Match, 'match')
        .setLock('pessimistic_write')
        .where('match.id = :matchId', { matchId })
        .getOne();

      if (!match) {
        throw new NotFoundException(`比赛不存在: matchId=${matchId}`);
      }

      await this.finalizePlayerConfirmation(
        manager,
        matchId,
        playerId,
        orderNo,
      );

      const isMatchConfirmed = await this.checkAndConfirmMatch(manager, match);

      const message = isMatchConfirmed
        ? '确认参赛成功，比赛已确认'
        : '确认参赛成功，等待其他球员确认';

      this.logger.log(
        `Player confirmed: matchId=${matchId}, playerId=${playerId}, orderNo=${orderNo}`,
      );

      return {
        success: true,
        matchId,
        playerId,
        orderNo,
        status: 'confirmed',
        matchStatus: isMatchConfirmed ? 'confirmed' : 'pending_confirmation',
        message,
      };
    });
  }

  /**
   * Player declines participation.
   *
   * Protected by transaction and pessimistic lock on Match row
   * to prevent race conditions with concurrent confirmation operations.
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

      if (match.status !== 'pending_confirmation') {
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
        { status: 'declined' },
      );

      this.logger.log(
        `Player declined: matchId=${matchId}, playerId=${playerId}`,
      );
    });
  }

  // ==================== PAYMENT CALLBACK ====================

  /**
   * Handle payment callback from third-party provider.
   *
   * Updates player deposit status and checks match confirmation
   * when callback indicates successful payment.
   */
  async handlePaymentCallback(
    dto: PaymentCallbackInput,
  ): Promise<{ success: boolean; message: string }> {
    const callbackResult = await this.paymentService.handleCallback(dto);

    if (!callbackResult.success && !callbackResult.processed) {
      return {
        success: false,
        message: callbackResult.message,
      };
    }

    // If callback was newly processed and successful, update match player
    if (callbackResult.processed && dto.status === 'success') {
      await this.dataSource.transaction(async (manager) => {
        const matchPlayer = await manager.findOne(MatchPlayer, {
          where: { orderNo: dto.orderNo },
        });

        if (!matchPlayer) {
          this.logger.warn(`MatchPlayer not found for orderNo=${dto.orderNo}`);
          return;
        }

        if (!matchPlayer.depositPaid) {
          await manager.update(
            MatchPlayer,
            { id: matchPlayer.id },
            {
              depositPaid: true,
              status: 'confirmed',
              confirmedAt: new Date(),
            },
          );

          this.logger.log(
            `Payment callback updated player: orderNo=${dto.orderNo}, matchId=${matchPlayer.matchId}, playerId=${matchPlayer.playerId}`,
          );

          // Check if match can be confirmed
          const match = await manager.findOne(Match, {
            where: { id: matchPlayer.matchId },
          });
          if (match) {
            await this.checkAndConfirmMatch(manager, match);
          }
        }
      });
    }

    return {
      success: callbackResult.success,
      message: callbackResult.message,
    };
  }

  /**
   * Reconcile payment status by querying payment provider.
   *
   * Used when callback may have been lost.
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

    if (matchPlayer.depositPaid) {
      return true;
    }

    if (!matchPlayer.orderNo) {
      this.logger.warn(
        `No orderNo found for reconciliation: matchId=${matchId}, playerId=${playerId}`,
      );
      return false;
    }

    try {
      const orderStatus = await this.paymentService.queryOrder(
        matchPlayer.orderNo,
      );

      if (orderStatus.status === 'paid') {
        await this.matchPlayerRepo.update(
          { id: matchPlayer.id },
          { depositPaid: true, status: 'confirmed', confirmedAt: new Date() },
        );
        this.logger.log(
          `Payment reconciled: matchId=${matchId}, playerId=${playerId}, orderNo=${matchPlayer.orderNo}`,
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
   * Finalize a single match.
   *
   * Called by scheduled task or manual trigger.
   * Checks confirmation deadline and participant count.
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

      this.assertCanFinalize(match);

      const format = await manager.findOne(Format, {
        where: { id: match.formatId },
      });

      if (!format) {
        throw new InternalServerErrorException(
          `赛制不存在: formatId=${match.formatId}`,
        );
      }

      const requiredPlayers = format.teamCountMin * match.playersPerTeam;

      // Reconcile any missing payment statuses before counting
      await this.reconcileMatchPayments(manager, match);

      const confirmedCount = await manager.count(MatchPlayer, {
        where: { matchId, status: 'confirmed', depositPaid: true },
      });

      let newStatus: MatchStatus;
      let groupChatId: string | undefined;

      if (confirmedCount >= requiredPlayers) {
        newStatus = 'confirmed';
        groupChatId = await this.createGroupChatForMatch(manager, match);
        await this.bookVenueTimeSlot(manager, match);

        await manager
          .createQueryBuilder()
          .update(Match)
          .set({
            status: 'confirmed',
            confirmedPlayers: confirmedCount,
            groupChatId,
          })
          .where('id = :id', { id: matchId })
          .execute();

        await this.notifyMatchConfirmed(match, confirmedCount);
        await this.notifyVenueManager(match);

        this.logger.log(
          `Match confirmed: matchId=${matchId}, confirmedPlayers=${confirmedCount}/${requiredPlayers}`,
        );
      } else {
        newStatus = 'failed';

        await manager
          .createQueryBuilder()
          .update(Match)
          .set({
            status: 'failed',
            confirmedPlayers: confirmedCount,
          })
          .where('id = :id', { id: matchId })
          .execute();

        await this.notifyMatchFailed(match, confirmedCount);

        this.logger.log(
          `Match failed: matchId=${matchId}, confirmedPlayers=${confirmedCount}/${requiredPlayers}`,
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
    const now = new Date();
    const deadline = new Date(
      now.getTime() + this.confirmationDeadlineHours * 60 * 60 * 1000,
    );

    const pendingMatches = await this.matchRepo.find({
      where: {
        status: 'pending_confirmation',
        startTime: LessThan(deadline),
      },
      select: ['id'],
    });

    let confirmed = 0;
    let failed = 0;

    for (const match of pendingMatches) {
      try {
        const result = await this.finalizeMatch(match.id);
        if (result.status === 'confirmed') {
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
      `Batch finalize complete: processed=${pendingMatches.length}, confirmed=${confirmed}, failed=${failed}`,
    );

    return {
      processed: pendingMatches.length,
      confirmed,
      failed,
    };
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Assert that player can confirm participation.
   */
  private assertCanConfirm(match: Match, matchPlayer: MatchPlayer): void {
    if (match.status !== 'pending_confirmation') {
      throw new ConflictException(`比赛状态为 ${match.status}，不可确认参赛`);
    }

    const now = new Date();
    const deadline = new Date(
      match.startTime.getTime() -
        this.confirmationDeadlineHours * 60 * 60 * 1000,
    );

    if (now > deadline) {
      throw new BadRequestException('已超过确认截止时间');
    }

    if (matchPlayer.status === 'confirmed') {
      throw new ConflictException('已确认参赛');
    }

    if (matchPlayer.status === 'declined') {
      throw new ConflictException('已拒绝参赛，无法重新确认');
    }

    if (matchPlayer.status !== 'invited') {
      throw new BadRequestException(
        `当前状态为 ${matchPlayer.status}，不可确认参赛`,
      );
    }
  }

  /**
   * Assert that match can be finalized.
   */
  private assertCanFinalize(match: Match): void {
    if (match.status !== 'pending_confirmation') {
      throw new ConflictException(
        `比赛状态为 ${match.status}，不可进行确认操作`,
      );
    }

    const now = new Date();
    const deadline = new Date(
      match.startTime.getTime() -
        this.confirmationDeadlineHours * 60 * 60 * 1000,
    );

    if (now < deadline) {
      throw new BadRequestException('确认截止时间未到，不可提前确认比赛');
    }
  }

  /**
   * Finalize player confirmation status within transaction.
   */
  private async finalizePlayerConfirmation(
    manager: EntityManager,
    matchId: number,
    playerId: number,
    orderNo: string,
  ): Promise<void> {
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
      throw new ConflictException('球员状态已被其他操作修改，请刷新后重试');
    }

    this.logger.log(
      `Player confirmation finalized: matchId=${matchId}, playerId=${playerId}, orderNo=${orderNo}`,
    );
  }

  /**
   * Check if match has enough confirmed players and confirm it.
   */
  private async checkAndConfirmMatch(
    manager: EntityManager,
    match: Match,
  ): Promise<boolean> {
    const format = await manager.findOne(Format, {
      where: { id: match.formatId },
    });

    if (!format) {
      this.logger.error(`Format not found: formatId=${match.formatId}`);
      return false;
    }

    const requiredPlayers = format.teamCountMin * match.playersPerTeam;

    const confirmedCount = await manager.count(MatchPlayer, {
      where: { matchId: match.id, status: 'confirmed', depositPaid: true },
    });

    if (confirmedCount >= requiredPlayers) {
      const groupChatId = await this.createGroupChatForMatch(manager, match);
      await this.bookVenueTimeSlot(manager, match);

      await manager
        .createQueryBuilder()
        .update(Match)
        .set({
          status: 'confirmed',
          confirmedPlayers: confirmedCount,
          groupChatId,
        })
        .where('id = :id', { id: match.id })
        .execute();

      await this.notifyMatchConfirmed(match, confirmedCount);
      await this.notifyVenueManager(match);

      this.logger.log(
        `Match auto-confirmed: matchId=${match.id}, players=${confirmedCount}/${requiredPlayers}`,
      );

      return true;
    }

    await manager
      .createQueryBuilder()
      .update(Match)
      .set({ confirmedPlayers: confirmedCount })
      .where('id = :id', { id: match.id })
      .execute();

    return false;
  }

  /**
   * Reconcile payment statuses for all confirmed players in a match.
   */
  private async reconcileMatchPayments(
    manager: EntityManager,
    match: Match,
  ): Promise<void> {
    const playersToReconcile = await manager.find(MatchPlayer, {
      where: {
        matchId: match.id,
        status: 'confirmed',
        depositPaid: false,
      },
    });

    for (const player of playersToReconcile) {
      if (!player.orderNo) {
        this.logger.warn(
          `Cannot reconcile: matchId=${match.id}, playerId=${player.playerId} has no orderNo`,
        );
        continue;
      }

      try {
        const orderStatus = await this.paymentService.queryOrder(
          player.orderNo,
        );
        if (orderStatus.status === 'paid') {
          await manager.update(
            MatchPlayer,
            { id: player.id },
            { depositPaid: true },
          );
          this.logger.log(
            `Payment reconciled: matchId=${match.id}, playerId=${player.playerId}, orderNo=${player.orderNo}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Reconciliation failed: matchId=${match.id}, playerId=${player.playerId}: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Book venue time slot for the match.
   *
   * Uses pessimistic lock to prevent concurrent bookings of the same slot.
   */
  private async bookVenueTimeSlot(
    manager: EntityManager,
    match: Match,
  ): Promise<void> {
    const slotDate = match.startTime.toISOString().split('T')[0];
    const startTimeStr = match.startTime.toTimeString().slice(0, 8);
    const endTimeStr = match.endTime.toTimeString().slice(0, 8);

    const slot = await manager
      .createQueryBuilder(VenueTimeSlot, 'slot')
      .setLock('pessimistic_write')
      .where('slot.venue_id = :venueId', { venueId: match.venueId })
      .andWhere('slot.slot_date = :slotDate', { slotDate })
      .andWhere('slot.start_time = :startTime', { startTime: startTimeStr })
      .andWhere('slot.end_time = :endTime', { endTime: endTimeStr })
      .getOne();

    if (!slot) {
      this.logger.warn(
        `Venue time slot not found: venueId=${match.venueId}, date=${slotDate}, time=${startTimeStr}-${endTimeStr}`,
      );
      return;
    }

    if (slot.isBooked) {
      this.logger.warn(
        `Venue time slot already booked: slotId=${slot.id}, matchId=${match.id}`,
      );
      return;
    }

    slot.isBooked = true;
    slot.matchId = match.id;
    await manager.save(VenueTimeSlot, slot);

    this.logger.log(
      `Venue time slot booked: slotId=${slot.id}, matchId=${match.id}`,
    );
  }

  /**
   * Create group chat for confirmed match.
   */
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

  /**
   * Send notifications to confirmed players with retry.
   *
   * Uses NotificationService with synchronous retry (3 attempts, exponential backoff)
   * to ensure delivery reliability. Notifications are created outside the transaction
   * as derived data with eventual consistency.
   */
  private async notifyMatchConfirmed(
    match: Match,
    confirmedCount: number,
  ): Promise<void> {
    const confirmedPlayers = await this.matchPlayerRepo.find({
      where: { matchId: match.id, status: 'confirmed' },
      select: ['playerId'],
    });

    const userIds = confirmedPlayers.map((p) => p.playerId);
    if (userIds.length === 0) {
      return;
    }

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

  /**
   * Send failure notifications to all invited players with retry.
   */
  private async notifyMatchFailed(
    match: Match,
    confirmedCount: number,
  ): Promise<void> {
    const allPlayers = await this.matchPlayerRepo.find({
      where: { matchId: match.id },
      select: ['playerId', 'status'],
    });

    for (const player of allPlayers) {
      const title = '比赛人数不足，已取消';
      const content =
        player.status === 'confirmed'
          ? `您确认参赛的比赛因人数不足已取消，保证金将原路退回。已确认人数: ${confirmedCount}`
          : `您受邀参赛的比赛因人数不足已取消。`;

      await this.createNotificationWithRetry(() =>
        this.notificationService.createNotification({
          userId: player.playerId,
          type: 'match_failed',
          title,
          content,
          data: { matchId: match.id },
          regionCode: match.regionCode ?? undefined,
        }),
      );
    }
  }

  /**
   * Notify venue manager about confirmed match booking with retry.
   */
  private async notifyVenueManager(match: Match): Promise<void> {
    const venue = await this.dataSource.manager.findOne(Venue, {
      where: { id: match.venueId },
      select: ['managerId'],
    });

    if (!venue) {
      this.logger.warn(
        `Venue not found for notification: venueId=${match.venueId}`,
      );
      return;
    }

    const venueManager = await this.dataSource.manager.findOne(VenueManager, {
      where: { id: venue.managerId },
      select: ['userId'],
    });

    if (!venueManager) {
      this.logger.warn(`VenueManager not found for venueId=${match.venueId}`);
      return;
    }

    await this.createNotificationWithRetry(() =>
      this.notificationService.createNotification({
        userId: venueManager.userId,
        type: 'match_success',
        title: '新比赛预订确认',
        content: `您的场地已被预订用于比赛，时间: ${match.startTime.toISOString()}`,
        data: { matchId: match.id, venueId: match.venueId },
        regionCode: match.regionCode ?? undefined,
      }),
    );
  }

  /**
   * Create notification with synchronous retry and exponential backoff.
   *
   * Retries up to 3 times with delays: 100ms → 200ms → 400ms
   */
  private async createNotificationWithRetry<T>(
    operation: () => Promise<T>,
  ): Promise<T | undefined> {
    const maxRetries = 3;
    const baseDelayMs = 100;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
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
}
