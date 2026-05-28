/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource, Repository } from 'typeorm';
import { Intention } from './intention.entity';
import { IntentionVenue } from './intention-venue.entity';
import { IntentionFormat } from './intention-format.entity';
import { Player } from '@modules/players/entities/player.entity';
import { User } from '@modules/users/entities/user.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { hashForQuery } from '@common/utils/encrypt.util';

/**
 * Helper to create a test user.
 */
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

/**
 * Helper to create a test player.
 */
async function createTestPlayer(
  userRepo: Repository<User>,
  playerRepo: Repository<Player>,
  phone: string,
  overrides: Partial<Player> = {},
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
    regionCode: 'shenzhen_futian',
    ...overrides,
  });
  return playerRepo.save(player);
}

/**
 * Helper to create a test venue manager with a linked user.
 */
async function createTestVenueManager(
  userRepo: Repository<User>,
  vmRepo: Repository<VenueManager>,
  phone: string,
  overrides: Partial<VenueManager> = {},
): Promise<{ user: User; vm: VenueManager }> {
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
    companyName: overrides.companyName ?? 'Test Sports Co.',
    ...overrides,
  });
  const savedVm = await vmRepo.save(vm);

  return { user: savedUser, vm: savedVm };
}

/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Helper to create a test venue.
 */
async function createTestVenue(
  userRepo: Repository<User>,
  vmRepo: Repository<VenueManager>,
  venueRepo: Repository<Venue>,
  phone: string,
  overrides: Partial<Venue> = {},
): Promise<Venue> {
  const { vm: savedVm } = await createTestVenueManager(
    userRepo,
    vmRepo,
    phone,
    { companyName: 'Test Co.' },
  );
  const venue = venueRepo.create({
    managerId: savedVm.id,
    name: overrides.name ?? 'Test Court',
    address: overrides.address ?? 'Test Address',
    pricePerHour: overrides.pricePerHour ?? 200,
    ...overrides,
  });
  return venueRepo.save(venue);
}

/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Helper to create a test format.
 */
async function createTestFormat(
  formatRepo: Repository<Format>,
  overrides: Partial<Format> = {},
): Promise<Format> {
  const format = formatRepo.create({
    name: overrides.name ?? 'Test Format',
    formatType: 'short',
    teamSize: 3,
    teamCountMin: 3,
    teamCountMax: 4,
    ...overrides,
  });
  return formatRepo.save(format);
}

describe('Intention Entity', () => {
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
    await dataSource.query('TRUNCATE TABLE intention_formats CASCADE');
    await dataSource.query('TRUNCATE TABLE intention_venues CASCADE');
    await dataSource.query('TRUNCATE TABLE intentions CASCADE');
    await dataSource.query('TRUNCATE TABLE formats CASCADE');
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
    it('should create intentions table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'intentions'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('player_id');
      expect(columnNames).toContain('start_time');
      expect(columnNames).toContain('duration_minutes');
      expect(columnNames).toContain('acceptable_wait_minutes');
      expect(columnNames).toContain('end_time');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('match_id');
      expect(columnNames).toContain('region_code');
      expect(columnNames).toContain('submitted_at');
      expect(columnNames).toContain('updated_at');
      expect(columnNames).toContain('expires_at');
    });

    it('should have id as bigint primary key', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'intentions' AND column_name = 'id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have player_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'intentions' AND column_name = 'player_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have start_time as timestamptz non-nullable', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'intentions' AND column_name = 'start_time'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('timestamp with time zone');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have duration_minutes as int non-nullable with CHECK constraint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'intentions' AND column_name = 'duration_minutes'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('integer');
      expect(columns[0].is_nullable).toBe('NO');

      const constraints = await dataSource.query(
        `SELECT constraint_name, constraint_type
         FROM information_schema.table_constraints
         WHERE table_name = 'intentions' AND constraint_type = 'CHECK'`,
      );
      const checkConstraint = constraints.find(
        (c: { constraint_name: string }) =>
          c.constraint_name === 'CHK_intentions_duration',
      );
      expect(checkConstraint).toBeDefined();
    });

    it('should have acceptable_wait_minutes as int non-nullable with default 30', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = 'intentions' AND column_name = 'acceptable_wait_minutes'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('integer');
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('30');
    });

    it('should have end_time as non-nullable timestamptz', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, generation_expression, is_nullable, data_type
         FROM information_schema.columns
         WHERE table_name = 'intentions' AND column_name = 'end_time'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].data_type).toBe('timestamp with time zone');
      // end_time is computed by @BeforeInsert/@BeforeUpdate hooks, not a PostgreSQL GENERATED column
      // because PostgreSQL requires immutable expressions for generated columns,
      // and interval arithmetic referencing other columns is not immutable.
      expect(columns[0].generation_expression).toBeFalsy();
    });

    it('should have status as enum non-nullable with default pending', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable, column_default, udt_name
         FROM information_schema.columns
         WHERE table_name = 'intentions' AND column_name = 'status'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('USER-DEFINED');
      expect(columns[0].udt_name).toBe('intentions_status_enum');
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('pending');
    });

    it('should have match_id as nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'intentions' AND column_name = 'match_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have region_code as varchar(20) nullable', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'intentions' AND column_name = 'region_code'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('character varying');
      expect(columns[0].character_maximum_length).toBe(20);
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have expires_at as timestamptz non-nullable', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'intentions' AND column_name = 'expires_at'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('timestamp with time zone');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have foreign key to players', async () => {
      const fks = await dataSource.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_name = 'intentions' AND constraint_type = 'FOREIGN KEY'`,
      );
      expect(fks.length).toBeGreaterThanOrEqual(1);
      // TypeORM generates FK constraint names like FK_xxx; verify at least one exists
      expect(fks[0].constraint_name).toBeTruthy();
    });

    it('should have index on status', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'intentions'`,
      );
      const statusIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(status)'),
      );
      expect(statusIndex).toBeDefined();
    });

    it('should have index on start_time and end_time', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'intentions'`,
      );
      const timeIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(start_time, end_time)'),
      );
      expect(timeIndex).toBeDefined();
    });

    it('should have index on player_id and status', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'intentions'`,
      );
      const playerIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(player_id, status)'),
      );
      expect(playerIndex).toBeDefined();
    });

    it('should have composite index on region_code, status, start_time', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'intentions'`,
      );
      const regionIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(region_code, status, start_time)'),
      );
      expect(regionIndex).toBeDefined();
    });
  });

  describe('entity creation', () => {
    it('should create an intention with all fields', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const intentionRepo = dataSource.getRepository(Intention);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138000',
      );

      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');

      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 180,
        acceptableWaitMinutes: 30,
        status: 'pending',
        regionCode: 'shenzhen_futian',
        expiresAt,
      });
      const saved = await intentionRepo.save(intention);

      expect(saved.id).toBeDefined();
      expect(saved.playerId).toBe(player.id);
      expect(saved.startTime).toBeInstanceOf(Date);
      expect(saved.durationMinutes).toBe(180);
      expect(saved.acceptableWaitMinutes).toBe(30);
      expect(saved.status).toBe('pending');
      expect(saved.matchId).toBeNull();
      expect(saved.regionCode).toBe('shenzhen_futian');
      expect(saved.submittedAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
      expect(saved.expiresAt).toBeInstanceOf(Date);
    });

    it('should auto-generate end_time from start_time and duration_minutes', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const intentionRepo = dataSource.getRepository(Intention);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138001',
      );

      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');

      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 120,
        acceptableWaitMinutes: 30,
        expiresAt,
      });
      const saved = await intentionRepo.save(intention);

      // end_time should be start_time + 120 minutes = 16:00
      const expectedEndTime = new Date('2026-06-15T16:00:00+08:00');
      expect(saved.endTime).toBeInstanceOf(Date);
      expect(saved.endTime.getTime()).toBeCloseTo(
        expectedEndTime.getTime(),
        -3,
      ); // within ~1 second
    });

    it('should default status to pending', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const intentionRepo = dataSource.getRepository(Intention);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138002',
      );
      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');

      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 120,
        expiresAt,
      });
      const saved = await intentionRepo.save(intention);

      expect(saved.status).toBe('pending');
    });

    it('should default acceptable_wait_minutes to 30', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const intentionRepo = dataSource.getRepository(Intention);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138003',
      );
      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');

      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 120,
        expiresAt,
      });
      const saved = await intentionRepo.save(intention);

      expect(saved.acceptableWaitMinutes).toBe(30);
    });

    it('should reject invalid status', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const intentionRepo = dataSource.getRepository(Intention);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138004',
      );
      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');

      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 120,
        status: 'invalid_status' as 'pending',
        expiresAt,
      });

      await expect(intentionRepo.save(intention)).rejects.toThrow();
    });

    it('should reject duration_minutes < 120 via CHECK constraint', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "intentions" ("player_id","start_time","duration_minutes","acceptable_wait_minutes","end_time","expires_at")
           VALUES (1,'2026-06-15T14:00:00+08:00',119,30,'2026-06-15T16:00:00+08:00','2026-06-15T14:30:00+08:00')`,
        ),
      ).rejects.toThrow(/CHK_intentions_duration/);
    });

    it('should reject duration_minutes > 360 via CHECK constraint', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "intentions" ("player_id","start_time","duration_minutes","acceptable_wait_minutes","end_time","expires_at")
           VALUES (1,'2026-06-15T14:00:00+08:00',361,30,'2026-06-15T20:01:00+08:00','2026-06-15T14:30:00+08:00')`,
        ),
      ).rejects.toThrow(/CHK_intentions_duration/);
    });

    it('should cascade delete intention when player is deleted', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const intentionRepo = dataSource.getRepository(Intention);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138005',
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

      await playerRepo.remove(player);

      const found = await intentionRepo.findOne({
        where: { id: savedIntention.id },
      });
      expect(found).toBeNull();
    });

    it('should allow optional fields to be null', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const intentionRepo = dataSource.getRepository(Intention);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138006',
      );
      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');

      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 120,
        expiresAt,
      });
      const saved = await intentionRepo.save(intention);

      expect(saved.matchId).toBeNull();
      expect(saved.regionCode).toBeNull();
    });
  });
});
