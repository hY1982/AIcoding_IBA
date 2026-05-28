/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource } from 'typeorm';
import { Match } from './match.entity';
import { MatchPlayer } from './match-player.entity';
import { MatchTeam } from './match-team.entity';
import { MatchMessage } from '@modules/messages/entities/match-message.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import {
  createTestMatch,
  createTestPlayer,
  createTestMatchPlayer,
} from '../../../../test/factories/match.factory';

describe('MatchPlayer Entity', () => {
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
        Match,
        MatchPlayer,
        MatchTeam,
        MatchMessage,
      ],
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE match_messages CASCADE');
    await dataSource.query('TRUNCATE TABLE match_teams CASCADE');
    await dataSource.query('TRUNCATE TABLE match_players CASCADE');
    await dataSource.query('TRUNCATE TABLE matches CASCADE');
    await dataSource.query('TRUNCATE TABLE formats CASCADE');
    await dataSource.query('TRUNCATE TABLE venues CASCADE');
    await dataSource.query('TRUNCATE TABLE players CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_managers CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('table structure', () => {
    it('should create match_players table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'match_players'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('match_id');
      expect(columnNames).toContain('player_id');
      expect(columnNames).toContain('team_number');
      expect(columnNames).toContain('is_reserve');
      expect(columnNames).toContain('confirmed_at');
      expect(columnNames).toContain('deposit_paid');
      expect(columnNames).toContain('status');
      // is_confirmed is a derived getter, not a DB column
      expect(columnNames).not.toContain('is_confirmed');
    });

    it('should have match_id and player_id as non-nullable bigint', async () => {
      for (const col of ['match_id', 'player_id']) {
        const columns = await dataSource.query(
          `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
           WHERE table_name = 'match_players' AND column_name = '${col}'`,
        );
        expect(columns.length).toBe(1);
        expect(columns[0].data_type).toBe('bigint');
        expect(columns[0].is_nullable).toBe('NO');
      }
    });

    it('should have team_number as nullable int', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'match_players' AND column_name = 'team_number'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('integer');
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have is_reserve as boolean not null default false', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = 'match_players' AND column_name = 'is_reserve'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('boolean');
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('false');
    });

    it('should have deposit_paid as boolean not null default false', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = 'match_players' AND column_name = 'deposit_paid'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('boolean');
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('false');
    });

    it('should have status as enum default invited', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable, column_default, udt_name
         FROM information_schema.columns
         WHERE table_name = 'match_players' AND column_name = 'status'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('USER-DEFINED');
      expect(columns[0].udt_name).toBe('match_players_status_enum');
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('invited');
    });

    it('should have unique constraint on match_id + player_id', async () => {
      const constraints = await dataSource.query(
        `SELECT constraint_name, constraint_type
         FROM information_schema.table_constraints
         WHERE table_name = 'match_players' AND constraint_type = 'UNIQUE'`,
      );
      // TypeORM may generate constraint names like "UQ_xxx" or use the @Unique name
      const uniqueConstraint = constraints.find(
        (c: { constraint_name: string }) =>
          c.constraint_name.includes('match_player') ||
          c.constraint_name.startsWith('UQ_'),
      );
      expect(uniqueConstraint).toBeDefined();
    });

    it('should have index on match_id', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'match_players'`,
      );
      const matchIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(match_id)'),
      );
      expect(matchIndex).toBeDefined();
    });

    it('should have index on player_id', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'match_players'`,
      );
      const playerIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(player_id)'),
      );
      expect(playerIndex).toBeDefined();
    });
  });

  describe('entity creation', () => {
    it('should create a match_player association', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);

      const mp = await createTestMatchPlayer(dataSource, match.id, player.id, {
        teamNumber: 1,
        status: 'confirmed',
        depositPaid: true,
      });

      expect(mp.id).toBeDefined();
      expect(mp.matchId).toBe(match.id);
      expect(mp.playerId).toBe(player.id);
      expect(mp.teamNumber).toBe(1);
      expect(mp.isConfirmed).toBe(true); // derived from status
      expect(mp.isReserve).toBe(false);
      expect(mp.depositPaid).toBe(true);
      expect(mp.status).toBe('confirmed');
    });

    it('should reject duplicate match_id + player_id', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);

      await createTestMatchPlayer(dataSource, match.id, player.id);

      await expect(
        createTestMatchPlayer(dataSource, match.id, player.id),
      ).rejects.toThrow();
    });

    it('should default status to invited', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);

      const mp = await createTestMatchPlayer(dataSource, match.id, player.id);
      expect(mp.status).toBe('invited');
    });

    it('should reject invalid status', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);
      const mpRepo = dataSource.getRepository(MatchPlayer);

      const invalidMp = mpRepo.create({
        matchId: match.id,
        playerId: player.id,
        status: 'invalid_status' as 'invited',
      });

      await expect(mpRepo.save(invalidMp)).rejects.toThrow();
    });

    it('should protect match when player deleted due to NO ACTION foreign key', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);
      await createTestMatchPlayer(dataSource, match.id, player.id);

      const playerRepo = dataSource.getRepository(Player);
      // NO ACTION on player_id foreign key means deleting player should fail
      // if match_players still reference it
      await expect(playerRepo.remove(player)).rejects.toThrow();

      // Verify match still exists
      const matchRepo = dataSource.getRepository(Match);
      const foundMatch = await matchRepo.findOne({ where: { id: match.id } });
      expect(foundMatch).toBeDefined();
    });
  });
});
