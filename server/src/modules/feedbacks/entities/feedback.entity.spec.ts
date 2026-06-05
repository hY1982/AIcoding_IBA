/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource, Repository } from 'typeorm';
import { Feedback } from './feedback.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { MatchMessage } from '@modules/messages/entities/match-message.entity';
import {
  createTestFeedback,
  createTestMatch,
  createTestPlayer,
} from '../../../../test/factories/feedback.factory';

describe('Feedback Entity', () => {
  let dataSource: DataSource;
  let feedbackRepo: Repository<Feedback>;

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
        Feedback,
      ],
      synchronize: true,
    });
    await dataSource.initialize();
    feedbackRepo = dataSource.getRepository(Feedback);
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE feedbacks CASCADE');
    await dataSource.query('TRUNCATE TABLE match_messages CASCADE');
    await dataSource.query('TRUNCATE TABLE match_teams CASCADE');
    await dataSource.query('TRUNCATE TABLE match_players CASCADE');
    await dataSource.query('TRUNCATE TABLE matches CASCADE');
    await dataSource.query('TRUNCATE TABLE formats CASCADE');
    await dataSource.query('TRUNCATE TABLE venues CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_managers CASCADE');
    await dataSource.query('TRUNCATE TABLE players CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('table structure', () => {
    it('should create feedbacks table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedbacks'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('match_id');
      expect(columnNames).toContain('player_id');
      expect(columnNames).toContain('overall_rating');
      expect(columnNames).toContain('overall_reason');
      expect(columnNames).toContain('submitted_at');
      expect(columnNames).toContain('region_code');
    });

    it('should have id as bigint primary key', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedbacks' AND column_name = 'id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have match_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedbacks' AND column_name = 'match_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have player_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedbacks' AND column_name = 'player_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have overall_rating as integer non-nullable', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedbacks' AND column_name = 'overall_rating'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('integer');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have overall_reason as nullable varchar(500)', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedbacks' AND column_name = 'overall_reason'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('character varying');
      expect(columns[0].character_maximum_length).toBe(500);
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have submitted_at as timestamptz', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedbacks' AND column_name = 'submitted_at'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('timestamp with time zone');
    });

    it('should have region_code as nullable varchar(20)', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedbacks' AND column_name = 'region_code'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('character varying');
      expect(columns[0].character_maximum_length).toBe(20);
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have unique constraint on (match_id, player_id)', async () => {
      const constraints = await dataSource.query(
        `SELECT constraint_name, constraint_type
         FROM information_schema.table_constraints
         WHERE table_name = 'feedbacks' AND constraint_type = 'UNIQUE'`,
      );
      // TypeORM synchronize generates auto-named unique index (not constraint in information_schema)
      // We verify the functional behavior (duplicate rejection) in entity creation tests
      expect(constraints.length).toBeGreaterThanOrEqual(1);
    });

    it('should have foreign keys to matches and players', async () => {
      const fks = await dataSource.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_name = 'feedbacks' AND constraint_type = 'FOREIGN KEY'`,
      );
      expect(fks.length).toBeGreaterThanOrEqual(2);
    });

    it('should have CHECK constraint on overall_rating between 1 and 5', async () => {
      const checks = await dataSource.query(
        `SELECT constraint_name, constraint_type
         FROM information_schema.table_constraints
         WHERE table_name = 'feedbacks' AND constraint_type = 'CHECK'`,
      );
      const ratingCheck = checks.find((c: { constraint_name: string }) =>
        c.constraint_name.toLowerCase().includes('overall_rating'),
      );
      expect(ratingCheck).toBeDefined();
    });
  });

  describe('entity creation', () => {
    it('should create a feedback with all fields', async () => {
      const feedback = await createTestFeedback(dataSource, {
        overallRating: 4,
        overallReason: 'Great match!',
        regionCode: 'shenzhen_futian',
      });

      expect(feedback.id).toBeDefined();
      expect(feedback.matchId).toBeDefined();
      expect(feedback.playerId).toBeDefined();
      expect(feedback.overallRating).toBe(4);
      expect(feedback.overallReason).toBe('Great match!');
      expect(feedback.submittedAt).toBeInstanceOf(Date);
      expect(feedback.regionCode).toBe('shenzhen_futian');
    });

    it('should accept overall_rating at boundary values 1 and 5', async () => {
      const feedback1 = await createTestFeedback(dataSource, {
        overallRating: 1,
      });
      expect(feedback1.overallRating).toBe(1);

      const feedback5 = await createTestFeedback(dataSource, {
        overallRating: 5,
      });
      expect(feedback5.overallRating).toBe(5);
    });

    it('should reject overall_rating of 0', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);

      const feedback = feedbackRepo.create({
        matchId: match.id,
        playerId: player.id,
        overallRating: 0,
      });

      await expect(feedbackRepo.save(feedback)).rejects.toThrow();
    });

    it('should reject overall_rating of 6', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);

      const feedback = feedbackRepo.create({
        matchId: match.id,
        playerId: player.id,
        overallRating: 6,
      });

      await expect(feedbackRepo.save(feedback)).rejects.toThrow();
    });

    it('should reject duplicate feedback from same player for same match', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);

      const feedback1 = feedbackRepo.create({
        matchId: match.id,
        playerId: player.id,
        overallRating: 4,
      });
      await feedbackRepo.save(feedback1);

      const feedback2 = feedbackRepo.create({
        matchId: match.id,
        playerId: player.id,
        overallRating: 5,
      });

      await expect(feedbackRepo.save(feedback2)).rejects.toThrow();
    });

    it('should allow optional fields to be null', async () => {
      const feedback = await createTestFeedback(dataSource);

      expect(feedback.overallReason).toBeNull();
      expect(feedback.regionCode).toBeNull();
    });

    it('should cascade delete feedbacks when match is deleted', async () => {
      const feedback = await createTestFeedback(dataSource);
      const matchRepo = dataSource.getRepository(Match);
      const match = await matchRepo.findOne({
        where: { id: feedback.matchId },
      });
      expect(match).not.toBeNull();

      await matchRepo.remove(match!);

      const found = await feedbackRepo.findOne({ where: { id: feedback.id } });
      expect(found).toBeNull();
    });
  });
});
