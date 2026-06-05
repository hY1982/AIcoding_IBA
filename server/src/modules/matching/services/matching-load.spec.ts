import { TeamBalancerService, TeamAssignment } from './team-balancer.service';

/**
 * 纯内存负载测试
 *
 * 直接测试核心算法的执行效率，不依赖数据库或外部服务。
 * 验证在大量球员数据下，蛇形选秀和双指针聚类算法的性能表现。
 */
describe('Matching Load Tests', () => {
  let teamBalancer: TeamBalancerService;

  beforeEach(() => {
    teamBalancer = new TeamBalancerService();
  });

  /**
   * 生成指定数量的模拟球员数据
   */
  function generatePlayers(
    count: number,
  ): Array<{ id: number; totalAbilityScore: number }> {
    const players: Array<{ id: number; totalAbilityScore: number }> = [];
    // 使用伪随机但确定性的种子，保证测试可重复
    let seed = 42;
    const random = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < count; i++) {
      // 能力值范围 30-90，正态分布近似
      const score = 30 + Math.floor(random() * 60);
      players.push({ id: i + 1, totalAbilityScore: score });
    }
    return players;
  }

  /**
   * 双指针滑动窗口聚类算法（纯内存实现，用于性能测试）
   *
   * 优化版：利用已排序特性，窗口内 max = sorted[left], min = sorted[right]
   * 时间复杂度：O(n log n) 排序 + O(n) 滑动窗口
   */
  function findBestCandidateSet(
    players: Array<{ id: number; totalAbilityScore: number }>,
    threshold: number,
  ): Array<{ id: number; totalAbilityScore: number }> {
    const sorted = [...players].sort(
      (a, b) => b.totalAbilityScore - a.totalAbilityScore,
    );

    let bestStart = 0;
    let bestEnd = 0;
    let left = 0;

    for (let right = 0; right < sorted.length; right++) {
      // 利用已排序特性：窗口内 max = sorted[left], min = sorted[right]
      while (
        left < right &&
        sorted[left].totalAbilityScore - sorted[right].totalAbilityScore >
          threshold
      ) {
        left++;
      }

      if (right - left > bestEnd - bestStart) {
        bestStart = left;
        bestEnd = right;
      }
    }

    return sorted.slice(bestStart, bestEnd + 1);
  }

  /**
   * 计算动态阈值
   */
  function calculateDynamicThreshold(
    intentionCount: number,
    baseThreshold = 20.0,
    minThreshold = 5.0,
    factor = 0.5,
  ): number {
    const dynamicValue = baseThreshold - intentionCount * factor;
    return Math.max(minThreshold, dynamicValue);
  }

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

      // 验证所有球员都被分配
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

      // 标准差应小于 5（均衡性良好）
      expect(balanceScore).toBeLessThan(5);
    });
  });

  describe('Two-Pointer Clustering Performance', () => {
    it('should cluster 100 intentions within 50ms', () => {
      const players = generatePlayers(100);
      const threshold = calculateDynamicThreshold(players.length);

      const start = Date.now();
      const candidateSet = findBestCandidateSet(players, threshold);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      expect(candidateSet.length).toBeGreaterThan(0);
    });

    it('should cluster 500 intentions within 100ms', () => {
      const players = generatePlayers(500);
      const threshold = calculateDynamicThreshold(players.length);

      const start = Date.now();
      const candidateSet = findBestCandidateSet(players, threshold);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(candidateSet.length).toBeGreaterThan(0);
    });

    it('should cluster 1000 intentions within 200ms', () => {
      const players = generatePlayers(1000);
      const threshold = calculateDynamicThreshold(players.length);

      const start = Date.now();
      const candidateSet = findBestCandidateSet(players, threshold);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
      expect(candidateSet.length).toBeGreaterThan(0);
    });

    it('should find meaningful candidate sets with various thresholds', () => {
      const players = generatePlayers(200);

      // 宽松阈值应返回更多球员
      const looseSet = findBestCandidateSet(players, 50);
      const tightSet = findBestCandidateSet(players, 5);

      expect(looseSet.length).toBeGreaterThanOrEqual(tightSet.length);
    });
  });

  describe('End-to-End Matching Simulation', () => {
    it('should simulate full matching pipeline for 100 players within 200ms', () => {
      const players = generatePlayers(100);
      const format = { teamSize: 5, teamCountMin: 2, teamCountMax: 4 };

      const start = Date.now();

      // Step 1: 双指针聚类
      const threshold = calculateDynamicThreshold(players.length);
      const candidateSet = findBestCandidateSet(players, threshold);

      // Step 2: 检查是否满足最低人数
      const minPlayers = format.teamCountMin * format.teamSize;
      if (candidateSet.length >= minPlayers) {
        // Step 3: 蛇形分队
        const teams = teamBalancer.snakeDraft({
          players: candidateSet,
          format,
        });

        // 验证结果
        expect(teams.length).toBeGreaterThanOrEqual(format.teamCountMin);
        const totalAssigned = teams.reduce(
          (sum, t) => sum + t.players.length,
          0,
        );
        expect(totalAssigned).toBe(candidateSet.length);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });

    it('should simulate full matching pipeline for 500 players within 500ms', () => {
      const players = generatePlayers(500);
      const format = { teamSize: 5, teamCountMin: 2, teamCountMax: 10 };

      const start = Date.now();

      const threshold = calculateDynamicThreshold(players.length);
      const candidateSet = findBestCandidateSet(players, threshold);
      const minPlayers = format.teamCountMin * format.teamSize;

      if (candidateSet.length >= minPlayers) {
        const teams = teamBalancer.snakeDraft({
          players: candidateSet,
          format,
        });
        expect(teams.length).toBeGreaterThanOrEqual(format.teamCountMin);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);
    });

    it('should simulate full matching pipeline for 1000 players within 1000ms', () => {
      const players = generatePlayers(1000);
      const format = { teamSize: 5, teamCountMin: 2, teamCountMax: 20 };

      const start = Date.now();

      const threshold = calculateDynamicThreshold(players.length);
      const candidateSet = findBestCandidateSet(players, threshold);
      const minPlayers = format.teamCountMin * format.teamSize;

      if (candidateSet.length >= minPlayers) {
        const teams = teamBalancer.snakeDraft({
          players: candidateSet,
          format,
        });
        expect(teams.length).toBeGreaterThanOrEqual(format.teamCountMin);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Memory Stability', () => {
    it('should maintain stable memory usage across multiple iterations', () => {
      const players = generatePlayers(500);
      const format = { teamSize: 5, teamCountMin: 2, teamCountMax: 10 };

      // 记录初始内存
      const initialMemory = process.memoryUsage().heapUsed;

      // 执行多次迭代
      for (let i = 0; i < 10; i++) {
        const threshold = calculateDynamicThreshold(players.length);
        const candidateSet = findBestCandidateSet(players, threshold);
        if (candidateSet.length >= format.teamCountMin * format.teamSize) {
          teamBalancer.snakeDraft({ players: candidateSet, format });
        }
      }

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      // 内存增长应小于 50MB（允许一定波动）
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;
      expect(memoryGrowth).toBeLessThan(50);
    });
  });
});
