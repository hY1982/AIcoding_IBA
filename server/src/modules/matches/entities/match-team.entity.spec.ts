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
  createTestMatchTeam,
} from '../../../../test/factories/match.factory';

describe('MatchTeam Entity', () => {
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
    it('should create match_teams table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'match_teams'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('match_id');
      expect(columnNames).toContain('team_number');
      expect(columnNames).toContain('team_name');
      expect(columnNames).toContain('avg_ability');
    });

    it('should have match_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'match_teams' AND column_name = 'match_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have team_number as non-nullable int', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'match_teams' AND column_name = 'team_number'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('integer');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have team_name as nullable varchar(50)', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'match_teams' AND column_name = 'team_name'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('character varying');
      expect(columns[0].character_maximum_length).toBe(50);
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have avg_ability as nullable decimal(5,2)', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'match_teams' AND column_name = 'avg_ability'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('numeric');
      expect(columns[0].numeric_precision).toBe(5);
      expect(columns[0].numeric_scale).toBe(2);
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have unique constraint on match_id + team_number', async () => {
      const constraints = await dataSource.query(
        `SELECT constraint_name, constraint_type
         FROM information_schema.table_constraints
         WHERE table_name = 'match_teams' AND constraint_type = 'UNIQUE'`,
      );
      const uniqueConstraint = constraints.find(
        (c: { constraint_name: string }) =>
          c.constraint_name.includes('match_team') ||
          c.constraint_name.startsWith('UQ_'),
      );
      expect(uniqueConstraint).toBeDefined();
    });
  });

  describe('entity creation', () => {
    it('should create a match team', async () => {
      const match = await createTestMatch(dataSource);

      const mt = await createTestMatchTeam(dataSource, match.id, 1, {
        teamName: 'A队',
        avgAbility: 65.5,
      });

      expect(mt.id).toBeDefined();
      expect(mt.matchId).toBe(match.id);
      expect(mt.teamNumber).toBe(1);
      expect(mt.teamName).toBe('A队');
      expect(mt.avgAbility).toBe(65.5);
    });

    it('should reject duplicate match_id + team_number', async () => {
      const match = await createTestMatch(dataSource);

      await createTestMatchTeam(dataSource, match.id, 1);

      await expect(
        createTestMatchTeam(dataSource, match.id, 1),
      ).rejects.toThrow();
    });

    it('should cascade delete when match deleted', async () => {
      const match = await createTestMatch(dataSource);
      const matchTeam = await createTestMatchTeam(dataSource, match.id, 1);

      const matchRepo = dataSource.getRepository(Match);
      await matchRepo.remove(match);

      const mtRepo = dataSource.getRepository(MatchTeam);
      const found = await mtRepo.findOne({ where: { id: matchTeam.id } });
      expect(found).toBeNull();
    });
  });
});
