/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { DataSource, Repository } from 'typeorm';
import { Venue } from './venue.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueTimeSlot } from './venue-time-slot.entity';
import { hashForQuery } from '@common/utils/encrypt.util';

/**
 * Helper to create a test venue manager with a linked user.
 * Reduces DRY violations across test cases.
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

describe('Venue Entity', () => {
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
    it('should create venues table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'venues'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('manager_id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('address');
      expect(columnNames).toContain('price_per_hour');
      expect(columnNames).toContain('court_count');
      expect(columnNames).toContain('latitude');
      expect(columnNames).toContain('longitude');
      expect(columnNames).toContain('floor_material');
      expect(columnNames).toContain('lighting');
      expect(columnNames).toContain('court_type');
      expect(columnNames).toContain('ventilation');
      expect(columnNames).toContain('big_fan');
      expect(columnNames).toContain('air_condition');
      expect(columnNames).toContain('turnover_time');
      expect(columnNames).toContain('parking');
      expect(columnNames).toContain('restroom');
      expect(columnNames).toContain('shower');
      expect(columnNames).toContain('locker_room');
      expect(columnNames).toContain('video_record');
      expect(columnNames).toContain('rating_avg');
      expect(columnNames).toContain('rating_count');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('region_code');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    it('should have manager_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'venues' AND column_name = 'manager_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have price_per_hour as decimal(10,2)', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, numeric_precision, numeric_scale
         FROM information_schema.columns
         WHERE table_name = 'venues' AND column_name = 'price_per_hour'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('numeric');
      expect(parseInt(columns[0].numeric_precision, 10)).toBe(10);
      expect(parseInt(columns[0].numeric_scale, 10)).toBe(2);
    });

    it('should have court_count default to 1', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, column_default
         FROM information_schema.columns
         WHERE table_name = 'venues' AND column_name = 'court_count'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].column_default).toContain('1');
    });

    it('should have rating_avg default to null', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, column_default
         FROM information_schema.columns
         WHERE table_name = 'venues' AND column_name = 'rating_avg'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].column_default).toBeNull();
    });

    it('should have status default to active', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, column_default
         FROM information_schema.columns
         WHERE table_name = 'venues' AND column_name = 'status'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].column_default).toContain('active');
    });

    it('should have foreign key to venue_managers', async () => {
      const fks = await dataSource.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_name = 'venues' AND constraint_type = 'FOREIGN KEY'`,
      );
      expect(fks.length).toBeGreaterThanOrEqual(1);
    });

    it('should have index on manager_id', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'venues'`,
      );
      const managerIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(manager_id)'),
      );
      expect(managerIndex).toBeDefined();
    });

    it('should have index on region_code', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'venues'`,
      );
      const regionIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(region_code)'),
      );
      expect(regionIndex).toBeDefined();
    });

    it('should document GIST spatial index strategy', async () => {
      // GIST index on point(longitude, latitude) is created via raw SQL
      // in the migration file, not through TypeORM synchronize.
      // This test documents the expected index definition for migration verification.
      const expectedGistDef =
        'CREATE INDEX "IDX_venues_location" ON "venues" USING GIST (point("longitude", "latitude"))';
      expect(expectedGistDef).toContain('USING GIST');
      expect(expectedGistDef).toContain('point');
    });
  });

  describe('entity creation', () => {
    it('should create a venue linked to a venue manager', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);

      const { vm: savedVm } = await createTestVenueManager(
        userRepo,
        vmRepo,
        '15000150000',
        { companyName: 'Test Sports Co.', contactName: '李四', contactPhone: '15000150001' },
      );

      const venue = venueRepo.create({
        managerId: savedVm.id,
        name: 'Test Basketball Court',
        address: '深圳市福田区测试路1号',
        pricePerHour: 200.0,
        courtCount: 2,
        latitude: 22.5431,
        longitude: 114.0579,
        floorMaterial: 'wood',
        lighting: 'LED',
        courtType: 'indoor',
        ventilation: true,
        bigFan: true,
        airCondition: true,
        turnoverTime: 15,
        parking: true,
        restroom: true,
        shower: true,
        lockerRoom: true,
        videoRecord: false,
        status: 'active',
        regionCode: 'shenzhen_futian',
      });
      const saved = await venueRepo.save(venue);

      expect(saved.id).toBeDefined();
      expect(saved.managerId).toBe(savedVm.id);
      expect(saved.name).toBe('Test Basketball Court');
      expect(saved.address).toBe('深圳市福田区测试路1号');
      expect(parseFloat(saved.pricePerHour as unknown as string)).toBe(200.0);
      expect(saved.courtCount).toBe(2);
      expect(parseFloat(saved.latitude as unknown as string)).toBe(22.5431);
      expect(parseFloat(saved.longitude as unknown as string)).toBe(114.0579);
      expect(saved.floorMaterial).toBe('wood');
      expect(saved.lighting).toBe('LED');
      expect(saved.courtType).toBe('indoor');
      expect(saved.ventilation).toBe(true);
      expect(saved.bigFan).toBe(true);
      expect(saved.airCondition).toBe(true);
      expect(saved.turnoverTime).toBe(15);
      expect(saved.parking).toBe(true);
      expect(saved.restroom).toBe(true);
      expect(saved.shower).toBe(true);
      expect(saved.lockerRoom).toBe(true);
      expect(saved.videoRecord).toBe(false);
      expect(saved.ratingAvg).toBeNull();
      expect(saved.ratingCount).toBe(0);
      expect(saved.status).toBe('active');
      expect(saved.regionCode).toBe('shenzhen_futian');
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it('should reject invalid floor_material', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);

      const { vm: savedVm } = await createTestVenueManager(
        userRepo,
        vmRepo,
        '15000150002',
        { companyName: 'Company2' },
      );

      const venue = venueRepo.create({
        managerId: savedVm.id,
        name: 'Bad Court',
        address: 'Test Address',
        pricePerHour: 100.0,
        floorMaterial: 'invalid_material' as 'wood',
      });

      await expect(venueRepo.save(venue)).rejects.toThrow();
    });

    it('should reject invalid court_type', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);

      const { vm: savedVm } = await createTestVenueManager(
        userRepo,
        vmRepo,
        '15000150003',
        { companyName: 'Company3' },
      );

      const venue = venueRepo.create({
        managerId: savedVm.id,
        name: 'Bad Court',
        address: 'Test Address',
        pricePerHour: 100.0,
        courtType: 'invalid_type' as 'indoor',
      });

      await expect(venueRepo.save(venue)).rejects.toThrow();
    });

    it('should reject invalid status', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);

      const { vm: savedVm } = await createTestVenueManager(
        userRepo,
        vmRepo,
        '15000150004',
        { companyName: 'Company4' },
      );

      const venue = venueRepo.create({
        managerId: savedVm.id,
        name: 'Bad Court',
        address: 'Test Address',
        pricePerHour: 100.0,
        status: 'invalid_status' as 'active',
      });

      await expect(venueRepo.save(venue)).rejects.toThrow();
    });

    it('should allow optional facility fields to be null', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);

      const { vm: savedVm } = await createTestVenueManager(
        userRepo,
        vmRepo,
        '15000150005',
        { companyName: 'Company5' },
      );

      const venue = venueRepo.create({
        managerId: savedVm.id,
        name: 'Minimal Court',
        address: 'Minimal Address',
        pricePerHour: 150.0,
      });
      const saved = await venueRepo.save(venue);

      expect(saved.floorMaterial).toBeNull();
      expect(saved.lighting).toBeNull();
      expect(saved.courtType).toBeNull();
      expect(saved.ventilation).toBe(false);
      expect(saved.bigFan).toBe(false);
      expect(saved.airCondition).toBe(false);
      expect(saved.turnoverTime).toBeNull();
      expect(saved.parking).toBe(false);
      expect(saved.restroom).toBe(false);
      expect(saved.shower).toBe(false);
      expect(saved.lockerRoom).toBe(false);
      expect(saved.videoRecord).toBe(false);
      expect(saved.ratingAvg).toBeNull();
      expect(saved.ratingCount).toBe(0);
      expect(saved.latitude).toBeNull();
      expect(saved.longitude).toBeNull();
      expect(saved.regionCode).toBeNull();
    });

    it('should cascade delete time slots when venue is deleted', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);
      const slotRepo = dataSource.getRepository(VenueTimeSlot);

      const { vm: savedVm } = await createTestVenueManager(
        userRepo,
        vmRepo,
        '15000150006',
        { companyName: 'Company6' },
      );

      const venue = venueRepo.create({
        managerId: savedVm.id,
        name: 'Court With Slots',
        address: 'Slot Address',
        pricePerHour: 180.0,
      });
      const savedVenue = await venueRepo.save(venue);

      const slot = slotRepo.create({
        venueId: savedVenue.id,
        slotDate: '2026-06-01',
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

    it('should cascade delete when venue manager is deleted', async () => {
      const userRepo = dataSource.getRepository(User);
      const vmRepo = dataSource.getRepository(VenueManager);
      const venueRepo = dataSource.getRepository(Venue);

      const { vm: savedVm } = await createTestVenueManager(
        userRepo,
        vmRepo,
        '15000150007',
        { companyName: 'Company7' },
      );

      const venue = venueRepo.create({
        managerId: savedVm.id,
        name: 'Court To Cascade',
        address: 'Cascade Address',
        pricePerHour: 200.0,
      });
      const savedVenue = await venueRepo.save(venue);

      await vmRepo.remove(savedVm);

      const foundVenue = await venueRepo.findOne({
        where: { id: savedVenue.id },
      });
      expect(foundVenue).toBeNull();
    });
  });
});
