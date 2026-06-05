import { DataSource, Repository } from 'typeorm';
import { VenueService } from './venue.service';
import { Venue } from '../entities/venue.entity';
import { VenueTimeSlot } from '../entities/venue-time-slot.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Player } from '@modules/players/entities/player.entity';
import { PlayerPosition } from '@modules/players/entities/player-position.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { MatchMessage } from '@modules/messages/entities/match-message.entity';
import { Feedback } from '@modules/feedbacks/entities/feedback.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { AdjustUpdateFailure } from '@modules/feedbacks/entities/adjust-update-failure.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { CreateVenueDto } from '../dto/create-venue.dto';
import { CreateTimeSlotDto } from '../dto/create-time-slot.dto';
import { UpdateVenueDto } from '../dto/update-venue.dto';
import { hashForQuery } from '@common/utils/encrypt.util';

describe('Venue Integration Tests', () => {
  let dataSource: DataSource;
  let venueService: VenueService;
  let venueRepo: Repository<Venue>;
  let slotRepo: Repository<VenueTimeSlot>;
  let userRepo: Repository<User>;
  let vmRepo: Repository<VenueManager>;

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
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    venueRepo = dataSource.getRepository(Venue);
    slotRepo = dataSource.getRepository(VenueTimeSlot);
    userRepo = dataSource.getRepository(User);
    vmRepo = dataSource.getRepository(VenueManager);

    venueService = new VenueService(venueRepo, slotRepo, dataSource);
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

  async function createVenueManager(): Promise<VenueManager> {
    const phone = nextPhone();
    const user = await userRepo.save({
      phone,
      phoneHash: hashForQuery(phone),
      passwordHash: 'hashed_password',
      nickname: 'Manager',
      userType: 'venue_manager',
      status: 'active',
    });

    return vmRepo.save({
      userId: user.id,
      companyName: 'Test Sports Co.',
      contactName: 'Test Manager',
      contactPhone: phone,
    });
  }

  describe('VEN-INT-001: venue manager creates venue and time slots', () => {
    it('should create venue with correct details and time slots', async () => {
      const manager = await createVenueManager();

      const dto: CreateVenueDto = {
        name: '腾飞篮球馆-A馆',
        address: '深圳市福田区深南大道1001号',
        pricePerHour: 200,
        courtCount: 2,
        latitude: 22.5431,
        longitude: 114.0579,
        regionCode: 'shenzhen_futian',
      };

      const venue = await venueService.create(manager.id, dto);

      expect(venue.id).toBeDefined();
      expect(venue.name).toBe('腾飞篮球馆-A馆');
      expect(venue.pricePerHour).toBe(200);
      expect(venue.courtCount).toBe(2);
      expect(parseFloat(String(venue.latitude))).toBeCloseTo(22.5431, 4);
      expect(parseFloat(String(venue.longitude))).toBeCloseTo(114.0579, 4);

      // Create time slots
      const slotDtos: CreateTimeSlotDto[] = [
        { slotDate: '2026-06-15', startTime: '09:00', endTime: '12:00' },
        { slotDate: '2026-06-15', startTime: '14:00', endTime: '17:00' },
      ];

      const slots = await venueService.createTimeSlots(venue.id, manager.id, slotDtos);
      expect(slots.length).toBe(2);
      expect(slots[0].slotDate).toBe('2026-06-15');
      expect(slots[0].isBooked).toBe(false);

      // Verify in database
      const dbSlots = await slotRepo.find({ where: { venueId: venue.id } });
      expect(dbSlots.length).toBe(2);
    });
  });

  describe('VEN-INT-002: time slot overlap detection', () => {
    it('should reject overlapping time slots', async () => {
      const manager = await createVenueManager();

      const dto: CreateVenueDto = {
        name: 'Test Venue',
        address: 'Test Address',
        pricePerHour: 200,
      };

      const venue = await venueService.create(manager.id, dto);

      const slotDtos: CreateTimeSlotDto[] = [
        { slotDate: '2026-06-15', startTime: '09:00', endTime: '12:00' },
        { slotDate: '2026-06-15', startTime: '11:00', endTime: '14:00' },
      ];

      await expect(
        venueService.createTimeSlots(venue.id, manager.id, slotDtos),
      ).rejects.toThrow(/时段重叠/);

      // Verify no slots created
      const dbSlots = await slotRepo.find({ where: { venueId: venue.id } });
      expect(dbSlots.length).toBe(0);
    });
  });

  describe('VEN-INT-003: venue deletion cascades to time slots', () => {
    it('should delete associated time slots when venue is deleted', async () => {
      const manager = await createVenueManager();

      const dto: CreateVenueDto = {
        name: 'Test Venue',
        address: 'Test Address',
        pricePerHour: 200,
      };

      const venue = await venueService.create(manager.id, dto);

      await venueService.createTimeSlots(venue.id, manager.id, [
        { slotDate: '2026-06-15', startTime: '09:00', endTime: '12:00' },
      ]);

      // Verify slots exist
      let slots = await slotRepo.find({ where: { venueId: venue.id } });
      expect(slots.length).toBe(1);

      // Delete venue
      await venueService.remove(venue.id, manager.id);

      // Verify venue and slots deleted
      const deletedVenue = await venueRepo.findOne({ where: { id: venue.id } });
      expect(deletedVenue).toBeNull();

      slots = await slotRepo.find({ where: { venueId: venue.id } });
      expect(slots.length).toBe(0);
    });
  });

  describe('VEN-INT-004: optimistic locking on venue update', () => {
    it('should increment version on successful update', async () => {
      const manager = await createVenueManager();

      const dto: CreateVenueDto = {
        name: 'Test Venue',
        address: 'Test Address',
        pricePerHour: 200,
      };

      const venue = await venueService.create(manager.id, dto);
      const originalVersion = (await venueRepo.findOne({ where: { id: venue.id } }))!.version;

      const updateDto: UpdateVenueDto = { pricePerHour: 250 };
      await venueService.update(venue.id, manager.id, updateDto);

      const updated = await venueRepo.findOne({ where: { id: venue.id } });
      expect(updated!.version).toBe(originalVersion + 1);
      expect(Number(updated!.pricePerHour)).toBe(250);
    });
  });

  describe('VEN-INT-005: permission isolation', () => {
    it('should reject operations by non-owner manager', async () => {
      const manager1 = await createVenueManager();
      const manager2 = await createVenueManager();

      const dto: CreateVenueDto = {
        name: 'Test Venue',
        address: 'Test Address',
        pricePerHour: 200,
      };

      const venue = await venueService.create(manager1.id, dto);

      await expect(
        venueService.update(venue.id, manager2.id, { pricePerHour: 250 }),
      ).rejects.toThrow(/无权操作该场地/);

      await expect(venueService.remove(venue.id, manager2.id)).rejects.toThrow(/无权操作该场地/);

      await expect(
        venueService.createTimeSlots(venue.id, manager2.id, [
          { slotDate: '2026-06-15', startTime: '09:00', endTime: '12:00' },
        ]),
      ).rejects.toThrow(/无权操作该场地/);
    });
  });
});
