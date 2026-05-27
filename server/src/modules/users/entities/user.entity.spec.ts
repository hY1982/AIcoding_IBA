/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource } from 'typeorm';
import { User } from './user.entity';
import { hashForQuery } from '@common/utils/encrypt.util';

describe('User Entity', () => {
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
      entities: [User],
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('table structure', () => {
    it('should create users table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'users'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('phone');
      expect(columnNames).toContain('phone_hash');
      expect(columnNames).toContain('password_hash');
      expect(columnNames).toContain('nickname');
      expect(columnNames).toContain('real_name');
      expect(columnNames).toContain('id_card');
      expect(columnNames).toContain('avatar_url');
      expect(columnNames).toContain('user_type');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('region_code');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    it('should have unique constraint on phone_hash', async () => {
      const constraints = await dataSource.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_name = 'users' AND constraint_type = 'UNIQUE'`,
      );
      expect(constraints.length).toBeGreaterThanOrEqual(1);

      // Verify the column has unique constraint by trying to insert duplicate
      const userRepo = dataSource.getRepository(User);
      const phone = '13800138099';
      const phoneHash = hashForQuery(phone);

      const user1 = userRepo.create({
        phone,
        phoneHash,
        passwordHash: 'hashed_password',
        nickname: 'User1',
        userType: 'player',
        status: 'active',
      });
      await userRepo.save(user1);

      const user2 = userRepo.create({
        phone: '13800138098',
        phoneHash,
        passwordHash: 'hashed_password',
        nickname: 'User2',
        userType: 'player',
        status: 'active',
      });
      await expect(userRepo.save(user2)).rejects.toThrow();
    });
  });

  describe('entity creation', () => {
    it('should create a user with required fields', async () => {
      const userRepo = dataSource.getRepository(User);
      const phone = '13800138000';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'TestUser',
        userType: 'player',
        status: 'active',
      });

      const saved = await userRepo.save(user);

      expect(saved.id).toBeDefined();
      expect(saved.phone).toBe(phone);
      expect(saved.phoneHash).toBe(hashForQuery(phone));
      expect(saved.nickname).toBe('TestUser');
      expect(saved.userType).toBe('player');
      expect(saved.status).toBe('active');
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it('should encrypt phone field on save', async () => {
      const userRepo = dataSource.getRepository(User);
      const phone = '13800138000';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'TestUser',
        userType: 'player',
        status: 'active',
      });

      await userRepo.save(user);

      // Query raw to verify encryption
      const raw = await dataSource.query(
        'SELECT phone FROM users WHERE phone_hash = $1',
        [hashForQuery(phone)],
      );

      expect(raw[0].phone).not.toBe(phone);
      expect(raw[0].phone.startsWith('v1:')).toBe(true);
    });

    it('should decrypt phone field on read', async () => {
      const userRepo = dataSource.getRepository(User);
      const phone = '13800138001';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'TestUser2',
        userType: 'player',
        status: 'active',
      });

      await userRepo.save(user);

      const found = await userRepo.findOne({
        where: { phoneHash: hashForQuery(phone) },
      });
      expect(found).toBeDefined();
      expect(found!.phone).toBe(phone);
    });

    it('should reject invalid user_type', async () => {
      const userRepo = dataSource.getRepository(User);

      const user = userRepo.create({
        phone: '13800138002',
        phoneHash: hashForQuery('13800138002'),
        passwordHash: 'hashed_password',
        nickname: 'TestUser',
        userType: 'invalid_type' as 'player',
        status: 'active',
      });

      await expect(userRepo.save(user)).rejects.toThrow();
    });

    it('should reject invalid status', async () => {
      const userRepo = dataSource.getRepository(User);

      const user = userRepo.create({
        phone: '13800138003',
        phoneHash: hashForQuery('13800138003'),
        passwordHash: 'hashed_password',
        nickname: 'TestUser',
        userType: 'player',
        status: 'invalid_status' as 'active',
      });

      await expect(userRepo.save(user)).rejects.toThrow();
    });

    it('should enforce unique phone_hash', async () => {
      const userRepo = dataSource.getRepository(User);
      const phone = '13800138004';
      const phoneHash = hashForQuery(phone);

      const user1 = userRepo.create({
        phone,
        phoneHash,
        passwordHash: 'hashed_password',
        nickname: 'User1',
        userType: 'player',
        status: 'active',
      });

      const user2 = userRepo.create({
        phone: '13800138005',
        phoneHash,
        passwordHash: 'hashed_password',
        nickname: 'User2',
        userType: 'player',
        status: 'active',
      });

      await userRepo.save(user1);
      await expect(userRepo.save(user2)).rejects.toThrow();
    });

    it('should allow optional fields to be null', async () => {
      const userRepo = dataSource.getRepository(User);
      const phone = '13800138006';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'MinimalUser',
        userType: 'venue_manager',
        status: 'active',
      });

      const saved = await userRepo.save(user);
      expect(saved.realName).toBeNull();
      expect(saved.idCard).toBeNull();
      expect(saved.avatarUrl).toBeNull();
      expect(saved.regionCode).toBeNull();
    });

    it('should encrypt real_name and id_card when provided', async () => {
      const userRepo = dataSource.getRepository(User);
      const phone = '13800138007';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'FullUser',
        userType: 'player',
        status: 'active',
        realName: '张三',
        idCard: '110101199001011234',
      });

      await userRepo.save(user);

      const raw = await dataSource.query(
        'SELECT real_name, id_card FROM users WHERE phone_hash = $1',
        [hashForQuery(phone)],
      );

      expect(raw[0].real_name).not.toBe('张三');
      expect(raw[0].id_card).not.toBe('110101199001011234');
      expect(raw[0].real_name.startsWith('v1:')).toBe(true);
      expect(raw[0].id_card.startsWith('v1:')).toBe(true);

      const found = await userRepo.findOne({
        where: { phoneHash: hashForQuery(phone) },
      });
      expect(found!.realName).toBe('张三');
      expect(found!.idCard).toBe('110101199001011234');
    });
  });
});
