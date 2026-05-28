/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource } from 'typeorm';
import { VenueManager } from './venue-manager.entity';
import { User } from './user.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { hashForQuery } from '@common/utils/encrypt.util';

describe('VenueManager Entity', () => {
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
    await dataSource.query('TRUNCATE TABLE venue_time_slots CASCADE');
    await dataSource.query('TRUNCATE TABLE venues CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_managers CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('table structure', () => {
    it('should create venue_managers table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'venue_managers'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('company_name');
      expect(columnNames).toContain('contact_name');
      expect(columnNames).toContain('contact_phone');
      expect(columnNames).toContain('created_at');
    });

    it('should have foreign key to users', async () => {
      const fks = await dataSource.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_name = 'venue_managers' AND constraint_type = 'FOREIGN KEY'`,
      );
      expect(fks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('entity creation', () => {
    it('should create a venue manager linked to a user', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const phone = '13900139000';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'VenueOwner',
        userType: 'venue_manager',
        status: 'active',
      });
      const savedUser = await userRepo.save(user);

      const vm = vmRepo.create({
        userId: savedUser.id,
        companyName: 'Test Sports Co.',
        contactName: '李四',
        contactPhone: '13900139001',
      });
      const saved = await vmRepo.save(vm);

      expect(saved.id).toBeDefined();
      expect(saved.userId).toBe(savedUser.id);
      expect(saved.companyName).toBe('Test Sports Co.');
      expect(saved.contactName).toBe('李四');
      expect(saved.contactPhone).toBe('13900139001');
      expect(saved.createdAt).toBeInstanceOf(Date);
    });

    it('should enforce unique user_id', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);

      const phone1 = '13900139002';
      const user1 = userRepo.create({
        phone: phone1,
        phoneHash: hashForQuery(phone1),
        passwordHash: 'hashed_password',
        nickname: 'Owner1',
        userType: 'venue_manager',
        status: 'active',
      });
      const savedUser1 = await userRepo.save(user1);

      const phone2 = '13900139003';
      const user2 = userRepo.create({
        phone: phone2,
        phoneHash: hashForQuery(phone2),
        passwordHash: 'hashed_password',
        nickname: 'Owner2',
        userType: 'venue_manager',
        status: 'active',
      });
      await userRepo.save(user2);

      const vm1 = vmRepo.create({
        userId: savedUser1.id,
        companyName: 'Company1',
        contactName: 'Owner1',
        contactPhone: '13900139004',
      });
      await vmRepo.save(vm1);

      const vm2 = vmRepo.create({
        userId: savedUser1.id,
        companyName: 'Company2',
        contactName: 'Owner2',
        contactPhone: '13900139005',
      });
      await expect(vmRepo.save(vm2)).rejects.toThrow();
    });

    it('should cascade delete when user is deleted', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const phone = '13900139006';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'Owner',
        userType: 'venue_manager',
        status: 'active',
      });
      const savedUser = await userRepo.save(user);

      const vm = vmRepo.create({
        userId: savedUser.id,
        companyName: 'Company',
        contactName: 'Owner',
        contactPhone: '13900139007',
      });
      await vmRepo.save(vm);

      const userId = savedUser.id;
      await userRepo.remove(savedUser);

      const found = await vmRepo.findOne({ where: { userId } });
      expect(found).toBeNull();
    });
  });
});
