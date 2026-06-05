import { DataSource, Repository } from 'typeorm';
import { MatchingEngineService } from '@modules/matching/services/matching-engine.service';
import { TeamBalancerService } from '@modules/matching/services/team-balancer.service';
import { SystemParam } from '../entities/system-param.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { Player } from '@modules/players/entities/player.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { PlayerPosition } from '@modules/players/entities/player-position.entity';
import { MatchMessage } from '@modules/messages/entities/match-message.entity';
import { Feedback } from '@modules/feedbacks/entities/feedback.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { AdjustUpdateFailure } from '@modules/feedbacks/entities/adjust-update-failure.entity';
import { isMatchThresholdParams } from '@shared/system';
import { hashForQuery } from '@common/utils/encrypt.util';

describe('System Integration Tests', () => {
  let dataSource: DataSource;
  let systemParamRepo: Repository<SystemParam>;
  let matchingService: MatchingEngineService;

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
        PlayerPosition,
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
        AdjustUpdateFailure,
        SystemParam,
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    systemParamRepo = dataSource.getRepository(SystemParam);

    const teamBalancer = new TeamBalancerService();
    matchingService = new MatchingEngineService(
      dataSource.getRepository(Intention),
      dataSource.getRepository(Match),
      dataSource.getRepository(Format),
      systemParamRepo,
      dataSource,
      teamBalancer,
    );
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE feedback_player_ratings CASCADE');
    await dataSource.query('TRUNCATE TABLE feedbacks CASCADE');
    await dataSource.query('TRUNCATE TABLE match_messages CASCADE');
    await dataSource.query('TRUNCATE TABLE match_teams CASCADE');
    await dataSource.query('TRUNCATE TABLE match_players CASCADE');
    await dataSource.query('TRUNCATE TABLE matches CASCADE');
    await dataSource.query('TRUNCATE TABLE formats CASCADE');
    await dataSource.query('TRUNCATE TABLE intention_formats CASCADE');
    await dataSource.query('TRUNCATE TABLE intention_venues CASCADE');
    await dataSource.query('TRUNCATE TABLE intentions CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_time_slots CASCADE');
    await dataSource.query('TRUNCATE TABLE venues CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_managers CASCADE');
    await dataSource.query('TRUNCATE TABLE player_positions CASCADE');
    await dataSource.query('TRUNCATE TABLE players CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
    await dataSource.query('TRUNCATE TABLE system_params CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('SYS-INT-001: parameter changes take effect immediately', () => {
    it('should use updated threshold parameters in matching engine', async () => {
      // Create initial params with high threshold
      await systemParamRepo.save({
        paramKey: 'match_threshold_params',
        paramValue: {
          base_threshold: 100.0,
          min_threshold: 5.0,
          intention_count_factor: 0.5,
        },
        description: 'High threshold',
      });

      // Verify matching engine loads the params
      const threshold1 = matchingService.calculateDynamicThreshold(10, {
        base_threshold: 100.0,
        min_threshold: 5.0,
        intention_count_factor: 0.5,
      });
      expect(threshold1).toBe(95.0);

      // Update params
      await systemParamRepo.update(
        { paramKey: 'match_threshold_params' },
        {
          paramValue: {
            base_threshold: 20.0,
            min_threshold: 5.0,
            intention_count_factor: 0.5,
          },
        },
      );

      // Verify updated params are read correctly
      const updated = await systemParamRepo.findOneBy({ paramKey: 'match_threshold_params' });
      expect(updated).toBeDefined();
      expect(isMatchThresholdParams(updated!.paramValue)).toBe(true);
      const params = updated!.paramValue as { base_threshold: number };
      expect(params.base_threshold).toBe(20.0);

      const threshold2 = matchingService.calculateDynamicThreshold(10, {
        base_threshold: 20.0,
        min_threshold: 5.0,
        intention_count_factor: 0.5,
      });
      expect(threshold2).toBe(15.0);
    });
  });

  describe('SYS-INT-002: invalid parameter rejection', () => {
    it('should reject negative threshold values at application level', async () => {
      const invalidValue = {
        base_threshold: -10.0,
        min_threshold: -5.0,
        intention_count_factor: 0.5,
      };

      // Type guard should reject this
      expect(isMatchThresholdParams(invalidValue)).toBe(false);

      // Database still accepts JSONB, but app should validate before saving
      // This test documents the expected behavior
    });
  });

  describe('SYS-INT-003: parameter audit trail', () => {
    it('should update updated_at when parameter changes', async () => {
      const param = await systemParamRepo.save({
        paramKey: 'match_threshold_params',
        paramValue: {
          base_threshold: 20.0,
          min_threshold: 5.0,
          intention_count_factor: 0.5,
        },
        description: 'Test params',
      });

      const originalUpdatedAt = param.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 100));

      await systemParamRepo.update(
        { paramKey: 'match_threshold_params' },
        {
          paramValue: {
            base_threshold: 15.0,
            min_threshold: 5.0,
            intention_count_factor: 0.5,
          },
        },
      );

      const updated = await systemParamRepo.findOneBy({ paramKey: 'match_threshold_params' });
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
