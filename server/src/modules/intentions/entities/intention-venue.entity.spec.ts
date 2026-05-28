/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource, Repository } from 'typeorm';
import { IntentionVenue } from './intention-venue.entity';
import { IntentionFormat } from './intention-format.entity';
import { Intention } from './intention.entity';
import { Player } from '@modules/players/entities/player.entity';
import { User } from '@modules/users/entities/user.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { hashForQuery } from '@common/utils/encrypt.util';

async function createTestUser(
  userRepo: Repository<User>,
  phone: string,
  overrides: Partial<User> = {},
): Promise<User> {
  const user = userRepo.create({
    phone,
    phoneHash: hashForQuery(phone),
    passwordHash: 'hashed_password',
    nickname: `User_${phone.slice(-4)}`,
    userType: 'player',
    status: 'active',
    ...overrides,
  });
  return userRepo.save(user);
}

async function createTestPlayer(
  userRepo: Repository<User>,
  playerRepo: Repository<Player>,
  phone: string,
): Promise<Player> {
  const user = await createTestUser(userRepo, phone);
  const player = playerRepo.create({
    userId: user.id,
    age: 25,
    basketballAge: 5,
    gender: 'male',
    height: 180,
    baseAbilityScore: 50,
    matchAdjustValue: 0,
  });
  return playerRepo.save(player);
}

async function createTestVenueManager(
  userRepo: Repository<User>,
  vmRepo: Repository<VenueManager>,
  phone: string,
): Promise<VenueManager> {
  const user = userRepo.create({
    phone,
    phoneHash: hashForQuery(phone),
    passwordHash: 'hashed_password',
    nickname: `Owner_${phone.slice(-4)}`,
    userType: 'venue_manager',
    status: 'active',
  });
  const savedUser = await userRepo.save(user);

  const vm = vmRepo.create({
    userId: savedUser.id,
    companyName: 'Test Sports Co.',
  });
  return vmRepo.save(vm);
}

async function createTestVenue(
  userRepo: Repository<User>,
  vmRepo: Repository<VenueManager>,
  venueRepo: Repository<Venue>,
  phone: string,
  name: string,
): Promise<Venue> {
  const vm = await createTestVenueManager(userRepo, vmRepo, phone);
  const venue = venueRepo.create({
    managerId: vm.id,
    name,
    address: 'Test Address',
    pricePerHour: 200,
  });
  return venueRepo.save(venue);
}

describe('IntentionVenue Entity', () => {
  let dataSource: DataSource;

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
        Venue,
        VenueTimeSlot,
        Format,
        Intention,
        IntentionVenue,
        IntentionFormat,
      ],
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE intention_venues CASCADE');
    await dataSource.query('TRUNCATE TABLE intentions CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_time_slots CASCADE');
    await dataSource.query('TRUNCATE TABLE venues CASCADE');
    await dataSource.query('TRUNCATE TABLE players CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_managers CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('table structure', () => {
    it('should create intention_venues table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'intention_venues'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('intention_id');
      expect(columnNames).toContain('venue_id');
      expect(columnNames).toContain('priority');
    });

    it('should have intention_id and venue_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'intention_venues'
         AND column_name IN ('intention_id', 'venue_id')
         ORDER BY column_name`,
      );
      expect(columns.length).toBe(2);
      for (const col of columns) {
        expect(col.data_type).toBe('bigint');
        expect(col.is_nullable).toBe('NO');
      }
    });

    it('should have priority as int non-nullable with default 1', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = 'intention_venues' AND column_name = 'priority'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('integer');
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('1');
    });

    it('should have foreign keys to intentions and venues', async () => {
      const fks = await dataSource.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_name = 'intention_venues' AND constraint_type = 'FOREIGN KEY'`,
      );
      expect(fks.length).toBeGreaterThanOrEqual(2);
    });

    it('should have unique index on intention_id and venue_id', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'intention_venues'`,
      );
      const uniqueIndex = indexes.find(
        (i: { indexdef: string }) =>
          i.indexdef.includes('UNIQUE') &&
          i.indexdef.includes('intention_id') &&
          i.indexdef.includes('venue_id'),
      );
      expect(uniqueIndex).toBeDefined();
    });
  });

  describe('entity creation', () => {
    it('should create an intention-venue association', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);
      const intentionRepo = dataSource.getRepository(Intention);
      const ivRepo = dataSource.getRepository(IntentionVenue);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138010',
      );
      const venue = await createTestVenue(
        userRepo,
        vmRepo,
        venueRepo,
        '15000150010',
        'Court A',
      );

      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');
      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 120,
        expiresAt,
      });
      const savedIntention = await intentionRepo.save(intention);

      const iv = ivRepo.create({
        intentionId: savedIntention.id,
        venueId: venue.id,
        priority: 1,
      });
      const saved = await ivRepo.save(iv);

      expect(saved.id).toBeDefined();
      expect(saved.intentionId).toBe(savedIntention.id);
      expect(saved.venueId).toBe(venue.id);
      expect(saved.priority).toBe(1);
    });

    it('should reject duplicate venue for same intention', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);
      const intentionRepo = dataSource.getRepository(Intention);
      const ivRepo = dataSource.getRepository(IntentionVenue);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138011',
      );
      const venue = await createTestVenue(
        userRepo,
        vmRepo,
        venueRepo,
        '15000150011',
        'Court B',
      );

      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');
      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 120,
        expiresAt,
      });
      const savedIntention = await intentionRepo.save(intention);

      const iv1 = ivRepo.create({
        intentionId: savedIntention.id,
        venueId: venue.id,
        priority: 1,
      });
      await ivRepo.save(iv1);

      const iv2 = ivRepo.create({
        intentionId: savedIntention.id,
        venueId: venue.id,
        priority: 2,
      });

      await expect(ivRepo.save(iv2)).rejects.toThrow();
    });

    it('should cascade delete when intention is deleted', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);
      const intentionRepo = dataSource.getRepository(Intention);
      const ivRepo = dataSource.getRepository(IntentionVenue);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138012',
      );
      const venue = await createTestVenue(
        userRepo,
        vmRepo,
        venueRepo,
        '15000150012',
        'Court C',
      );

      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');
      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 120,
        expiresAt,
      });
      const savedIntention = await intentionRepo.save(intention);

      const iv = ivRepo.create({
        intentionId: savedIntention.id,
        venueId: venue.id,
        priority: 1,
      });
      const savedIv = await ivRepo.save(iv);

      await intentionRepo.remove(savedIntention);

      const found = await ivRepo.findOne({ where: { id: savedIv.id } });
      expect(found).toBeNull();
    });

    it('should throw foreign key conflict when deleting a venue with associated intention venues', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);
      const intentionRepo = dataSource.getRepository(Intention);
      const ivRepo = dataSource.getRepository(IntentionVenue);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138013',
      );
      const venue = await createTestVenue(
        userRepo,
        vmRepo,
        venueRepo,
        '15000150013',
        'Court D',
      );

      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');
      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 120,
        expiresAt,
      });
      const savedIntention = await intentionRepo.save(intention);

      const iv = ivRepo.create({
        intentionId: savedIntention.id,
        venueId: venue.id,
        priority: 1,
      });
      await ivRepo.save(iv);

      // Deleting venue should fail due to foreign key constraint
      await expect(venueRepo.remove(venue)).rejects.toThrow();
    });
  });
});
