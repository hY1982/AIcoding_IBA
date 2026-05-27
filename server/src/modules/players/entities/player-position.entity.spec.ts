/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource } from 'typeorm';
import { PlayerPosition } from './player-position.entity';
import { Player } from './player.entity';
import { User } from '@modules/users/entities/user.entity';
import { hashForQuery } from '@common/utils/encrypt.util';

describe('PlayerPosition Entity', () => {
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
      entities: [User, Player, PlayerPosition],
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE player_positions CASCADE');
    await dataSource.query('TRUNCATE TABLE players CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('table structure', () => {
    it('should create player_positions table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'player_positions'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('player_id');
      expect(columnNames).toContain('position');
      expect(columnNames).toContain('priority');
    });

    it('should have foreign key to players', async () => {
      const fks = await dataSource.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_name = 'player_positions' AND constraint_type = 'FOREIGN KEY'`,
      );
      expect(fks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('entity creation', () => {
    it('should create player positions', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const posRepo = dataSource.getRepository(PlayerPosition);
      const phone = '13600136000';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'PositionPlayer',
        userType: 'player',
        status: 'active',
      });
      const savedUser = await userRepo.save(user);

      const player = playerRepo.create({
        userId: savedUser.id,
        age: 22,
        basketballAge: 3,
        gender: 'male',
        height: 185,
        baseAbilityScore: 55.0,
        matchAdjustValue: 0.0,
      });
      const savedPlayer = await playerRepo.save(player);

      const pos1 = posRepo.create({
        playerId: savedPlayer.id,
        position: 'SG',
        priority: 1,
      });
      const pos2 = posRepo.create({
        playerId: savedPlayer.id,
        position: 'SF',
        priority: 2,
      });

      const saved1 = await posRepo.save(pos1);
      const saved2 = await posRepo.save(pos2);

      expect(saved1.id).toBeDefined();
      expect(saved1.playerId).toBe(savedPlayer.id);
      expect(saved1.position).toBe('SG');
      expect(saved1.priority).toBe(1);

      expect(saved2.position).toBe('SF');
      expect(saved2.priority).toBe(2);
    });

    it('should reject invalid position', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const posRepo = dataSource.getRepository(PlayerPosition);
      const phone = '13600136001';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'BadPos',
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
      const savedPlayer = await playerRepo.save(player);

      const pos = posRepo.create({
        playerId: savedPlayer.id,
        position: 'INVALID' as 'PG',
        priority: 1,
      });

      await expect(posRepo.save(pos)).rejects.toThrow();
    });

    it('should enforce unique player_id + position', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const posRepo = dataSource.getRepository(PlayerPosition);
      const phone = '13600136002';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'DupPos',
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
      const savedPlayer = await playerRepo.save(player);

      const pos1 = posRepo.create({
        playerId: savedPlayer.id,
        position: 'PG',
        priority: 1,
      });
      await posRepo.save(pos1);

      const pos2 = posRepo.create({
        playerId: savedPlayer.id,
        position: 'PG',
        priority: 2,
      });
      await expect(posRepo.save(pos2)).rejects.toThrow();
    });

    it('should cascade delete when player is deleted', async () => {
      const userRepo = dataSource.getRepository(User);
      const playerRepo = dataSource.getRepository(Player);
      const posRepo = dataSource.getRepository(PlayerPosition);
      const phone = '13600136003';

      const user = userRepo.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'CascadePos',
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
      const savedPlayer = await playerRepo.save(player);

      const pos = posRepo.create({
        playerId: savedPlayer.id,
        position: 'C',
        priority: 1,
      });
      await posRepo.save(pos);

      const playerId = savedPlayer.id;
      await playerRepo.remove(savedPlayer);

      const found = await posRepo.findOne({ where: { playerId } });
      expect(found).toBeNull();
    });
  });
});
