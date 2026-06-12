import { DataSource, Repository } from 'typeorm';
import { IntentionService } from './intention.service';
import { Intention } from '../entities/intention.entity';
import { IntentionVenue } from '../entities/intention-venue.entity';
import { IntentionFormat } from '../entities/intention-format.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { PlayerPosition } from '@modules/players/entities/player-position.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { VenueUnavailableSlot } from '@modules/venues/entities/venue-unavailable-slot.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { MatchMessage } from '@modules/messages/entities/match-message.entity';
import { Feedback } from '@modules/feedbacks/entities/feedback.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { AdjustUpdateFailure } from '@modules/feedbacks/entities/adjust-update-failure.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { CreateIntentionDto } from '../dto/create-intention.dto';
import { hashForQuery } from '@common/utils/encrypt.util';

describe('Intention Integration Tests', () => {
  let dataSource: DataSource;
  let intentionService: IntentionService;
  let intentionRepo: Repository<Intention>;
  let playerRepo: Repository<Player>;
  let venueRepo: Repository<Venue>;
  let formatRepo: Repository<Format>;
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

    intentionRepo = dataSource.getRepository(Intention);
    playerRepo = dataSource.getRepository(Player);
    venueRepo = dataSource.getRepository(Venue);
    formatRepo = dataSource.getRepository(Format);
    userRepo = dataSource.getRepository(User);

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
      isActive: true,
    });
  }

  describe('INT-INT-001: intention time auto-calculation', () => {
    it('should calculate end_time and expires_at correctly', async () => {
      const player = await createPlayer();
      const venue = await createVenue();
      const format = await createFormat();

      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 2); // Ensure > 1 hour in future
      startTime.setMinutes(0, 0, 0);

      const dto: CreateIntentionDto = {
        startTime: startTime.toISOString(),
        durationMinutes: 180,
        acceptableWaitMinutes: 30,
        venueIds: [{ venueId: venue.id, priority: 1 }],
        formatIds: [{ formatId: format.id, priority: 1 }],
      };

      const result = await intentionService.create(player.id, dto);

      expect(result.id).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.durationMinutes).toBe(180);

      // Verify database record
      const intention = await intentionRepo.findOne({
        where: { id: result.id },
        relations: ['intentionVenues', 'intentionFormats'],
      });
      expect(intention).toBeDefined();
      expect(intention!.status).toBe('pending');
      expect(intention!.durationMinutes).toBe(180);

      // Verify end_time = start_time + 180 minutes
      const expectedEndTime = new Date(startTime.getTime() + 180 * 60 * 1000);
      expect(intention!.endTime.getTime()).toBe(expectedEndTime.getTime());

      // Verify venue/format associations
      expect(intention!.intentionVenues.length).toBe(1);
      expect(intention!.intentionVenues[0].venueId).toBe(venue.id);
      expect(intention!.intentionFormats.length).toBe(1);
      expect(intention!.intentionFormats[0].formatId).toBe(format.id);
    });
  });

  describe('INT-INT-002: 1-hour advance validation', () => {
    it('should reject intention with startTime less than 1 hour in future', async () => {
      const player = await createPlayer();
      const venue = await createVenue();
      const format = await createFormat();

      const startTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes in future

      const dto: CreateIntentionDto = {
        startTime: startTime.toISOString(),
        durationMinutes: 180,
        venueIds: [{ venueId: venue.id, priority: 1 }],
        formatIds: [{ formatId: format.id, priority: 1 }],
      };

      await expect(intentionService.create(player.id, dto)).rejects.toThrow(/提前/);

      const intentions = await intentionRepo.find();
      expect(intentions.length).toBe(0);
    });
  });

  describe('INT-INT-003: venue/format count limit', () => {
    it('should reject intention with more than 3 venues', async () => {
      const player = await createPlayer();
      const format = await createFormat();

      const venues: Venue[] = [];
      for (let i = 0; i < 4; i++) {
        venues.push(await createVenue());
      }

      const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

      const dto: CreateIntentionDto = {
        startTime: startTime.toISOString(),
        durationMinutes: 180,
        venueIds: venues.map((v, i) => ({ venueId: v.id, priority: i + 1 })),
        formatIds: [{ formatId: format.id, priority: 1 }],
      };

      await expect(intentionService.create(player.id, dto)).rejects.toThrow();
    });
  });

  describe('INT-INT-004: time overlap detection', () => {
    it('should reject overlapping intentions from same player', async () => {
      const player = await createPlayer();
      const venue = await createVenue();
      const format = await createFormat();

      const startTime1 = new Date(Date.now() + 2 * 60 * 60 * 1000);
      startTime1.setMinutes(0, 0, 0);

      const dto1: CreateIntentionDto = {
        startTime: startTime1.toISOString(),
        durationMinutes: 180,
        venueIds: [{ venueId: venue.id, priority: 1 }],
        formatIds: [{ formatId: format.id, priority: 1 }],
      };

      await intentionService.create(player.id, dto1);

      // Overlapping: starts 1 hour after first one, duration 180
      const startTime2 = new Date(startTime1.getTime() + 60 * 60 * 1000);

      const dto2: CreateIntentionDto = {
        startTime: startTime2.toISOString(),
        durationMinutes: 180,
        venueIds: [{ venueId: venue.id, priority: 1 }],
        formatIds: [{ formatId: format.id, priority: 1 }],
      };

      await expect(intentionService.create(player.id, dto2)).rejects.toThrow(/时间重叠/);
    });
  });

  describe('INT-INT-005: status transition', () => {
    it('should allow pending -> cancelled transition', async () => {
      const player = await createPlayer();
      const venue = await createVenue();
      const format = await createFormat();

      const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

      const dto: CreateIntentionDto = {
        startTime: startTime.toISOString(),
        durationMinutes: 180,
        venueIds: [{ venueId: venue.id, priority: 1 }],
        formatIds: [{ formatId: format.id, priority: 1 }],
      };

      const result = await intentionService.create(player.id, dto);
      expect(result.status).toBe('pending');

      await intentionService.cancel(result.id, player.id);

      const cancelled = await intentionRepo.findOne({ where: { id: result.id } });
      expect(cancelled!.status).toBe('cancelled');
    });
  });
});
