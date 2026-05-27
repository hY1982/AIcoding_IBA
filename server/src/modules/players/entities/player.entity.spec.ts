/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { DataSource } from 'typeorm';
import { Player } from './player.entity';
import { User } from '@modules/users/entities/user.entity';
import { hashForQuery } from '@common/utils/encrypt.util';

describe('Player Entity', () => {
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
      entities: [User, Player],
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE players CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('table structure', () => {
    it('should create players table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'players'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('age');
      expect(columnNames).toContain('basketball_age');
      expect(columnNames).toContain('gender');
      expect(columnNames).toContain('height');
      expect(columnNames).toContain('weight');
      expect(columnNames).toContain('wingspan');
      expect(columnNames).toContain('standing_reach');
      expect(columnNames).toContain('jumping_reach');
      expect(columnNames).toContain('base_ability_score');
      expect(columnNames).toContain('match_adjust_value');
      expect(columnNames).toContain('total_ability_score');
      expect(columnNames).toContain('region_code');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    it('should have total_ability_score as generated column', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, generation_expression
         FROM information_schema.columns
         WHERE table_name = 'players' AND column_name = 'total_ability_score'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].generation_expression).toBeTruthy();
      expect(columns[0].generation_expression).toContain('base_ability_score');
      expect(columns[0].generation_expression).toContain('match_adjust_value');
    });

    it('should have foreign key to users', async () => {
      const fks = await dataSource.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_name = 'players' AND constraint_type = 'FOREIGN KEY'`,
      );
      expect(fks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('entity creation', () => {
    it('should create a player with required fields', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const phone = '13700137000';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'BallPlayer',
        userType: 'player',
        status: 'active',
      });
      const savedUser = await userRepo.save(user);

      const player = playerRepo.create({
        userId: savedUser.id,
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
        weight: 75.5,
        wingspan: 190,
        standingReach: 230,
        jumpingReach: 310,
        baseAbilityScore: 50.0,
        matchAdjustValue: 5.0,
      });
      const saved = await playerRepo.save(player);

      expect(saved.id).toBeDefined();
      expect(saved.userId).toBe(savedUser.id);
      expect(saved.age).toBe(25);
      expect(saved.basketballAge).toBe(5);
      expect(saved.gender).toBe('male');
      expect(saved.height).toBe(180);
      expect(saved.weight).toBe(75.5);
      expect(saved.wingspan).toBe(190);
      expect(saved.standingReach).toBe(230);
      expect(saved.jumpingReach).toBe(310);
      expect(parseFloat(saved.baseAbilityScore as unknown as string)).toBe(
        50.0,
      );
      expect(parseFloat(saved.matchAdjustValue as unknown as string)).toBe(5.0);
    });

    it('should compute total_ability_score correctly', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const phone = '13700137001';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'Player2',
        userType: 'player',
        status: 'active',
      });
      const savedUser = await userRepo.save(user);

      const player = playerRepo.create({
        userId: savedUser.id,
        age: 22,
        basketballAge: 3,
        gender: 'female',
        height: 165,
        baseAbilityScore: 45.5,
        matchAdjustValue: 3.5,
      });
      await playerRepo.save(player);

      // Query raw to verify generated column
      const raw = await dataSource.query(
        'SELECT total_ability_score FROM players WHERE user_id = $1',
        [savedUser.id],
      );

      expect(parseFloat(raw[0].total_ability_score)).toBe(49.0);

      // Also verify through repository (decrypted/transformed)
      const found = await playerRepo.findOne({
        where: { userId: savedUser.id },
      });
      expect(parseFloat(found!.totalAbilityScore as unknown as string)).toBe(
        49.0,
      );
    });

    it('should reject invalid gender', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const phone = '13700137002';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'Player3',
        userType: 'player',
        status: 'active',
      });
      const savedUser = await userRepo.save(user);

      const player = playerRepo.create({
        userId: savedUser.id,
        age: 20,
        basketballAge: 2,
        gender: 'unknown' as 'male',
        height: 170,
        baseAbilityScore: 40.0,
        matchAdjustValue: 0.0,
      });

      await expect(playerRepo.save(player)).rejects.toThrow();
    });

    it('should enforce unique user_id', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);

      const phone1 = '13700137003';
      const user1 = userRepo.create({
        phone: phone1,
        phoneHash: hashForQuery(phone1),
        passwordHash: 'hashed_password',
        nickname: 'PlayerA',
        userType: 'player',
        status: 'active',
      });
      const savedUser1 = await userRepo.save(user1);

      const phone2 = '13700137004';
      const user2 = userRepo.create({
        phone: phone2,
        phoneHash: hashForQuery(phone2),
        passwordHash: 'hashed_password',
        nickname: 'PlayerB',
        userType: 'player',
        status: 'active',
      });
      await userRepo.save(user2);

      const player1 = playerRepo.create({
        userId: savedUser1.id,
        age: 20,
        basketballAge: 2,
        gender: 'male',
        height: 170,
        baseAbilityScore: 40.0,
        matchAdjustValue: 0.0,
      });
      await playerRepo.save(player1);

      const player2 = playerRepo.create({
        userId: savedUser1.id,
        age: 21,
        basketballAge: 3,
        gender: 'male',
        height: 175,
        baseAbilityScore: 42.0,
        matchAdjustValue: 0.0,
      });
      await expect(playerRepo.save(player2)).rejects.toThrow();
    });

    it('should cascade delete when user is deleted', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const phone = '13700137005';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'PlayerC',
        userType: 'player',
        status: 'active',
      });
      const savedUser = await userRepo.save(user);

      const player = playerRepo.create({
        userId: savedUser.id,
        age: 20,
        basketballAge: 2,
        gender: 'male',
        height: 170,
        baseAbilityScore: 40.0,
        matchAdjustValue: 0.0,
      });
      await playerRepo.save(player);

      const userId = savedUser.id;
      await userRepo.remove(savedUser);

      const found = await playerRepo.findOne({ where: { userId } });
      expect(found).toBeNull();
    });

    it('should allow optional fields to be null', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const phone = '13700137006';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'MinimalPlayer',
        userType: 'player',
        status: 'active',
      });
      const savedUser = await userRepo.save(user);

      const player = playerRepo.create({
        userId: savedUser.id,
        age: 20,
        basketballAge: 1,
        gender: 'male',
        height: 170,
        baseAbilityScore: 30.0,
        matchAdjustValue: 0.0,
      });
      const saved = await playerRepo.save(player);

      expect(saved.weight).toBeNull();
      expect(saved.wingspan).toBeNull();
      expect(saved.standingReach).toBeNull();
      expect(saved.jumpingReach).toBeNull();
      expect(saved.regionCode).toBeNull();
    });
  });
});
