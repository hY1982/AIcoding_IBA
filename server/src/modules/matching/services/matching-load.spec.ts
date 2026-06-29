import { TeamBalancerService, TeamAssignment } from './team-balancer.service';
import { MatchPoolService } from './match-pool.service';
import {
  IntentionAvatar,
  AvatarSource,
} from '../interfaces/intention-avatar.interface';
import {
  PoolingParams,
  MatchPool,
  MatchSegment,
} from '../interfaces/match-pool.interface';

/**
 * 绾�唴瀛樿礋杞芥祴璇?
 *
 * 鐩存帴娴嬭瘯鏍稿績绠楁硶鐨勬墽琛屾晥鐜囷紝涓嶄緷璧栨暟鎹�簱鎴栧�閮ㄦ湇鍔°€?
 * 楠岃瘉鍦ㄥぇ閲忕悆鍛樻暟鎹�笅锛屾剰鍚戝垎韬�瀯寤恒€佹瘮璧涙睜鍖栥€佸姩鎬佸垎娈?
 * 鍜岃泧褰㈠垎闃熺畻娉曠殑鎬ц兘琛ㄧ幇銆?
 */
describe('Matching Load Tests', () => {
  let teamBalancer: TeamBalancerService;
  let matchPoolService: MatchPoolService;

  beforeEach(() => {
    teamBalancer = new TeamBalancerService();
    matchPoolService = new MatchPoolService();
  });

  /**
   * 鐢熸垚鎸囧畾鏁伴噺鐨勬ā鎷熺悆鍛樻暟鎹?
   */
  function generatePlayers(
    count: number,
  ): Array<{ id: number; totalAbilityScore: number }> {
    const players: Array<{ id: number; totalAbilityScore: number }> = [];
    // 浣跨敤浼�殢鏈轰絾纭�畾鎬х殑绉嶅瓙锛屼繚璇佹祴璇曞彲閲嶅�
    let seed = 42;
    const random = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < count; i++) {
      // 鑳藉姏鍊艰寖鍥?30-90锛屾�鎬佸垎甯冭繎浼?
      const score = 30 + Math.floor(random() * 60);
      players.push({ id: i + 1, totalAbilityScore: score });
    }
    return players;
  }

  /**
   * 鐢熸垚妯℃嫙 AvatarSource 鏁版嵁锛堝惈鍦哄湴/璧涘埗鍋忓ソ锛?
   */
  function generateAvatarSources(count: number): AvatarSource[] {
    const players = generatePlayers(count);
    const baseTime = new Date('2026-06-15T14:00:00Z');
    const now = Date.now();
    let seed = 123;
    const random = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    return players.map((p, i) => ({
      intentionId: i + 1,
      playerId: p.id,
      totalAbilityScore: p.totalAbilityScore,
      venueIds: [(i % 3) + 1],
      formatIds: [1],
      startTime: new Date(baseTime.getTime() + Math.floor(random() * 4) * 30 * 60000),
      acceptableWaitMinutes: 30 + Math.floor(random() * 31),
      durationMinutes: 120 + Math.floor(random() * 61),
      submittedAt: new Date(now - i * 60000),
    }));
  }

  // ==================== Pooling Performance ====================

  describe('MatchPoolService Pooling Performance', () => {
    it('should build 100 avatars within 10ms', () => {
      const sources = generateAvatarSources(100);

      const start = Date.now();
      const avatars = matchPoolService.buildAvatars(sources);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
      expect(avatars.length).toBe(100); // 1 venue * 1 format = 1 avatar per source
    });

    it('should build 500 avatars within 50ms', () => {
      const sources = generateAvatarSources(500);

      const start = Date.now();
      const avatars = matchPoolService.buildAvatars(sources);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      expect(avatars.length).toBe(500);
    });

    it('should build 1000 avatars within 100ms', () => {
      const sources = generateAvatarSources(1000);

      const start = Date.now();
      const avatars = matchPoolService.buildAvatars(sources);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(avatars.length).toBe(1000);
    });

    it('should process 100 avatars into pools within 50ms', () => {
      const sources = generateAvatarSources(100);
      const avatars = matchPoolService.buildAvatars(sources);

      const start = Date.now();
      const result = matchPoolService.buildPools(avatars);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      expect(result.pools.length).toBeGreaterThan(0);
      expect(result.discardedAvatars).toBe(0);
    });

    it('should process 500 avatars into pools within 200ms', () => {
      const sources = generateAvatarSources(500);
      const avatars = matchPoolService.buildAvatars(sources);

      const start = Date.now();
      const result = matchPoolService.buildPools(avatars);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
      expect(result.pools.length).toBeGreaterThan(0);
    });

    it('should process 1000 avatars into pools within 500ms', () => {
      const sources = generateAvatarSources(1000);
      const avatars = matchPoolService.buildAvatars(sources);

      const start = Date.now();
      const result = matchPoolService.buildPools(avatars);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
      expect(result.pools.length).toBeGreaterThan(0);
    });
  });

  // ==================== Segmentation Performance ====================

  describe('MatchPoolService Segmentation Performance', () => {
    const mockFormat = {
      id: 1,
      teamSize: 3,
      teamCountMin: 2,
      teamCountMax: 4,
      playersPerTeam: 3,
    } as any;

    const poolingParams: PoolingParams = {
      maxAbilitySpread: 12,
      minPoolSize: 6,
      timeAlignmentMinutes: 30,
    };

    it('should segment 100 avatars in single pool within 50ms', () => {
      // All same venue/format/time 鈫?single pool
      const sources = Array.from({ length: 100 }, (_, i) => ({
        intentionId: i + 1,
        playerId: i + 1,
        totalAbilityScore: 50 + (i % 30),
        venueIds: [1],
        formatIds: [1],
        startTime: new Date('2026-06-15T14:00:00Z'),
        acceptableWaitMinutes: 60,
        durationMinutes: 120,
        submittedAt: new Date(),
      }));
      const avatars = matchPoolService.buildAvatars(sources);
      const poolResult = matchPoolService.buildPools(avatars);
      expect(poolResult.pools.length).toBe(1);
      const pool = poolResult.pools[0];

      const start = Date.now();
      const segmentResult = matchPoolService.segmentPool(pool, mockFormat, poolingParams);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      expect(segmentResult.segments.length).toBeGreaterThan(0);
    });

    it('should segment 200 avatars in single pool within 100ms', () => {
      const sources = Array.from({ length: 200 }, (_, i) => ({
        intentionId: i + 1,
        playerId: i + 1,
        totalAbilityScore: 50 + (i % 40),
        venueIds: [1],
        formatIds: [1],
        startTime: new Date('2026-06-15T14:00:00Z'),
        acceptableWaitMinutes: 60,
        durationMinutes: 120,
        submittedAt: new Date(),
      }));
      const avatars = matchPoolService.buildAvatars(sources);
      const poolResult = matchPoolService.buildPools(avatars);
      expect(poolResult.pools.length).toBe(1);
      const pool = poolResult.pools[0];

      const start = Date.now();
      const segmentResult = matchPoolService.segmentPool(pool, mockFormat, poolingParams);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(segmentResult.segments.length).toBeGreaterThan(0);
    });

    it('should segment 500 avatars in single pool within 200ms', () => {
      const sources = Array.from({ length: 500 }, (_, i) => ({
        intentionId: i + 1,
        playerId: i + 1,
        totalAbilityScore: 50 + (i % 50),
        venueIds: [1],
        formatIds: [1],
        startTime: new Date('2026-06-15T14:00:00Z'),
        acceptableWaitMinutes: 60,
        durationMinutes: 120,
        submittedAt: new Date(),
      }));
      const avatars = matchPoolService.buildAvatars(sources);
      const poolResult = matchPoolService.buildPools(avatars);
      expect(poolResult.pools.length).toBe(1);
      const pool = poolResult.pools[0];

      const start = Date.now();
      const segmentResult = matchPoolService.segmentPool(pool, mockFormat, poolingParams);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
      expect(segmentResult.segments.length).toBeGreaterThan(0);
    });
  });

  // ==================== End-to-End Pooling Pipeline ====================

  describe('End-to-End Pooling Pipeline', () => {
    const mockFormat = {
      id: 1,
      teamSize: 3,
      teamCountMin: 2,
      teamCountMax: 4,
      playersPerTeam: 3,
    } as any;

    const poolingParams: PoolingParams = {
      maxAbilitySpread: 12,
      minPoolSize: 6,
      timeAlignmentMinutes: 30,
    };

    function runPoolingPipeline(count: number, maxMs: number) {
      const sources = generateAvatarSources(count);

      const start = Date.now();

      // Step 1: Build avatars
      const avatars = matchPoolService.buildAvatars(sources);

      // Step 2: Build pools
      const poolResult = matchPoolService.buildPools(avatars);

      // Step 3: Segment each pool
      let totalSegments = 0;
      let totalAssigned = 0;
      for (const pool of poolResult.pools) {
        const segmentResult = matchPoolService.segmentPool(pool, mockFormat, poolingParams);
        totalSegments += segmentResult.segments.length;
        for (const segment of segmentResult.segments) {
          // Deduplicate avatars within segment
          const deduped = matchPoolService.deduplicateAvatars(segment.avatars);
          totalAssigned += deduped.length;
        }
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(maxMs);
      expect(totalSegments).toBeGreaterThan(0);
      expect(totalAssigned).toBeGreaterThan(0);
    }

    it('should simulate full pooling pipeline for 100 players within 200ms', () => {
      runPoolingPipeline(100, 200);
    });

    it('should simulate full pooling pipeline for 500 players within 1000ms', () => {
      runPoolingPipeline(500, 1000);
    });

    it('should simulate full pooling pipeline for 1000 players within 3000ms', () => {
      runPoolingPipeline(1000, 3000);
    });
  });

  // ==================== TeamBalancerService Performance ====================

  describe('TeamBalancerService Performance', () => {
    it('should process 100 players within 50ms', () => {
      const players = generatePlayers(100);
      const format = { teamSize: 5, teamCountMin: 2, teamCountMax: 4 };

      const start = Date.now();
      const teams = teamBalancer.snakeDraft({ players, format });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      expect(teams.length).toBeGreaterThanOrEqual(format.teamCountMin);
      expect(teams.length).toBeLessThanOrEqual(format.teamCountMax);

      // 楠岃瘉鎵€鏈夌悆鍛橀兘琚�垎閰?
      const totalAssigned = teams.reduce((sum, t) => sum + t.players.length, 0);
      expect(totalAssigned).toBe(players.length);
    });

    it('should process 500 players within 100ms', () => {
      const players = generatePlayers(500);
      const format = { teamSize: 5, teamCountMin: 2, teamCountMax: 10 };

      const start = Date.now();
      const teams = teamBalancer.snakeDraft({ players, format });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(teams.length).toBeGreaterThanOrEqual(format.teamCountMin);

      const totalAssigned = teams.reduce((sum, t) => sum + t.players.length, 0);
      expect(totalAssigned).toBe(players.length);
    });

    it('should process 1000 players within 200ms', () => {
      const players = generatePlayers(1000);
      const format = { teamSize: 5, teamCountMin: 2, teamCountMax: 20 };

      const start = Date.now();
      const teams = teamBalancer.snakeDraft({ players, format });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
      expect(teams.length).toBeGreaterThanOrEqual(format.teamCountMin);

      const totalAssigned = teams.reduce((sum, t) => sum + t.players.length, 0);
      expect(totalAssigned).toBe(players.length);
    });

    it('should maintain balanced teams with large player sets', () => {
      const players = generatePlayers(200);
      const format = { teamSize: 5, teamCountMin: 2, teamCountMax: 8 };

      const teams = teamBalancer.snakeDraft({ players, format });
      const balanceScore = teamBalancer.calculateBalanceScore(teams);

      // 鏍囧噯宸�簲灏忎簬 5锛堝潎琛℃€ц壇濂斤級
      expect(balanceScore).toBeLessThan(5);
    });
  });

  // ==================== Memory Stability ====================

  describe('Memory Stability', () => {
    it('should maintain stable memory usage across multiple pooling iterations', () => {
      const sources = generateAvatarSources(500);
      const format = { teamSize: 5, teamCountMin: 2, teamCountMax: 10 } as any;
      const poolingParams: PoolingParams = {
        maxAbilitySpread: 12,
        minPoolSize: 6,
        timeAlignmentMinutes: 30,
      };

      // 璁板綍鍒濆�鍐呭瓨
      const initialMemory = process.memoryUsage().heapUsed;

      // 鎵ц�澶氭�杩�唬锛堝惈姹犲寲 + 鍒嗘� + 鍘婚噸 + 铔囧舰鍒嗛槦锛?
      for (let i = 0; i < 5; i++) {
        const avatars = matchPoolService.buildAvatars(sources);
        const poolResult = matchPoolService.buildPools(avatars);
        for (const pool of poolResult.pools) {
          const segmentResult = matchPoolService.segmentPool(pool, format, poolingParams);
          for (const segment of segmentResult.segments) {
            const deduped = matchPoolService.deduplicateAvatars(segment.avatars);
            if (deduped.length >= format.teamCountMin * format.teamSize) {
              teamBalancer.snakeDraft({
                players: deduped.map((a) => ({
                  id: a.playerId,
                  totalAbilityScore: a.totalAbilityScore,
                })),
                format,
              });
            }
          }
        }
      }

      // 寮哄埗鍨冨溇鍥炴敹锛堝�鏋滃彲鐢�級
      if (global.gc) {
        global.gc();
      }

      // 鍐呭瓨澧為暱搴斿皬浜?50MB锛堝厑璁镐竴瀹氭尝鍔�級
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;
      expect(memoryGrowth).toBeLessThan(50);
    });
  });
});
