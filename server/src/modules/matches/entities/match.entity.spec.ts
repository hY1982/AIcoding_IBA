/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource, Repository } from 'typeorm';
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
  createTestMatchTeam,
  createTestMatchMessage,
} from '../../../../test/factories/match.factory';

describe('Match Entity', () => {
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
    it('should create matches table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'matches'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('venue_id');
      expect(columnNames).toContain('format_id');
      expect(columnNames).toContain('start_time');
      expect(columnNames).toContain('end_time');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('team_count');
      expect(columnNames).toContain('players_per_team');
      expect(columnNames).toContain('total_players');
      expect(columnNames).toContain('confirmed_players');
      expect(columnNames).toContain('deposit_amount');
      expect(columnNames).toContain('group_chat_id');
      expect(columnNames).toContain('region_code');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    it('should have id as bigint primary key', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'matches' AND column_name = 'id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have venue_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'matches' AND column_name = 'venue_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have format_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'matches' AND column_name = 'format_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have start_time and end_time as timestamptz non-nullable', async () => {
      for (const col of ['start_time', 'end_time']) {
        const columns = await dataSource.query(
          `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
           WHERE table_name = 'matches' AND column_name = '${col}'`,
        );
        expect(columns.length).toBe(1);
        expect(columns[0].data_type).toBe('timestamp with time zone');
        expect(columns[0].is_nullable).toBe('NO');
      }
    });

    it('should have status as enum non-nullable with default pending_confirmation', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable, column_default, udt_name
         FROM information_schema.columns
         WHERE table_name = 'matches' AND column_name = 'status'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('USER-DEFINED');
      expect(columns[0].udt_name).toBe('matches_status_enum');
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('pending_confirmation');
    });

    it('should have team_count, players_per_team, total_players as int non-nullable', async () => {
      for (const col of ['team_count', 'players_per_team', 'total_players']) {
        const columns = await dataSource.query(
          `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
           WHERE table_name = 'matches' AND column_name = '${col}'`,
        );
        expect(columns.length).toBe(1);
        expect(columns[0].data_type).toBe('integer');
        expect(columns[0].is_nullable).toBe('NO');
      }
    });

    it('should have confirmed_players as int with default 0', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = 'matches' AND column_name = 'confirmed_players'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('integer');
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('0');
    });

    it('should have deposit_amount as decimal(10,2) non-nullable', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'matches' AND column_name = 'deposit_amount'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('numeric');
      expect(columns[0].numeric_precision).toBe(10);
      expect(columns[0].numeric_scale).toBe(2);
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have group_chat_id as nullable varchar(100)', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'matches' AND column_name = 'group_chat_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('character varying');
      expect(columns[0].character_maximum_length).toBe(100);
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have region_code as nullable varchar(20)', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'matches' AND column_name = 'region_code'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('character varying');
      expect(columns[0].character_maximum_length).toBe(20);
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have foreign keys to venues and formats', async () => {
      const fks = await dataSource.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_name = 'matches' AND constraint_type = 'FOREIGN KEY'`,
      );
      expect(fks.length).toBeGreaterThanOrEqual(2);
    });

    it('should have index on status', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'matches'`,
      );
      const statusIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(status)'),
      );
      expect(statusIndex).toBeDefined();
    });

    it('should have index on start_time', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'matches'`,
      );
      const timeIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(start_time)'),
      );
      expect(timeIndex).toBeDefined();
    });

    it('should have composite index on venue_id and start_time', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'matches'`,
      );
      const venueTimeIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(venue_id, start_time)'),
      );
      expect(venueTimeIndex).toBeDefined();
    });

    it('should have index on region_code', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'matches'`,
      );
      const regionIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(region_code)'),
      );
      expect(regionIndex).toBeDefined();
    });
  });

  describe('entity creation', () => {
    it('should create a match with all fields', async () => {
      const match = await createTestMatch(dataSource, {
        teamCount: 3,
        playersPerTeam: 3,
        totalPlayers: 9,
        depositAmount: 50.0,
        groupChatId: 'room_123',
        regionCode: 'shenzhen_futian',
      });

      expect(match.id).toBeDefined();
      expect(match.venueId).toBeDefined();
      expect(match.formatId).toBeDefined();
      expect(match.startTime).toBeInstanceOf(Date);
      expect(match.endTime).toBeInstanceOf(Date);
      expect(match.status).toBe('pending_confirmation');
      expect(match.teamCount).toBe(3);
      expect(match.playersPerTeam).toBe(3);
      expect(match.totalPlayers).toBe(9);
      expect(match.confirmedPlayers).toBe(0);
      expect(match.depositAmount).toBe(50.0);
      expect(match.groupChatId).toBe('room_123');
      expect(match.regionCode).toBe('shenzhen_futian');
      expect(match.createdAt).toBeInstanceOf(Date);
      expect(match.updatedAt).toBeInstanceOf(Date);
    });

    it('should default status to pending_confirmation', async () => {
      const match = await createTestMatch(dataSource);
      expect(match.status).toBe('pending_confirmation');
    });

    it('should default confirmed_players to 0', async () => {
      const match = await createTestMatch(dataSource);
      expect(match.confirmedPlayers).toBe(0);
    });

    it('should reject invalid status', async () => {
      const matchRepo = dataSource.getRepository(Match);
      const venue = await createTestMatch(dataSource);

      const invalidMatch = matchRepo.create({
        venueId: venue.venueId,
        formatId: venue.formatId,
        startTime: new Date(),
        endTime: new Date(),
        teamCount: 3,
        playersPerTeam: 3,
        totalPlayers: 9,
        depositAmount: 50,
        status: 'invalid_status' as 'pending_confirmation',
      });

      await expect(matchRepo.save(invalidMatch)).rejects.toThrow();
    });

    it('should cascade delete match_players when match deleted', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);
      const matchPlayer = await createTestMatchPlayer(
        dataSource,
        match.id,
        player.id,
      );

      const matchRepo = dataSource.getRepository(Match);
      await matchRepo.remove(match);

      const mpRepo = dataSource.getRepository(MatchPlayer);
      const found = await mpRepo.findOne({ where: { id: matchPlayer.id } });
      expect(found).toBeNull();
    });

    it('should cascade delete match_teams when match deleted', async () => {
      const match = await createTestMatch(dataSource);
      const matchTeam = await createTestMatchTeam(dataSource, match.id, 1);

      const matchRepo = dataSource.getRepository(Match);
      await matchRepo.remove(match);

      const mtRepo = dataSource.getRepository(MatchTeam);
      const found = await mtRepo.findOne({ where: { id: matchTeam.id } });
      expect(found).toBeNull();
    });

    it('should cascade delete match_messages when match deleted', async () => {
      const match = await createTestMatch(dataSource);
      const user = await createTestPlayer(dataSource);
      const message = await createTestMatchMessage(
        dataSource,
        match.id,
        user.userId,
      );

      const matchRepo = dataSource.getRepository(Match);
      await matchRepo.remove(match);

      const msgRepo = dataSource.getRepository(MatchMessage);
      const found = await msgRepo.findOne({ where: { id: message.id } });
      expect(found).toBeNull();
    });

    it('should allow optional fields to be null', async () => {
      const match = await createTestMatch(dataSource);

      expect(match.groupChatId).toBeNull();
    });
  });
});
