/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource, Repository } from 'typeorm';
import { IntentionFormat } from './intention-format.entity';
import { IntentionVenue } from './intention-venue.entity';
import { Intention } from './intention.entity';
import { Player } from '@modules/players/entities/player.entity';
import { User } from '@modules/users/entities/user.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { hashForQuery } from '@common/utils/encrypt.util';

async function createTestUser(
  userRepo: Repository<User>,
  phone: string,
): Promise<User> {
  const user = userRepo.create({
    phone,
    phoneHash: hashForQuery(phone),
    passwordHash: 'hashed_password',
    nickname: `User_${phone.slice(-4)}`,
    userType: 'player',
    status: 'active',
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

async function createTestFormat(
  formatRepo: Repository<Format>,
  name: string,
): Promise<Format> {
  const format = formatRepo.create({
    name,
    formatType: 'short',
    teamSize: 3,
    teamCountMin: 3,
    teamCountMax: 4,
  });
  return formatRepo.save(format);
}

describe('IntentionFormat Entity', () => {
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
        IntentionFormat,
        IntentionVenue,
      ],
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE intention_formats CASCADE');
    await dataSource.query('TRUNCATE TABLE intentions CASCADE');
    await dataSource.query('TRUNCATE TABLE formats CASCADE');
    await dataSource.query('TRUNCATE TABLE players CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('table structure', () => {
    it('should create intention_formats table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'intention_formats'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('intention_id');
      expect(columnNames).toContain('format_id');
      expect(columnNames).toContain('priority');
    });

    it('should have intention_id and format_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'intention_formats'
         AND column_name IN ('intention_id', 'format_id')
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
         WHERE table_name = 'intention_formats' AND column_name = 'priority'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('integer');
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('1');
    });

    it('should have foreign keys to intentions and formats', async () => {
      const fks = await dataSource.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_name = 'intention_formats' AND constraint_type = 'FOREIGN KEY'`,
      );
      expect(fks.length).toBeGreaterThanOrEqual(2);
    });

    it('should have unique index on intention_id and format_id', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'intention_formats'`,
      );
      const uniqueIndex = indexes.find(
        (i: { indexdef: string }) =>
          i.indexdef.includes('UNIQUE') &&
          i.indexdef.includes('intention_id') &&
          i.indexdef.includes('format_id'),
      );
      expect(uniqueIndex).toBeDefined();
    });
  });

  describe('entity creation', () => {
    it('should create an intention-format association', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const formatRepo = dataSource.getRepository(Format);
      const intentionRepo = dataSource.getRepository(Intention);
      const ifRepo = dataSource.getRepository(IntentionFormat);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138020',
      );
      const format = await createTestFormat(formatRepo, '3v3短赛');

      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');
      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 120,
        expiresAt,
      });
      const savedIntention = await intentionRepo.save(intention);

      const intf = ifRepo.create({
        intentionId: savedIntention.id,
        formatId: format.id,
        priority: 1,
      });
      const saved = await ifRepo.save(intf);

      expect(saved.id).toBeDefined();
      expect(saved.intentionId).toBe(savedIntention.id);
      expect(saved.formatId).toBe(format.id);
      expect(saved.priority).toBe(1);
    });

    it('should reject duplicate format for same intention', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const formatRepo = dataSource.getRepository(Format);
      const intentionRepo = dataSource.getRepository(Intention);
      const ifRepo = dataSource.getRepository(IntentionFormat);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138021',
      );
      const format = await createTestFormat(formatRepo, '4v4短赛');

      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');
      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 120,
        expiresAt,
      });
      const savedIntention = await intentionRepo.save(intention);

      const intf1 = ifRepo.create({
        intentionId: savedIntention.id,
        formatId: format.id,
        priority: 1,
      });
      await ifRepo.save(intf1);

      const intf2 = ifRepo.create({
        intentionId: savedIntention.id,
        formatId: format.id,
        priority: 2,
      });

      await expect(ifRepo.save(intf2)).rejects.toThrow();
    });

    it('should cascade delete when intention is deleted', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const formatRepo = dataSource.getRepository(Format);
      const intentionRepo = dataSource.getRepository(Intention);
      const ifRepo = dataSource.getRepository(IntentionFormat);

      const player = await createTestPlayer(
        userRepo,
        playerRepo,
        '13800138022',
      );
      const format = await createTestFormat(formatRepo, '5v5短赛');

      const startTime = new Date('2026-06-15T14:00:00+08:00');
      const expiresAt = new Date('2026-06-15T14:30:00+08:00');
      const intention = intentionRepo.create({
        playerId: player.id,
        startTime,
        durationMinutes: 120,
        expiresAt,
      });
      const savedIntention = await intentionRepo.save(intention);

      const intf = ifRepo.create({
        intentionId: savedIntention.id,
        formatId: format.id,
        priority: 1,
      });
      const savedIntf = await ifRepo.save(intf);

      await intentionRepo.remove(savedIntention);

      const found = await ifRepo.findOne({ where: { id: savedIntf.id } });
      expect(found).toBeNull();
    });
  });
});
