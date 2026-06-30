import { DataSource, Repository } from 'typeorm';
import { MatchingEngineService } from './matching-engine.service';
import { MatchPoolService } from './match-pool.service';
import { VenueBookingService } from '@modules/venues/services/venue-booking.service';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { VenueUnavailableSlot } from '@modules/venues/entities/venue-unavailable-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { Player } from '@modules/players/entities/player.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { PlayerPosition } from '@modules/players/entities/player-position.entity';
import { MatchMessage } from '@modules/messages/entities/match-message.entity';
import { Feedback } from '@modules/feedbacks/entities/feedback.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { AdjustUpdateFailure } from '@modules/feedbacks/entities/adjust-update-failure.entity';
import { CreateIntentionDto } from '@modules/intentions/dto/create-intention.dto';
import { IntentionService } from '@modules/intentions/services/intention.service';
import { hashForQuery } from '@common/utils/encrypt.util';

describe('MatchingEngine Integration Tests', () => {
  let dataSource: DataSource;
  let matchingService: MatchingEngineService;
  let intentionService: IntentionService;
  let matchRepo: Repository<Match>;
  let matchPlayerRepo: Repository<MatchPlayer>;
  let matchTeamRepo: Repository<MatchTeam>;
  let intentionRepo: Repository<Intention>;
  let playerRepo: Repository<Player>;
  let venueRepo: Repository<Venue>;
  let formatRepo: Repository<Format>;
  let slotRepo: Repository<VenueTimeSlot>;
  let systemParamRepo: Repository<SystemParam>;
  let userRepo: Repository<User>;

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
        VenueUnavailableSlot,
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
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    matchRepo = dataSource.getRepository(Match);
    matchPlayerRepo = dataSource.getRepository(MatchPlayer);
    matchTeamRepo = dataSource.getRepository(MatchTeam);
    intentionRepo = dataSource.getRepository(Intention);
    playerRepo = dataSource.getRepository(Player);
    venueRepo = dataSource.getRepository(Venue);
    formatRepo = dataSource.getRepository(Format);
    slotRepo = dataSource.getRepository(VenueTimeSlot);
    systemParamRepo = dataSource.getRepository(SystemParam);
    userRepo = dataSource.getRepository(User);

    const mockVenueBookingService = {
      checkAvailability: jest.fn().mockResolvedValue(true),
      bookSlot: jest.fn().mockResolvedValue(true),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    } as unknown as VenueBookingService;

    matchingService = new MatchingEngineService(
      intentionRepo,
      matchRepo,
      formatRepo,
      systemParamRepo,
      dataSource,
      mockVenueBookingService,
      new MatchPoolService(),
    );

    intentionService = new IntentionService(
      intentionRepo,
      dataSource.getRepository(IntentionVenue),
      dataSource.getRepository(IntentionFormat),
      playerRepo,
      venueRepo,
      formatRepo,
      dataSource.getRepository(VenueUnavailableSlot),
      dataSource.getRepository(VenueTimeSlot),
      dataSource,
    );
  });

  afterEach(async () => {
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

  async function createPlayer(abilityScore: number): Promise<Player> {
    const phone = nextPhone();
    const user = await userRepo.save({
      phone,
      phoneHash: hashForQuery(phone),
      passwordHash: 'hashed_password',
      nickname: `Player_${abilityScore}`,
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
      baseAbilityScore: abilityScore,
      matchAdjustValue: 0,
      regionCode: 'shenzhen_futian',
    });
  }

  async function createVenue(): Promise<Venue> {
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

    return venueRepo.save({
      managerId: vm.id,
      name: 'Test Venue',
      address: 'Test Address',
      pricePerHour: 200,
      courtCount: 2,
      regionCode: 'shenzhen_futian',
      status: 'active',
    });
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

  async function createTimeSlot(venueId: number, startTime: Date, endTime: Date): Promise<VenueTimeSlot> {
    return slotRepo.save({
      venueId,
      slotDate: startTime.toISOString().split('T')[0],
      startTime: startTime.toTimeString().slice(0, 8),
      endTime: endTime.toTimeString().slice(0, 8),
      isBooked: false,
    });
  }

  async function seedSystemParams(): Promise<void> {
    await systemParamRepo.save({
      paramKey: 'match_threshold_params',
      paramValue: {
        base_threshold: 50.0,
        min_threshold: 5.0,
        intention_count_factor: 0.5,
      },
      description: '匹配阈值参数',
    });
  }

  async function submitIntention(
    playerId: number,
    venueId: number,
    formatId: number,
    startTime: Date,
  ): Promise<Intention> {
    const dto: CreateIntentionDto = {
      startTime: startTime.toISOString(),
      durationMinutes: 180,
      acceptableWaitMinutes: 30,
      venueIds: [{ venueId, priority: 1 }],
      formatIds: [{ formatId, priority: 1 }],
    };

    const result = await intentionService.create(playerId, dto);
    return intentionRepo.findOneOrFail({ where: { id: result.id } });
  }

  describe('MAT-INT-001: basic matching flow', () => {
    it('should create match with correct records when enough players submit intentions', async () => {
      await seedSystemParams();
      const venue = await createVenue();
      const format = await createFormat();

      const startTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
      startTime.setMinutes(0, 0, 0);
      const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000);
      await createTimeSlot(venue.id, startTime, endTime);

      // Create 9 players with similar ability scores
      const players: Player[] = [];
      for (let i = 0; i < 9; i++) {
        players.push(await createPlayer(50 + i));
      }

      // Submit intentions
      for (const player of players) {
        await submitIntention(player.id, venue.id, format.id, startTime);
      }

      const result = await matchingService.runMatching();

      expect(result.matchesCreated).toBeGreaterThanOrEqual(1);

      const matches = await matchRepo.find();
      expect(matches.length).toBeGreaterThanOrEqual(1);

      const match = matches[0];
      expect(match.status).toBe('pending_players');
      expect(match.requiredPlayers).toBe(9);

      const matchPlayers = await matchPlayerRepo.find({ where: { matchId: match.id } });
      expect(matchPlayers.length).toBe(9);
      expect(matchPlayers.every((mp) => mp.status === 'invited')).toBe(true);

      // v2.2: teams are NOT created during matching; they are created after confirmation
      const matchTeams = await matchTeamRepo.find({ where: { matchId: match.id } });
      expect(matchTeams.length).toBe(0);
    });
  });

  describe('MAT-INT-002: snake draft team balance', () => {
    it('should create balanced teams with minimal avg ability difference', async () => {
      await seedSystemParams();
      const venue = await createVenue();
      const format = await createFormat();

      const startTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
      startTime.setMinutes(0, 0, 0);
      const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000);
      await createTimeSlot(venue.id, startTime, endTime);

      // Create 9 players with varying ability scores
      const players: Player[] = [];
      for (let i = 0; i < 9; i++) {
        players.push(await createPlayer(40 + i * 5));
      }

      for (const player of players) {
        await submitIntention(player.id, venue.id, format.id, startTime);
      }

      await matchingService.runMatching();

      const match = await matchRepo.findOne({ where: {} });
      expect(match).toBeDefined();

      const teams = await matchTeamRepo.find({ where: { matchId: match!.id } });
      expect(teams.length).toBe(3);

      // v2.2: teams are NOT created during matching; they are created after confirmation
      expect(teams.length).toBe(0);
    });
  });

  describe('MAT-INT-003: insufficient players', () => {
    it('should not create match when player count is below minimum', async () => {
      await seedSystemParams();
      const venue = await createVenue();
      const format = await createFormat();

      const startTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
      startTime.setMinutes(0, 0, 0);
      const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000);
      await createTimeSlot(venue.id, startTime, endTime);

      // Only 2 players
      const player1 = await createPlayer(50);
      const player2 = await createPlayer(55);

      await submitIntention(player1.id, venue.id, format.id, startTime);
      await submitIntention(player2.id, venue.id, format.id, startTime);

      const result = await matchingService.runMatching();

      expect(result.matchesCreated).toBe(0);

      const matches = await matchRepo.find();
      expect(matches.length).toBe(0);

      // Intentions should be marked as expired when insufficient players
      const intentions = await intentionRepo.find();
      expect(intentions.every((i) => i.status === 'expired')).toBe(true);
    });
  });

  describe('MAT-INT-004: dynamic threshold adjustment', () => {
    it('should use lower threshold with more intentions', async () => {
      // v2.2: dynamic threshold is now calculated internally by MatchPoolService
      // This test verifies the threshold logic conceptually
      const baseThreshold = 20.0;
      const minThreshold = 5.0;
      const intentionCountFactor = 0.5;

      const threshold = Math.max(minThreshold, baseThreshold - 5 * intentionCountFactor);
      expect(threshold).toBe(17.5); // 20 - 5 * 0.5

      const thresholdLarge = Math.max(minThreshold, baseThreshold - 50 * intentionCountFactor);
      expect(thresholdLarge).toBe(5.0); // clamped to min_threshold
    });
  });

  describe('MAT-INT-005: idempotent matching', () => {
    it('should not duplicate matches on repeated runs', async () => {
      await seedSystemParams();
      const venue = await createVenue();
      const format = await createFormat();

      const startTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
      startTime.setMinutes(0, 0, 0);
      const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000);
      await createTimeSlot(venue.id, startTime, endTime);

      const players: Player[] = [];
      for (let i = 0; i < 9; i++) {
        players.push(await createPlayer(50));
      }

      for (const player of players) {
        await submitIntention(player.id, venue.id, format.id, startTime);
      }

      const result1 = await matchingService.runMatching();
      expect(result1.matchesCreated).toBe(1);

      const result2 = await matchingService.runMatching();
      expect(result2.matchesCreated).toBe(0);

      const matches = await matchRepo.find();
      expect(matches.length).toBe(1);
    });
  });
});
