/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { DataSource, Repository } from 'typeorm';
import { VenueTimeSlot } from './venue-time-slot.entity';
import { Venue } from './venue.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { User } from '@modules/users/entities/user.entity';
import { hashForQuery } from '@common/utils/encrypt.util';

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

describe('VenueTimeSlot Entity', () => {
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
      entities: [User, VenueManager, Venue, VenueTimeSlot],
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
    it('should create venue_time_slots table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'venue_time_slots'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('venue_id');
      expect(columnNames).toContain('slot_date');
      expect(columnNames).toContain('start_time');
      expect(columnNames).toContain('end_time');
      expect(columnNames).toContain('is_booked');
      expect(columnNames).toContain('match_id');
      expect(columnNames).toContain('created_at');
    });

    it('should have venue_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'venue_time_slots' AND column_name = 'venue_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have slot_date as date type', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type
         FROM information_schema.columns
         WHERE table_name = 'venue_time_slots' AND column_name = 'slot_date'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('date');
    });

    it('should have start_time and end_time as time type', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type
         FROM information_schema.columns
         WHERE table_name = 'venue_time_slots'
         AND column_name IN ('start_time', 'end_time')
         ORDER BY column_name`,
      );
      expect(columns.length).toBe(2);
      for (const col of columns) {
        expect(col.data_type).toBe('time without time zone');
      }
    });

    it('should have is_booked default to false', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, column_default
         FROM information_schema.columns
         WHERE table_name = 'venue_time_slots' AND column_name = 'is_booked'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].column_default).toContain('false');
    });

    it('should have foreign key to venues', async () => {
      const fks = await dataSource.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_name = 'venue_time_slots' AND constraint_type = 'FOREIGN KEY'`,
      );
      expect(fks.length).toBeGreaterThanOrEqual(1);
    });

    it('should have composite index on venue_id and slot_date', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'venue_time_slots'`,
      );
      const compositeIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(venue_id, slot_date)'),
      );
      expect(compositeIndex).toBeDefined();
    });
  });

  describe('entity creation', () => {
    it('should create a time slot linked to a venue', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);
      const slotRepo = dataSource.getRepository(VenueTimeSlot);

      const { vm: savedVm } = await createTestVenueManager(
        userRepo,
        vmRepo,
        '15100151000',
        { companyName: 'Slot Company' },
      );

      const venue = venueRepo.create({
        managerId: savedVm.id,
        name: 'Slot Court',
        address: 'Slot Address',
        pricePerHour: 200.0,
      });
      const savedVenue = await venueRepo.save(venue);

      const slot = slotRepo.create({
        venueId: savedVenue.id,
        slotDate: '2026-06-15',
        startTime: '14:00:00',
        endTime: '16:00:00',
      });
      const saved = await slotRepo.save(slot);

      expect(saved.id).toBeDefined();
      expect(saved.venueId).toBe(savedVenue.id);
      expect(saved.slotDate).toBe('2026-06-15');
      expect(saved.startTime).toBe('14:00:00');
      expect(saved.endTime).toBe('16:00:00');
      expect(saved.isBooked).toBe(false);
      expect(saved.matchId).toBeNull();
      expect(saved.createdAt).toBeInstanceOf(Date);
    });

    it('should allow multiple slots for same venue on same date', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);
      const slotRepo = dataSource.getRepository(VenueTimeSlot);

      const { vm: savedVm } = await createTestVenueManager(
        userRepo,
        vmRepo,
        '15100151001',
        { companyName: 'Multi Company' },
      );

      const venue = venueRepo.create({
        managerId: savedVm.id,
        name: 'Multi Slot Court',
        address: 'Multi Address',
        pricePerHour: 200.0,
      });
      const savedVenue = await venueRepo.save(venue);

      const slot1 = slotRepo.create({
        venueId: savedVenue.id,
        slotDate: '2026-06-20',
        startTime: '09:00:00',
        endTime: '11:00:00',
      });
      const slot2 = slotRepo.create({
        venueId: savedVenue.id,
        slotDate: '2026-06-20',
        startTime: '11:00:00',
        endTime: '13:00:00',
      });
      const slot3 = slotRepo.create({
        venueId: savedVenue.id,
        slotDate: '2026-06-20',
        startTime: '14:00:00',
        endTime: '16:00:00',
      });

      const saved1 = await slotRepo.save(slot1);
      const saved2 = await slotRepo.save(slot2);
      const saved3 = await slotRepo.save(slot3);

      expect(saved1.id).toBeDefined();
      expect(saved2.id).toBeDefined();
      expect(saved3.id).toBeDefined();
    });

    it('should default is_booked to false', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);
      const slotRepo = dataSource.getRepository(VenueTimeSlot);

      const { vm: savedVm } = await createTestVenueManager(
        userRepo,
        vmRepo,
        '15100151002',
        { companyName: 'Default Company' },
      );

      const venue = venueRepo.create({
        managerId: savedVm.id,
        name: 'Default Court',
        address: 'Default Address',
        pricePerHour: 200.0,
      });
      const savedVenue = await venueRepo.save(venue);

      const slot = slotRepo.create({
        venueId: savedVenue.id,
        slotDate: '2026-06-25',
        startTime: '10:00:00',
        endTime: '12:00:00',
      });
      const saved = await slotRepo.save(slot);

      expect(saved.isBooked).toBe(false);
    });

    it('should allow match_id to be null', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);
      const slotRepo = dataSource.getRepository(VenueTimeSlot);

      const { vm: savedVm } = await createTestVenueManager(
        userRepo,
        vmRepo,
        '15100151003',
        { companyName: 'NullMatch Company' },
      );

      const venue = venueRepo.create({
        managerId: savedVm.id,
        name: 'NullMatch Court',
        address: 'NullMatch Address',
        pricePerHour: 200.0,
      });
      const savedVenue = await venueRepo.save(venue);

      const slot = slotRepo.create({
        venueId: savedVenue.id,
        slotDate: '2026-06-30',
        startTime: '18:00:00',
        endTime: '20:00:00',
      });
      const saved = await slotRepo.save(slot);

      expect(saved.matchId).toBeNull();
    });

    it('should cascade delete when venue is deleted', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);
      const slotRepo = dataSource.getRepository(VenueTimeSlot);

      const { vm: savedVm } = await createTestVenueManager(
        userRepo,
        vmRepo,
        '15100151004',
        { companyName: 'Cascade Company' },
      );

      const venue = venueRepo.create({
        managerId: savedVm.id,
        name: 'Cascade Court',
        address: 'Cascade Address',
        pricePerHour: 200.0,
      });
      const savedVenue = await venueRepo.save(venue);

      const slot = slotRepo.create({
        venueId: savedVenue.id,
        slotDate: '2026-07-01',
        startTime: '09:00:00',
        endTime: '11:00:00',
      });
      await slotRepo.save(slot);

      await venueRepo.remove(savedVenue);

      const foundSlot = await slotRepo.findOne({
        where: { venueId: savedVenue.id },
      });
      expect(foundSlot).toBeNull();
    });
  });
});
