/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource, Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { createTestNotification, createTestUser } from '../../../../test/factories/feedback.factory';

describe('Notification Entity', () => {
  let dataSource: DataSource;
  let notificationRepo: Repository<Notification>;

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
      entities: [User, VenueManager, Player, Venue, VenueTimeSlot, IntentionVenue, IntentionFormat, Intention, Format, Notification],
      synchronize: true,
    });
    await dataSource.initialize();
    notificationRepo = dataSource.getRepository(Notification);
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE notifications CASCADE');
    await dataSource.query('TRUNCATE TABLE players CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_managers CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('table structure', () => {
    it('should create notifications table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'notifications'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('type');
      expect(columnNames).toContain('title');
      expect(columnNames).toContain('content');
      expect(columnNames).toContain('data');
      expect(columnNames).toContain('is_read');
      expect(columnNames).toContain('send_status');
      expect(columnNames).toContain('sent_at');
      expect(columnNames).toContain('sent_via');
      expect(columnNames).toContain('region_code');
      expect(columnNames).toContain('created_at');
    });

    it('should have id as bigint primary key', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'notifications' AND column_name = 'id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have user_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'notifications' AND column_name = 'user_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have type as non-nullable enum', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, udt_name, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'notifications' AND column_name = 'type'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('USER-DEFINED');
      expect(columns[0].udt_name).toBe('notifications_type_enum');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have title as non-nullable varchar(200)', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'notifications' AND column_name = 'title'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('character varying');
      expect(columns[0].character_maximum_length).toBe(200);
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have content as non-nullable text', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'notifications' AND column_name = 'content'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('text');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have is_read as boolean with default false', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = 'notifications' AND column_name = 'is_read'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('boolean');
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('false');
    });

    it('should have send_status as enum with default pending', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable, column_default, udt_name
         FROM information_schema.columns
         WHERE table_name = 'notifications' AND column_name = 'send_status'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('USER-DEFINED');
      expect(columns[0].udt_name).toBe('notifications_send_status_enum');
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('pending');
    });

    it('should have sent_at as nullable timestamptz', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'notifications' AND column_name = 'sent_at'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('timestamp with time zone');
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have sent_via as array type', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, udt_name, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'notifications' AND column_name = 'sent_via'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].udt_name).toBe('_varchar');
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have data as nullable jsonb', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'notifications' AND column_name = 'data'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('jsonb');
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have region_code as nullable varchar(20)', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'notifications' AND column_name = 'region_code'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('character varying');
      expect(columns[0].character_maximum_length).toBe(20);
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have created_at as timestamptz', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'notifications' AND column_name = 'created_at'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('timestamp with time zone');
    });

    it('should have foreign key to users with CASCADE delete', async () => {
      const fks = await dataSource.query(
        `SELECT constraint_name, delete_rule
         FROM information_schema.referential_constraints
         WHERE constraint_name IN (
           SELECT constraint_name
           FROM information_schema.table_constraints
           WHERE table_name = 'notifications' AND constraint_type = 'FOREIGN KEY'
         )`,
      );
      expect(fks.length).toBeGreaterThanOrEqual(1);
      expect(fks[0].delete_rule).toBe('CASCADE');
    });

    it('should have composite index on (user_id, is_read, created_at)', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'notifications'`,
      );
      const compositeIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(user_id, is_read, created_at)'),
      );
      expect(compositeIndex).toBeDefined();
    });

    it('should have index on region_code', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'notifications'`,
      );
      const regionIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(region_code)'),
      );
      expect(regionIndex).toBeDefined();
    });
  });

  describe('entity creation', () => {
    it('should create a notification with all fields', async () => {
      const user = await createTestUser(dataSource);
      const notification = await createTestNotification(dataSource, {
        userId: user.id,
        type: 'match_invited',
        title: '比赛邀请',
        content: '您被邀请参加一场比赛',
        data: { matchId: 123 },
        sentVia: ['push', 'in_app'],
        regionCode: 'shenzhen_futian',
      });

      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe(user.id);
      expect(notification.type).toBe('match_invited');
      expect(notification.title).toBe('比赛邀请');
      expect(notification.content).toBe('您被邀请参加一场比赛');
      expect(notification.data).toEqual({ matchId: 123 });
      expect(notification.isRead).toBe(false);
      expect(notification.sendStatus).toBe('pending');
      expect(notification.sentAt).toBeNull();
      expect(notification.sentVia).toEqual(['push', 'in_app']);
      expect(notification.regionCode).toBe('shenzhen_futian');
      expect(notification.createdAt).toBeInstanceOf(Date);
    });

    it('should default is_read to false and send_status to pending', async () => {
      const notification = await createTestNotification(dataSource);

      expect(notification.isRead).toBe(false);
      expect(notification.sendStatus).toBe('pending');
    });

    it('should allow optional fields to be null', async () => {
      const notification = await createTestNotification(dataSource);

      expect(notification.data).toBeNull();
      expect(notification.sentAt).toBeNull();
      expect(notification.sentVia).toBeNull();
      expect(notification.regionCode).toBeNull();
    });

    it('should cascade delete notifications when user is deleted', async () => {
      const user = await createTestUser(dataSource);
      const notification = await createTestNotification(dataSource, {
        userId: user.id,
      });

      const userRepo = dataSource.getRepository(User);
      await userRepo.remove(user);

      const found = await notificationRepo.findOne({ where: { id: notification.id } });
      expect(found).toBeNull();
    });
  });
});
