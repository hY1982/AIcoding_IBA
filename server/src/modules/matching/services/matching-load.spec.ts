import { TeamBalancerService, TeamAssignment } from './team-balancer.service';

/**
 * 纯内存负载测试
 *
 * 直接测试核心算法的执行效率，不依赖数据库或外部服务。
 * 验证在大量球员数据下，蛇形选秀、双指针聚类、兼容性矩阵构建
 * 和贪心团聚类算法的性能表现。
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

  // ==================== Compatibility Algorithm Copies (Pure Memory) ====================

  interface LoadTestPlayerInfo {
    id: number;
    totalAbilityScore: number;
    submittedAt: number; // ms timestamp
    startTime: number;   // ms timestamp
    acceptableWaitMinutes: number;
    venueIds: number[];
    formatIds: number[];
    venuePriorities: Map<number, number>;
    formatPriorities: Map<number, number>;
  }

  interface LoadTestCompatResult {
    compatible: boolean;
    totalScore: number;
  }

  const WEIGHTS = { time: 0.30, venue: 0.20, format: 0.20, duration: 0.10, ability: 0.20 };

  function computeMatchScoreLite(a: LoadTestPlayerInfo, b: LoadTestPlayerInfo): LoadTestCompatResult {
    const zero: LoadTestCompatResult = { compatible: false, totalScore: 0 };
    const aWaitEnd = a.startTime + a.acceptableWaitMinutes * 60000;
    const bWaitEnd = b.startTime + b.acceptableWaitMinutes * 60000;
    const overlapStart = Math.max(a.startTime, b.startTime);
    const overlapEnd = Math.min(aWaitEnd, bWaitEnd);
    if (overlapStart > overlapEnd) return zero;
    const overlapMin = (overlapEnd - overlapStart) / 60000;
    const maxOverlap = Math.min(a.acceptableWaitMinutes, b.acceptableWaitMinutes);
    const timeScore = maxOverlap > 0 ? overlapMin / maxOverlap : 0;

    const commonVenues = a.venueIds.filter((v) => b.venueIds.includes(v));
    if (commonVenues.length === 0) return zero;
    let bestVP = Infinity;
    for (const v of commonVenues) {
      const pMax = Math.max(a.venuePriorities.get(v) ?? 1, b.venuePriorities.get(v) ?? 1);
      if (pMax < bestVP) bestVP = pMax;
    }
    const venueScore = 1.0 / bestVP;

    const commonFormats = a.formatIds.filter((f) => b.formatIds.includes(f));
    if (commonFormats.length === 0) return zero;
    let bestFP = Infinity;
    for (const f of commonFormats) {
      const pMax = Math.max(a.formatPriorities.get(f) ?? 1, b.formatPriorities.get(f) ?? 1);
      if (pMax < bestFP) bestFP = pMax;
    }
    const formatScore = 1.0 / bestFP;

    const abilityDiff = Math.abs(a.totalAbilityScore - b.totalAbilityScore);
    const abilityScore = Math.max(0, 1.0 - abilityDiff / 50);

    const totalScore =
      WEIGHTS.time * timeScore +
      WEIGHTS.venue * venueScore +
      WEIGHTS.format * formatScore +
      WEIGHTS.duration * 1.0 + // 简化：负载测试中所有人 duration 相同
      WEIGHTS.ability * abilityScore;

    return { compatible: true, totalScore };
  }

  function buildCompatibilityMatrixLite(
    infos: LoadTestPlayerInfo[],
  ): LoadTestCompatResult[][] {
    const n = infos.length;
    const incompat: LoadTestCompatResult = { compatible: false, totalScore: 0 };
    const matrix: LoadTestCompatResult[][] = Array.from(
      { length: n }, () => Array.from({ length: n }, () => ({ ...incompat })),
    );
    for (let i = 0; i < n; i++) {
      matrix[i][i] = { compatible: true, totalScore: 1 };
      for (let j = i + 1; j < n; j++) {
        const timeDiff = Math.abs(infos[i].startTime - infos[j].startTime);
        if (timeDiff > 6 * 60 * 60 * 1000) continue;
        const score = computeMatchScoreLite(infos[i], infos[j]);
        matrix[i][j] = score;
        matrix[j][i] = score;
      }
    }
    return matrix;
  }

  function buildCompatibleClustersLite(
    infos: LoadTestPlayerInfo[],
    matrix: LoadTestCompatResult[][],
  ): LoadTestPlayerInfo[][] {
    const n = infos.length;
    const sortedIndices = Array.from({ length: n }, (_, i) => i);
    sortedIndices.sort((a, b) => infos[a].submittedAt - infos[b].submittedAt);
    const matched = new Set<number>();
    const clusters: LoadTestPlayerInfo[][] = [];

    for (const seedIdx of sortedIndices) {
      if (matched.has(seedIdx)) continue;
      const groupIndices: number[] = [seedIdx];
      matched.add(seedIdx);
      const candidates: Array<{ idx: number; score: number }> = [];
      for (const j of sortedIndices) {
        if (matched.has(j) || j === seedIdx) continue;
        const score = matrix[seedIdx][j].totalScore;
        if (score > 0) candidates.push({ idx: j, score });
      }
      candidates.sort((a, b) => b.score - a.score);
      for (const { idx: cIdx } of candidates) {
        if (matched.has(cIdx)) continue;
        const compatAll = groupIndices.every(
          (mIdx) => matrix[cIdx][mIdx].totalScore > 0,
        );
        if (compatAll) {
          groupIndices.push(cIdx);
          matched.add(cIdx);
        }
      }
      clusters.push(groupIndices.map((i) => infos[i]));
    }
    return clusters;
  }

  /**
   * 生成模拟意向数据（含场地/赛制偏好）
   */
  function generatePlayerInfos(count: number): LoadTestPlayerInfo[] {
    const players = generatePlayers(count);
    const baseTime = new Date('2026-06-15T14:00:00Z').getTime();
    const now = Date.now();
    let seed = 123;
    const random = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    return players.map((p, i) => ({
      id: p.id,
      totalAbilityScore: p.totalAbilityScore,
      submittedAt: now - i * 60000,
      startTime: baseTime + Math.floor(random() * 4) * 30 * 60000, // 14:00~15:30
      acceptableWaitMinutes: 30 + Math.floor(random() * 31), // 30~60 min
      venueIds: [(i % 3) + 1],
      formatIds: [1],
      venuePriorities: new Map([[(i % 3) + 1, 1]]),
      formatPriorities: new Map([[1, 1]]),
    }));
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
    function runFullPipeline(count: number, maxMs: number) {
      const infos = generatePlayerInfos(count);
      const format = { teamSize: 3, teamCountMin: 2, teamCountMax: Math.ceil(count / 6) };

      const start = Date.now();

      // Step 1: 兼容性矩阵 + 贪心团聚类
      const matrix = buildCompatibilityMatrixLite(infos);
      const clusters = buildCompatibleClustersLite(infos, matrix);

      // Step 2: 对每个簇执行双指针聚类 + 蛇形分队
      let totalAssigned = 0;
      for (const cluster of clusters) {
        const threshold = calculateDynamicThreshold(cluster.length, 30.0, 5.0, 0.3);
        const candidateSet = findBestCandidateSet(
          cluster.map((p) => ({ id: p.id, totalAbilityScore: p.totalAbilityScore })),
          threshold,
        );
        const minPlayers = format.teamCountMin * format.teamSize;
        if (candidateSet.length >= minPlayers) {
          const teams = teamBalancer.snakeDraft({ players: candidateSet, format });
          totalAssigned += teams.reduce((sum, t) => sum + t.players.length, 0);
        }
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(maxMs);
      expect(totalAssigned).toBeGreaterThan(0);
    }

    it('should simulate full matching pipeline for 100 players within 500ms', () => {
      runFullPipeline(100, 500);
    });

    it('should simulate full matching pipeline for 500 players within 2000ms', () => {
      runFullPipeline(500, 2000);
    });

    it('should simulate full matching pipeline for 1000 players within 5000ms', () => {
      runFullPipeline(1000, 5000);
    });
  });

  describe('Compatibility Clustering Performance', () => {
    it('should build compatibility matrix for 500 intentions within 1000ms', () => {
      const infos = generatePlayerInfos(500);
      const start = Date.now();
      const matrix = buildCompatibilityMatrixLite(infos);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
      expect(matrix.length).toBe(500);
      expect(matrix[0].length).toBe(500);
    });

    it('should build compatibility matrix for 1000 intentions within 3000ms', () => {
      const infos = generatePlayerInfos(1000);
      const start = Date.now();
      const matrix = buildCompatibilityMatrixLite(infos);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(3000);
      expect(matrix.length).toBe(1000);
    });

    it('should cluster 500 intentions (matrix + clustering) within 2000ms', () => {
      const infos = generatePlayerInfos(500);
      const start = Date.now();
      const matrix = buildCompatibilityMatrixLite(infos);
      const clusters = buildCompatibleClustersLite(infos, matrix);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(2000);
      expect(clusters.length).toBeGreaterThan(0);
      // 所有意向都应被分配到某个簇
      const totalInClusters = clusters.reduce((sum, c) => sum + c.length, 0);
      expect(totalInClusters).toBe(500);
    });

    it('should cluster 1000 intentions (matrix + clustering) within 5000ms', () => {
      const infos = generatePlayerInfos(1000);
      const start = Date.now();
      const matrix = buildCompatibilityMatrixLite(infos);
      const clusters = buildCompatibleClustersLite(infos, matrix);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);
      const totalInClusters = clusters.reduce((sum, c) => sum + c.length, 0);
      expect(totalInClusters).toBe(1000);
    });
  });

  describe('Memory Stability', () => {
    it('should maintain stable memory usage across multiple iterations', () => {
      const infos = generatePlayerInfos(500);
      const format = { teamSize: 5, teamCountMin: 2, teamCountMax: 10 };

      // 记录初始内存
      const initialMemory = process.memoryUsage().heapUsed;

      // 执行多次迭代（含兼容性矩阵 + 聚类 + 双指针 + 蛇形分队）
      for (let i = 0; i < 5; i++) {
        const matrix = buildCompatibilityMatrixLite(infos);
        const clusters = buildCompatibleClustersLite(infos, matrix);
        for (const cluster of clusters) {
          const threshold = calculateDynamicThreshold(cluster.length);
          const candidateSet = findBestCandidateSet(
            cluster.map((p) => ({ id: p.id, totalAbilityScore: p.totalAbilityScore })),
            threshold,
          );
          if (candidateSet.length >= format.teamCountMin * format.teamSize) {
            teamBalancer.snakeDraft({ players: candidateSet, format });
          }
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
