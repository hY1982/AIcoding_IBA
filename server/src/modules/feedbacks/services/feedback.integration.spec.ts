import { DataSource, Repository } from 'typeorm';
import { FeedbackService } from './feedback.service';
import { AbilityAdjustService } from './ability-adjust.service';
import { FeedbackAdjustSyncService } from './feedback-adjust-sync.service';
import { Feedback } from '@modules/feedbacks/entities/feedback.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { Player } from '@modules/players/entities/player.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { MatchMessage } from '@modules/messages/entities/match-message.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { AdjustUpdateFailure } from '@modules/feedbacks/entities/adjust-update-failure.entity';
import {
  createTestMatch,
  createTestPlayer,
  createTestUser,
} from '../../../../test/factories/match.factory';
import {
  createTestFeedback,
  createTestSystemParam,
} from '../../../../test/factories/feedback.factory';

describe('Feedback Integration Tests', () => {
  let dataSource: DataSource;
  let feedbackService: FeedbackService;
  let abilityAdjustService: AbilityAdjustService;
  let syncService: FeedbackAdjustSyncService;
  let feedbackRepo: Repository<Feedback>;
  let ratingRepo: Repository<FeedbackPlayerRating>;
  let matchRepo: Repository<Match>;
  let matchPlayerRepo: Repository<MatchPlayer>;
  let playerRepo: Repository<Player>;
  let systemParamRepo: Repository<SystemParam>;

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
        AdjustUpdateFailure,
        SystemParam,
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    feedbackRepo = dataSource.getRepository(Feedback);
    ratingRepo = dataSource.getRepository(FeedbackPlayerRating);
    matchRepo = dataSource.getRepository(Match);
    matchPlayerRepo = dataSource.getRepository(MatchPlayer);
    playerRepo = dataSource.getRepository(Player);
    systemParamRepo = dataSource.getRepository(SystemParam);
    const failureRepo = dataSource.getRepository(AdjustUpdateFailure);

    abilityAdjustService = new AbilityAdjustService(systemParamRepo);
    feedbackService = new FeedbackService(
      feedbackRepo,
      ratingRepo,
      matchRepo,
      matchPlayerRepo,
      playerRepo,
      failureRepo,
      abilityAdjustService,
      dataSource,
    );
    syncService = new FeedbackAdjustSyncService(
      feedbackRepo,
      ratingRepo,
      playerRepo,
      abilityAdjustService,
      dataSource,
    );
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE adjust_update_failures CASCADE');
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
    await dataSource.query('TRUNCATE TABLE system_params CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  // ==================== Helper ====================

  async function seedSystemParams() {
    await createTestSystemParam(dataSource, {
      paramKey: 'ability_adjust_weights',
      paramValue: {
        level_match: { unclear: 0, lower: -1, equal: 0, higher: 1 },
        sportsmanship: { good: 1, average: 0, poor: -1 },
        action_cleanliness: { clean: 1, average: 0, dirty: -2 },
        punctuality: { true: 1, false: -1 },
      },
    });
  }

  // ==================== End-to-End Flow ====================

  describe('end-to-end feedback flow', () => {
    it('should create feedback and update matchAdjustValue', async () => {
      await seedSystemParams();

      // 创建比赛和球员
      const match = await createTestMatch(dataSource, { status: 'completed' });
      const playerA = await createTestPlayer(dataSource);
      const playerB = await createTestPlayer(dataSource);

      // 创建 match_players 关联
      const mpRepo = dataSource.getRepository(MatchPlayer);
      await mpRepo.save([
        { matchId: match.id, playerId: playerA.id, status: 'confirmed' },
        { matchId: match.id, playerId: playerB.id, status: 'confirmed' },
      ]);

      // 提交反馈
      const result = await feedbackService.createFeedback({
        matchId: match.id,
        playerId: playerA.id,
        overallRating: 5,
        overallReason: 'Excellent!',
        playerRatings: [
          {
            ratedPlayerId: playerB.id,
            levelMatch: 'equal',
            sportsmanship: 'good',
            actionCleanliness: 'clean',
            isPunctual: true,
          },
        ],
      });

      expect(result.id).toBeDefined();
      expect(result.matchId).toBe(match.id);
      expect(result.playerId).toBe(playerA.id);

      // 验证 playerB 的 matchAdjustValue 已更新
      const updatedPlayerB = await playerRepo.findOne({
        where: { id: playerB.id },
      });
      // decimal 类型从数据库读取为字符串，需转换为数字比较
      const adjustValueB = parseFloat(String(updatedPlayerB!.matchAdjustValue));
      expect(adjustValueB).not.toBe(0);
      // equal(0) + good(1) + clean(1) + true(1) = 3
      expect(adjustValueB).toBe(3);
    });

    it('should reject duplicate feedback', async () => {
      await seedSystemParams();

      const match = await createTestMatch(dataSource, { status: 'completed' });
      const playerA = await createTestPlayer(dataSource);
      const playerB = await createTestPlayer(dataSource);

      const mpRepo = dataSource.getRepository(MatchPlayer);
      await mpRepo.save([
        { matchId: match.id, playerId: playerA.id, status: 'confirmed' },
        { matchId: match.id, playerId: playerB.id, status: 'confirmed' },
      ]);

      // 第一次提交
      await feedbackService.createFeedback({
        matchId: match.id,
        playerId: playerA.id,
        overallRating: 4,
        playerRatings: [{ ratedPlayerId: playerB.id, levelMatch: 'equal' }],
      });

      // 第二次提交应被拒绝
      await expect(
        feedbackService.createFeedback({
          matchId: match.id,
          playerId: playerA.id,
          overallRating: 5,
          playerRatings: [{ ratedPlayerId: playerB.id, levelMatch: 'equal' }],
        }),
      ).rejects.toThrow(/已提交过反馈/);
    });

    it('should reject self-rating', async () => {
      await seedSystemParams();

      const match = await createTestMatch(dataSource, { status: 'completed' });
      const playerA = await createTestPlayer(dataSource);

      const mpRepo = dataSource.getRepository(MatchPlayer);
      await mpRepo.save([
        { matchId: match.id, playerId: playerA.id, status: 'confirmed' },
      ]);

      await expect(
        feedbackService.createFeedback({
          matchId: match.id,
          playerId: playerA.id,
          overallRating: 4,
          playerRatings: [{ ratedPlayerId: playerA.id, levelMatch: 'equal' }],
        }),
      ).rejects.toThrow(/不可对自己进行评价/);
    });

    it('should reject feedback when match is not completed', async () => {
      await seedSystemParams();

      const match = await createTestMatch(dataSource, {
        status: 'pending_confirmation',
      });
      const playerA = await createTestPlayer(dataSource);
      const playerB = await createTestPlayer(dataSource);

      const mpRepo = dataSource.getRepository(MatchPlayer);
      await mpRepo.save([
        { matchId: match.id, playerId: playerA.id, status: 'confirmed' },
        { matchId: match.id, playerId: playerB.id, status: 'confirmed' },
      ]);

      await expect(
        feedbackService.createFeedback({
          matchId: match.id,
          playerId: playerA.id,
          overallRating: 4,
          playerRatings: [{ ratedPlayerId: playerB.id, levelMatch: 'equal' }],
        }),
      ).rejects.toThrow(/比赛状态为 pending_confirmation/);
    });

    it('should find pending feedbacks correctly', async () => {
      await seedSystemParams();

      const match = await createTestMatch(dataSource, { status: 'completed' });
      const playerA = await createTestPlayer(dataSource);

      const mpRepo = dataSource.getRepository(MatchPlayer);
      await mpRepo.save([
        { matchId: match.id, playerId: playerA.id, status: 'confirmed' },
      ]);

      const pending = await feedbackService.findPendingFeedbacks(playerA.id);
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(match.id);

      // 提交反馈后不应再出现
      await feedbackService.createFeedback({
        matchId: match.id,
        playerId: playerA.id,
        overallRating: 4,
        playerRatings: [],
      });

      const pendingAfter = await feedbackService.findPendingFeedbacks(
        playerA.id,
      );
      expect(pendingAfter.length).toBe(0);
    });

    it('should sync matchAdjustValue correctly via sync service', async () => {
      await seedSystemParams();

      const match = await createTestMatch(dataSource, { status: 'completed' });
      const playerA = await createTestPlayer(dataSource);
      const playerB = await createTestPlayer(dataSource);

      const mpRepo = dataSource.getRepository(MatchPlayer);
      await mpRepo.save([
        { matchId: match.id, playerId: playerA.id, status: 'confirmed' },
        { matchId: match.id, playerId: playerB.id, status: 'confirmed' },
      ]);

      // 手动创建 feedback（绕过自动更新）
      const feedback = await feedbackRepo.save({
        matchId: match.id,
        playerId: playerA.id,
        overallRating: 4,
        overallReason: null,
        regionCode: null,
      });

      await ratingRepo.save({
        feedbackId: feedback.id,
        ratedPlayerId: playerB.id,
        levelMatch: 'higher',
        sportsmanship: 'good',
        actionCleanliness: 'clean',
        isPunctual: true,
      });

      // playerB 的 matchAdjustValue 应该还是 0
      const playerBBefore = await playerRepo.findOne({
        where: { id: playerB.id },
      });
      const beforeValue = parseFloat(String(playerBBefore!.matchAdjustValue));
      expect(beforeValue).toBe(0);

      // 执行同步
      const result = await syncService.syncPendingAdjustUpdates();
      expect(result.processed).toBeGreaterThanOrEqual(1);

      // 同步后应该更新
      const playerBAfter = await playerRepo.findOne({
        where: { id: playerB.id },
      });
      const afterValue = parseFloat(String(playerBAfter!.matchAdjustValue));
      expect(afterValue).toBe(4); // higher(1)+good(1)+clean(1)+true(1)=4
    });
  });
});
