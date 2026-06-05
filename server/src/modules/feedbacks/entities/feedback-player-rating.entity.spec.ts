/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource, Repository } from 'typeorm';
import { FeedbackPlayerRating } from './feedback-player-rating.entity';
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
  createTestFeedbackPlayerRating,
  createTestPlayer,
} from '../../../../test/factories/feedback.factory';

describe('FeedbackPlayerRating Entity', () => {
  let dataSource: DataSource;
  let ratingRepo: Repository<FeedbackPlayerRating>;

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
        FeedbackPlayerRating,
      ],
      synchronize: true,
    });
    await dataSource.initialize();
    ratingRepo = dataSource.getRepository(FeedbackPlayerRating);
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE feedback_player_ratings CASCADE');
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
    it('should create feedback_player_ratings table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedback_player_ratings'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('feedback_id');
      expect(columnNames).toContain('rated_player_id');
      expect(columnNames).toContain('level_match');
      expect(columnNames).toContain('sportsmanship');
      expect(columnNames).toContain('action_cleanliness');
      expect(columnNames).toContain('is_punctual');
      expect(columnNames).toContain('created_at');
    });

    it('should have id as bigint primary key', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedback_player_ratings' AND column_name = 'id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have feedback_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedback_player_ratings' AND column_name = 'feedback_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have rated_player_id as non-nullable bigint', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedback_player_ratings' AND column_name = 'rated_player_id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have enum columns as USER-DEFINED type', async () => {
      for (const col of [
        'level_match',
        'sportsmanship',
        'action_cleanliness',
      ]) {
        const columns = await dataSource.query(
          `SELECT column_name, data_type, udt_name, is_nullable
           FROM information_schema.columns
           WHERE table_name = 'feedback_player_ratings' AND column_name = '${col}'`,
        );
        expect(columns.length).toBe(1);
        expect(columns[0].data_type).toBe('USER-DEFINED');
        expect(columns[0].is_nullable).toBe('YES');
      }
    });

    it('should have is_punctual as boolean nullable', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedback_player_ratings' AND column_name = 'is_punctual'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('boolean');
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have created_at as timestamptz', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'feedback_player_ratings' AND column_name = 'created_at'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('timestamp with time zone');
    });

    it('should have foreign keys to feedbacks and players', async () => {
      const fks = await dataSource.query(
        `SELECT constraint_name, delete_rule
         FROM information_schema.referential_constraints
         WHERE constraint_name IN (
           SELECT constraint_name
           FROM information_schema.table_constraints
           WHERE table_name = 'feedback_player_ratings' AND constraint_type = 'FOREIGN KEY'
         )`,
      );
      expect(fks.length).toBeGreaterThanOrEqual(2);

      // Verify at least one FK has CASCADE delete (for feedback)
      const cascadeFk = fks.find(
        (fk: { delete_rule: string }) => fk.delete_rule === 'CASCADE',
      );
      expect(cascadeFk).toBeDefined();
    });
  });

  describe('entity creation', () => {
    it('should create a feedback player rating with all fields', async () => {
      const feedback = await createTestFeedback(dataSource);
      const ratedPlayer = await createTestPlayer(dataSource);

      const rating = await createTestFeedbackPlayerRating(
        dataSource,
        feedback.id,
        ratedPlayer.id,
        {
          levelMatch: 'equal',
          sportsmanship: 'good',
          actionCleanliness: 'clean',
          isPunctual: true,
        },
      );

      expect(rating.id).toBeDefined();
      expect(rating.feedbackId).toBe(feedback.id);
      expect(rating.ratedPlayerId).toBe(ratedPlayer.id);
      expect(rating.levelMatch).toBe('equal');
      expect(rating.sportsmanship).toBe('good');
      expect(rating.actionCleanliness).toBe('clean');
      expect(rating.isPunctual).toBe(true);
      expect(rating.createdAt).toBeInstanceOf(Date);
    });

    it('should allow optional enum fields to be null', async () => {
      const feedback = await createTestFeedback(dataSource);
      const ratedPlayer = await createTestPlayer(dataSource);

      const rating = await createTestFeedbackPlayerRating(
        dataSource,
        feedback.id,
        ratedPlayer.id,
      );

      expect(rating.levelMatch).toBeNull();
      expect(rating.sportsmanship).toBeNull();
      expect(rating.actionCleanliness).toBeNull();
      expect(rating.isPunctual).toBeNull();
    });

    it('should cascade delete ratings when feedback is deleted', async () => {
      const feedback = await createTestFeedback(dataSource);
      const ratedPlayer = await createTestPlayer(dataSource);
      const rating = await createTestFeedbackPlayerRating(
        dataSource,
        feedback.id,
        ratedPlayer.id,
      );

      const feedbackRepo = dataSource.getRepository(Feedback);
      await feedbackRepo.remove(feedback);

      const found = await ratingRepo.findOne({ where: { id: rating.id } });
      expect(found).toBeNull();
    });

    it('should reject invalid level_match enum value', async () => {
      const feedback = await createTestFeedback(dataSource);
      const ratedPlayer = await createTestPlayer(dataSource);

      const rating = ratingRepo.create({
        feedbackId: feedback.id,
        ratedPlayerId: ratedPlayer.id,
        levelMatch: 'invalid' as 'equal',
      });

      await expect(ratingRepo.save(rating)).rejects.toThrow();
    });

    it.skip('should reject self-rating at application layer', async () => {
      // 业务规则：rated_player_id 不能等于 feedback.player_id
      // 此约束在数据库层无法通过 CHECK 实现（不支持跨表子查询），
      // 由 FeedbackService 在提交反馈时进行应用层校验。
      // 待 Phase 2 FeedbackService 实现后启用此测试。
    });
  });
});
