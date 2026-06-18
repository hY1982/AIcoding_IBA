import { DataSource, Repository } from 'typeorm';
import { MatchConfirmationService } from './match-confirmation.service';
import { MockPaymentService } from '@modules/payments/services/mock-payment.service';
import { MockGroupChatService } from './mock-group-chat.service';
import { NotificationService } from '@modules/notifications/services/notification.service';
import { InAppChannel } from '@modules/notifications/channels/in-app.channel';
import { Match } from '../entities/match.entity';
import { MatchPlayer } from '../entities/match-player.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Notification } from '@modules/notifications/entities/notification.entity';
import { MockOrder } from '@modules/payments/entities/mock-order.entity';
import { User } from '@modules/users/entities/user.entity';
import { Player } from '@modules/players/entities/player.entity';
import { PlayerPosition } from '@modules/players/entities/player-position.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { VenueBookingRequest } from '@modules/venues/entities/venue-booking-request.entity';
import { VenueUnavailableSlot } from '@modules/venues/entities/venue-unavailable-slot.entity';
import { TeamBalancerService } from '@modules/matching/services/team-balancer.service';
import { MatchMessage } from '@modules/messages/entities/match-message.entity';
import { Feedback } from '@modules/feedbacks/entities/feedback.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { AdjustUpdateFailure } from '@modules/feedbacks/entities/adjust-update-failure.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { PAYMENT_PROVIDER } from '@modules/payments/interfaces/payment-provider.interface';
import { GROUP_CHAT_PROVIDER } from '../interfaces/group-chat-provider.interface';
import { NOTIFICATION_CHANNEL_PROVIDER } from '@modules/notifications/interfaces/notification-channel.interface';
import { hashForQuery } from '@common/utils/encrypt.util';

describe('MatchConfirmation Integration Tests', () => {
  let dataSource: DataSource;
  let confirmationService: MatchConfirmationService;
  let paymentService: MockPaymentService;
  let matchRepo: Repository<Match>;
  let matchPlayerRepo: Repository<MatchPlayer>;
  let slotRepo: Repository<VenueTimeSlot>;
  let orderRepo: Repository<MockOrder>;
  let notificationRepo: Repository<Notification>;
  let playerRepo: Repository<Player>;
  let venueRepo: Repository<Venue>;
  let formatRepo: Repository<Format>;
  let userRepo: Repository<User>;
  let bookingRequestRepo: Repository<VenueBookingRequest>;
  let intentionRepo: Repository<Intention>;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = 'vXloZBGTT7syeDNs5GBducYtkWxMuWifda6JljWUfHA=';
    process.env.PHONE_HASH_SECRET = 'test-phone-hash-secret-key-32bytes';

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: 'basketball_platform_test',
      entities: [
        User,
        VenueManager,
        Player,
        PlayerPosition,
        Venue,
        VenueTimeSlot,
        Format,
        Intention,
        IntentionVenue,
        IntentionFormat,
        Match,
        MatchPlayer,
        MatchTeam,
        MatchMessage,
        Feedback,
        FeedbackPlayerRating,
        AdjustUpdateFailure,
        SystemParam,
        MockOrder,
        Notification,
        VenueBookingRequest,
        VenueUnavailableSlot,
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    matchRepo = dataSource.getRepository(Match);
    matchPlayerRepo = dataSource.getRepository(MatchPlayer);
    slotRepo = dataSource.getRepository(VenueTimeSlot);
    orderRepo = dataSource.getRepository(MockOrder);
    notificationRepo = dataSource.getRepository(Notification);
    playerRepo = dataSource.getRepository(Player);
    venueRepo = dataSource.getRepository(Venue);
    formatRepo = dataSource.getRepository(Format);
    userRepo = dataSource.getRepository(User);
    bookingRequestRepo = dataSource.getRepository(VenueBookingRequest);
    intentionRepo = dataSource.getRepository(Intention);

    const venueBookingService = {
      bookSlot: jest.fn().mockResolvedValue(true),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
      checkAvailability: jest.fn().mockResolvedValue(true),
    };
    const teamBalancer = {
      snakeDraft: jest.fn().mockImplementation((input: any) => {
        return [{ teamNumber: 1, players: input.players }];
      }),
      calculateBalanceScore: jest.fn().mockReturnValue(0),
    };

    paymentService = new MockPaymentService(orderRepo);
    const groupChatService = new MockGroupChatService();
    const inAppChannel = new InAppChannel(notificationRepo);
    const notificationService = new NotificationService(
      notificationRepo,
      inAppChannel,
      dataSource,
    );

    confirmationService = new MatchConfirmationService(
      matchRepo,
      matchPlayerRepo,
      slotRepo,
      bookingRequestRepo,
      intentionRepo,
      notificationService,
      formatRepo,
      paymentService,
      groupChatService,
      venueBookingService as any,
      teamBalancer as any,
      dataSource,
    );
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE notifications CASCADE');
    await dataSource.query('TRUNCATE TABLE mock_orders CASCADE');
    await dataSource.query('TRUNCATE TABLE feedback_player_ratings CASCADE');
    await dataSource.query('TRUNCATE TABLE feedbacks CASCADE');
    await dataSource.query('TRUNCATE TABLE match_messages CASCADE');
    await dataSource.query('TRUNCATE TABLE match_teams CASCADE');
    await dataSource.query('TRUNCATE TABLE match_players CASCADE');
    await dataSource.query('TRUNCATE TABLE matches CASCADE');
    await dataSource.query('TRUNCATE TABLE formats CASCADE');
    await dataSource.query('TRUNCATE TABLE intention_formats CASCADE');
    await dataSource.query('TRUNCATE TABLE intention_venues CASCADE');
    await dataSource.query('TRUNCATE TABLE intentions CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_booking_requests CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_time_slots CASCADE');
    await dataSource.query('TRUNCATE TABLE venues CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_managers CASCADE');
    await dataSource.query('TRUNCATE TABLE player_positions CASCADE');
    await dataSource.query('TRUNCATE TABLE players CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
    await dataSource.query('TRUNCATE TABLE system_params CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  function nextPhone(): string {
    const ts = Date.now();
    const rand = Math.floor(Math.random() * 10000);
    return `138${String(ts % 100000000).padStart(8, '0')}${String(rand).padStart(4, '0')}`.slice(0, 11);
  }

  async function createPlayer(): Promise<Player> {
    const phone = nextPhone();
    const user = await userRepo.save({
      phone,
      phoneHash: hashForQuery(phone),
      passwordHash: 'hashed_password',
      nickname: 'TestPlayer',
      userType: 'player',
      status: 'active',
      regionCode: 'shenzhen_futian',
    });

    return playerRepo.save({
      userId: user.id,
      age: 25,
      basketballAge: 5,
      gender: 'male',
      height: 180,
      baseAbilityScore: 50,
      matchAdjustValue: 0,
      regionCode: 'shenzhen_futian',
    });
  }

  async function createVenueWithSlot(
    slotStartTime?: Date,
    durationHours = 2,
  ): Promise<{ venue: Venue; slot: VenueTimeSlot }> {
    const phone = nextPhone();
    const user = await userRepo.save({
      phone,
      phoneHash: hashForQuery(phone),
      passwordHash: 'hashed_password',
      nickname: 'Manager',
      userType: 'venue_manager',
      status: 'active',
    });

    const vm = await dataSource.getRepository(VenueManager).save({
      userId: user.id,
      companyName: 'Test Co.',
      contactName: 'Manager',
      contactPhone: phone,
    });

    const venue = await venueRepo.save({
      managerId: vm.id,
      name: 'Test Venue',
      address: 'Test Address',
      pricePerHour: 200,
      courtCount: 2,
      regionCode: 'shenzhen_futian',
      status: 'active',
    });

    const startTime = slotStartTime ? new Date(slotStartTime) : new Date(Date.now() + 3 * 60 * 60 * 1000);
    startTime.setMinutes(0, 0, 0);
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

    const slot = await slotRepo.save({
      venueId: venue.id,
      slotDate: startTime.toISOString().split('T')[0],
      startTime: startTime.toTimeString().slice(0, 8),
      endTime: endTime.toTimeString().slice(0, 8),
      isBooked: false,
    });

    return { venue, slot };
  }

  async function createFormat(): Promise<Format> {
    return formatRepo.save({
      name: '3v3 Short',
      formatType: 'short',
      teamSize: 3,
      teamCountMin: 3,
      teamCountMax: 4,
      durationHours: 2,
      isActive: true,
    });
  }

  async function createMatch(
    playerCount: number,
    startTimeOffset: number,
  ): Promise<{ match: Match; players: Player[]; slot: VenueTimeSlot }> {
    const startTime = new Date(Date.now() + startTimeOffset);
    startTime.setMinutes(0, 0, 0);
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    const { venue, slot } = await createVenueWithSlot(startTime, 2);
    const format = await createFormat();

    const match = await matchRepo.save({
      venueId: venue.id,
      formatId: format.id,
      startTime,
      endTime,
      status: 'pending_players',
      teamCount: 3,
      playersPerTeam: 3,
      requiredPlayers: playerCount,
      depositAmount: '50.00',
      confirmDeadline: new Date(Date.now() + 3 * 60 * 60 * 1000),
      regionCode: 'shenzhen_futian',
    });

    const players: Player[] = [];
    for (let i = 0; i < playerCount; i++) {
      const player = await createPlayer();
      players.push(player);
      await matchPlayerRepo.save({
        matchId: match.id,
        playerId: player.id,
        status: 'invited',
        teamNumber: (i % 3) + 1,
        depositPaid: false,
      });
    }

    return { match, players, slot };
  }

  describe('CNF-INT-001: pre-confirm + payment + venue confirmation flow (v2.0)', () => {
    it('should transition to pending_venue when full, then confirmed after venue approval', async () => {
      const { match, players } = await createMatch(9, 3 * 60 * 60 * 1000);

      // All 9 players confirm and pay
      for (const player of players) {
        const result = await confirmationService.confirmParticipation(match.id, player.id);
        expect(result.success).toBe(true);
      }

      // After all players confirm → pending_venue (Stage 2)
      const pendingVenueMatch = await matchRepo.findOne({ where: { id: match.id } });
      expect(pendingVenueMatch!.status).toBe('pending_venue');
      expect(pendingVenueMatch!.confirmedPlayers).toBe(9);
      expect(pendingVenueMatch!.venueConfirmDeadline).toBeDefined();

      // Verify all players confirmed
      const matchPlayers = await matchPlayerRepo.find({ where: { matchId: match.id } });
      expect(matchPlayers.every((mp) => mp.status === 'confirmed')).toBe(true);
      expect(matchPlayers.every((mp) => mp.depositPaid)).toBe(true);

      // Find the venue booking request
      const bookingRequest = await bookingRequestRepo.findOne({
        where: { matchId: match.id },
      });
      expect(bookingRequest).toBeDefined();
      expect(bookingRequest!.status).toBe('pending');

      // Venue confirms → match becomes confirmed (Stage 2 complete)
      const venueResult = await confirmationService.confirmVenueBooking(
        match.id,
        bookingRequest!.id,
      );
      expect(venueResult.success).toBe(true);

      const confirmedMatch = await matchRepo.findOne({ where: { id: match.id } });
      expect(confirmedMatch!.status).toBe('confirmed');
      expect(confirmedMatch!.groupChatId).toBeDefined();
    });
  });

  describe('CNF-INT-002: payment callback idempotency', () => {
    it('should ignore duplicate payment callbacks', async () => {
      const { match, players } = await createMatch(9, 3 * 60 * 60 * 1000);

      const player = players[0];
      const confirmResult = await confirmationService.confirmParticipation(match.id, player.id);

      // First callback
      const callback1 = await confirmationService.handlePaymentCallback({
        orderNo: confirmResult.orderNo,
        status: 'success',
      });
      expect(callback1.success).toBe(true);

      // Duplicate callback
      const callback2 = await confirmationService.handlePaymentCallback({
        orderNo: confirmResult.orderNo,
        status: 'success',
      });
      expect(callback2.success).toBe(true);

      // Verify order was processed only once
      const order = await orderRepo.findOne({ where: { orderNo: confirmResult.orderNo } });
      expect(order!.callbackProcessed).toBe(true);
    });
  });

  describe('CNF-INT-003: concurrent confirmation with optimistic locking', () => {
    it('should handle multiple simultaneous confirmations correctly', async () => {
      const { match, players } = await createMatch(9, 3 * 60 * 60 * 1000);

      // Simulate concurrent confirmations
      const promises = players.map((player) =>
        confirmationService.confirmParticipation(match.id, player.id),
      );

      const results = await Promise.all(promises);
      expect(results.every((r) => r.success)).toBe(true);

      const confirmedMatch = await matchRepo.findOne({ where: { id: match.id } });
      expect(confirmedMatch!.status).toBe('confirmed');
      expect(confirmedMatch!.confirmedPlayers).toBe(9);
    });
  });

  describe('CNF-INT-004: match expires when insufficient players', () => {
    it('should mark match as expired when not enough players confirm', async () => {
      // Create match starting within 1 hour so finalize is allowed
      const { match, players } = await createMatch(9, 30 * 60 * 1000);

      // Directly mark 5 players as confirmed (bypass confirmParticipation deadline check)
      for (let i = 0; i < 5; i++) {
        await matchPlayerRepo.update(
          { matchId: match.id, playerId: players[i].id },
          { status: 'confirmed', depositPaid: true, confirmedAt: new Date() },
        );
      }

      // Finalize the match
      const result = await confirmationService.finalizeMatch(match.id);
      expect(result.status).toBe('expired');
      expect(result.confirmedPlayers).toBe(5);

      const expiredMatch = await matchRepo.findOne({ where: { id: match.id } });
      expect(expiredMatch!.status).toBe('expired');
    });
  });

  describe('CNF-INT-005: batch finalization', () => {
    it('should process multiple pending matches in batch', async () => {
      const match1 = (await createMatch(9, 30 * 60 * 1000)).match;
      const match2 = (await createMatch(9, 45 * 60 * 1000)).match;

      // Set confirmDeadline to the past so they're picked up by batch finalization
      const pastDeadline = new Date(Date.now() - 60 * 60 * 1000);
      await matchRepo.update({ id: match1.id }, { confirmDeadline: pastDeadline });
      await matchRepo.update({ id: match2.id }, { confirmDeadline: pastDeadline });

      const result = await confirmationService.finalizePendingMatches();
      expect(result.processed).toBeGreaterThanOrEqual(2);
    });
  });

  describe('CNF-INT-006: venue rejection cancels match and releases players', () => {
    it('should cancel match and set players to withdrawn when venue rejects', async () => {
      const { match, players } = await createMatch(9, 3 * 60 * 60 * 1000);

      // All 9 players confirm → pending_venue
      for (const player of players) {
        await confirmationService.confirmParticipation(match.id, player.id);
      }

      // Find the booking request
      const bookingRequest = await bookingRequestRepo.findOne({
        where: { matchId: match.id },
      });
      expect(bookingRequest).toBeDefined();

      // Venue rejects
      const rejectResult = await confirmationService.rejectVenueBooking(
        match.id,
        bookingRequest!.id,
        '场地维修中',
      );
      expect(rejectResult.success).toBe(true);

      // Verify match is cancelled
      const cancelledMatch = await matchRepo.findOne({ where: { id: match.id } });
      expect(cancelledMatch!.status).toBe('cancelled');

      // Verify all players are withdrawn
      const matchPlayers = await matchPlayerRepo.find({ where: { matchId: match.id } });
      expect(matchPlayers.every((mp) => mp.status === 'withdrawn')).toBe(true);
    });
  });

  describe('CNF-INT-007: concurrent confirmation exceeds capacity (first-come-first-served)', () => {
    it('should only allow requiredPlayers to confirm, rest get conflict', async () => {
      // Create match with 6 required players but invite 9
      const { match, players } = await createMatch(6, 3 * 60 * 60 * 1000);

      // Add 3 more invited players (total 9 invited for 6 slots)
      for (let i = 0; i < 3; i++) {
        const player = await createPlayer();
        await matchPlayerRepo.save({
          matchId: match.id,
          playerId: player.id,
          status: 'invited',
          depositPaid: false,
        });
        players.push(player);
      }

      // All 9 try to confirm concurrently
      const results = await Promise.allSettled(
        players.map((player) =>
          confirmationService.confirmParticipation(match.id, player.id),
        ),
      );

      // Count successes and failures
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly 6 should succeed (requiredPlayers), 3 should fail
      expect(fulfilled.length).toBe(6);
      expect(rejected.length).toBe(3);

      // Verify match state
      const finalMatch = await matchRepo.findOne({ where: { id: match.id } });
      expect(finalMatch!.status).toBe('pending_venue');
      expect(finalMatch!.confirmedPlayers).toBe(6);

      // Verify exactly 6 confirmed + 3 withdrawn
      const matchPlayers = await matchPlayerRepo.find({ where: { matchId: match.id } });
      const confirmed = matchPlayers.filter((mp) => mp.status === 'confirmed');
      const withdrawn = matchPlayers.filter((mp) => mp.status === 'withdrawn');
      expect(confirmed.length).toBe(6);
      expect(withdrawn.length).toBe(3);
    });
  });
});
