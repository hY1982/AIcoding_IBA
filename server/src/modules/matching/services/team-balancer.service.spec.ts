import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TeamBalancerService, TeamAssignment } from './team-balancer.service';

// ==================== Test Data Helpers ====================

interface MockPlayer {
  id: number;
  totalAbilityScore: number;
}

interface MockFormat {
  teamSize: number;
  teamCountMin: number;
  teamCountMax: number;
}

function createMockPlayer(id: number, score: number): MockPlayer {
  return { id, totalAbilityScore: score };
}

function createMockFormat(
  teamSize: number,
  teamCountMin: number,
  teamCountMax: number,
): MockFormat {
  return { teamSize, teamCountMin, teamCountMax };
}

// ==================== Test Suite ====================

describe('TeamBalancerService', () => {
  let service: TeamBalancerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TeamBalancerService],
    }).compile();

    service = module.get<TeamBalancerService>(TeamBalancerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== Basic Distribution ====================

  describe('snakeDraft', () => {
    it('should distribute 6 players into 2 teams of 3 (3v3)', () => {
      const players = [
        createMockPlayer(1, 95),
        createMockPlayer(2, 90),
        createMockPlayer(3, 85),
        createMockPlayer(4, 80),
        createMockPlayer(5, 75),
        createMockPlayer(6, 70),
      ];
      const format = createMockFormat(3, 2, 4);

      const result = service.snakeDraft({ players, format });

      expect(result).toHaveLength(2);
      expect(result[0].players).toHaveLength(3);
      expect(result[1].players).toHaveLength(3);
      expect(result[0].teamNumber).toBe(1);
      expect(result[1].teamNumber).toBe(2);
    });

    it('should distribute 10 players into 2 teams of 5 (5v5)', () => {
      const players = Array.from({ length: 10 }, (_, i) =>
        createMockPlayer(i + 1, 100 - i * 5),
      );
      const format = createMockFormat(5, 2, 4);

      const result = service.snakeDraft({ players, format });

      expect(result).toHaveLength(2);
      expect(result[0].players).toHaveLength(5);
      expect(result[1].players).toHaveLength(5);
    });

    it('should sort players by totalAbilityScore descending before distribution', () => {
      const players = [
        createMockPlayer(1, 50),
        createMockPlayer(2, 90),
        createMockPlayer(3, 70),
        createMockPlayer(4, 80),
      ];
      const format = createMockFormat(2, 2, 2);

      const result = service.snakeDraft({ players, format });

      // After sorting: 90, 80, 70, 50
      // Team 1 gets: 90 (round 1), 50 (round 2 reverse)
      // Team 2 gets: 80 (round 1), 70 (round 2 reverse)
      expect(result[0].players[0].totalAbilityScore).toBe(90);
      expect(result[0].players[1].totalAbilityScore).toBe(50);
      expect(result[1].players[0].totalAbilityScore).toBe(80);
      expect(result[1].players[1].totalAbilityScore).toBe(70);
    });

    it('should use deterministic tie-breaking by id when scores are equal', () => {
      const players = [
        createMockPlayer(3, 80),
        createMockPlayer(1, 80),
        createMockPlayer(2, 80),
        createMockPlayer(4, 70),
      ];
      const format = createMockFormat(2, 2, 2);

      const result = service.snakeDraft({ players, format });

      // After sorting by score desc, then id asc: id=1(80), id=2(80), id=3(80), id=4(70)
      expect(result[0].players[0].id).toBe(1);
      expect(result[0].players[1].id).toBe(4);
      expect(result[1].players[0].id).toBe(2);
      expect(result[1].players[1].id).toBe(3);
    });

    // ==================== Snake Draft Pattern Verification ====================

    it('should follow snake draft pattern: forward then reverse rounds', () => {
      // 9 players, 3 teams of 3
      // Sorted: 90, 85, 80, 75, 70, 65, 60, 55, 50
      // Round 1 (forward): T1=90, T2=85, T3=80
      // Round 2 (reverse): T3=75, T2=70, T1=65
      // Round 3 (forward): T1=60, T2=55, T3=50
      const players = Array.from({ length: 9 }, (_, i) =>
        createMockPlayer(i + 1, 90 - i * 5),
      );
      const format = createMockFormat(3, 3, 3);

      const result = service.snakeDraft({ players, format });

      expect(result).toHaveLength(3);
      // Team 1: 90, 65, 60
      expect(result[0].players.map((p) => p.totalAbilityScore)).toEqual([
        90, 65, 60,
      ]);
      // Team 2: 85, 70, 55
      expect(result[1].players.map((p) => p.totalAbilityScore)).toEqual([
        85, 70, 55,
      ]);
      // Team 3: 80, 75, 50
      expect(result[2].players.map((p) => p.totalAbilityScore)).toEqual([
        80, 75, 50,
      ]);
    });

    // ==================== Team Count Calculation ====================

    it('should use teamCountMax when player count allows more teams', () => {
      // 16 players, format: teamSize=4, teamCountMin=2, teamCountMax=4
      // maxPossibleTeams = floor(16/4) = 4
      // teamCount = min(max(4, 2), 4) = 4
      const players = Array.from({ length: 16 }, (_, i) =>
        createMockPlayer(i + 1, 100 - i * 3),
      );
      const format = createMockFormat(4, 2, 4);

      const result = service.snakeDraft({ players, format });

      expect(result).toHaveLength(4);
      result.forEach((team) => expect(team.players).toHaveLength(4));
    });

    it('should use teamCountMin when player count is limited', () => {
      // 6 players, format: teamSize=3, teamCountMin=2, teamCountMax=4
      // maxPossibleTeams = floor(6/3) = 2
      // teamCount = min(max(2, 2), 4) = 2
      const players = Array.from({ length: 6 }, (_, i) =>
        createMockPlayer(i + 1, 100 - i * 5),
      );
      const format = createMockFormat(3, 2, 4);

      const result = service.snakeDraft({ players, format });

      expect(result).toHaveLength(2);
    });

    // ==================== Balance Quality ====================

    it('should produce balanced teams with low standard deviation', () => {
      const players = Array.from({ length: 12 }, (_, i) =>
        createMockPlayer(i + 1, 90 - i * 3),
      );
      const format = createMockFormat(3, 3, 4);

      const result = service.snakeDraft({ players, format });
      const balanceScore = service.calculateBalanceScore(result);

      // With snake draft, balance score should be very low (< 2)
      expect(balanceScore).toBeLessThan(2);
    });

    it('should produce balanced teams for 5v5 with 10 players', () => {
      const players = [
        createMockPlayer(1, 95),
        createMockPlayer(2, 92),
        createMockPlayer(3, 88),
        createMockPlayer(4, 85),
        createMockPlayer(5, 82),
        createMockPlayer(6, 78),
        createMockPlayer(7, 75),
        createMockPlayer(8, 72),
        createMockPlayer(9, 68),
        createMockPlayer(10, 65),
      ];
      const format = createMockFormat(5, 2, 2);

      const result = service.snakeDraft({ players, format });
      const balanceScore = service.calculateBalanceScore(result);

      // Team 1: 95, 82, 78, 65 = avg 80
      // Team 2: 92, 88, 85, 75, 72 = avg 82.4
      // Wait, let me recalculate for 5v5 (10 players, 2 teams)
      // Round 1: T1=95, T2=92
      // Round 2(reverse): T2=88, T1=85
      // Round 3: T1=82, T2=78
      // Round 4(reverse): T2=75, T1=72
      // Round 5: T1=68, T2=65
      // Team 1: 95, 85, 82, 72, 68 = avg 80.4
      // Team 2: 92, 88, 78, 75, 65 = avg 79.6
      expect(result).toHaveLength(2);
      expect(result[0].players).toHaveLength(5);
      expect(result[1].players).toHaveLength(5);
      expect(balanceScore).toBeLessThan(2);
    });

    // ==================== Edge Cases ====================

    it('should throw BadRequestException when player count is insufficient', () => {
      const players = [createMockPlayer(1, 80), createMockPlayer(2, 70)];
      const format = createMockFormat(5, 2, 4); // needs at least 10 players

      expect(() => service.snakeDraft({ players, format })).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when player count is zero', () => {
      const players: MockPlayer[] = [];
      const format = createMockFormat(3, 2, 4);

      expect(() => service.snakeDraft({ players, format })).toThrow(
        BadRequestException,
      );
    });

    it('should handle odd player count by distributing remainder in snake pattern', () => {
      // 7 players, 2 teams (max possible = floor(7/3) = 2)
      // Sorted: 90, 85, 80, 75, 70, 65, 60
      // Round 1: T1=90, T2=85
      // Round 2(reverse): T2=80, T1=75
      // Round 3: T1=70, T2=65
      // Round 4(reverse): T2=60 (only 1 player, T2 gets it)
      const players = Array.from({ length: 7 }, (_, i) =>
        createMockPlayer(i + 1, 90 - i * 5),
      );
      const format = createMockFormat(3, 2, 4);

      const result = service.snakeDraft({ players, format });

      expect(result).toHaveLength(2);
      // Team sizes may differ by at most 1
      const sizeDiff = Math.abs(
        result[0].players.length - result[1].players.length,
      );
      expect(sizeDiff).toBeLessThanOrEqual(1);
    });

    it('should calculate avgAbility correctly for each team', () => {
      const players = [
        createMockPlayer(1, 90),
        createMockPlayer(2, 80),
        createMockPlayer(3, 70),
        createMockPlayer(4, 60),
      ];
      const format = createMockFormat(2, 2, 2);

      const result = service.snakeDraft({ players, format });

      // After snake draft:
      // Team 1: 90, 60 -> avg = 75
      // Team 2: 80, 70 -> avg = 75
      expect(result[0].avgAbility).toBe(75);
      expect(result[1].avgAbility).toBe(75);
    });

    it('should set teamName for each team', () => {
      const players = Array.from({ length: 6 }, (_, i) =>
        createMockPlayer(i + 1, 90 - i * 5),
      );
      const format = createMockFormat(3, 2, 2);

      const result = service.snakeDraft({ players, format });

      expect(result[0].teamName).toBe('队伍1');
      expect(result[1].teamName).toBe('队伍2');
    });
  });

  // ==================== calculateBalanceScore ====================

  describe('calculateBalanceScore', () => {
    it('should return 0 for perfectly balanced teams', () => {
      const teams: TeamAssignment[] = [
        { teamNumber: 1, players: [], avgAbility: 75 },
        { teamNumber: 2, players: [], avgAbility: 75 },
      ];

      const score = service.calculateBalanceScore(teams);

      expect(score).toBe(0);
    });

    it('should return higher value for unbalanced teams', () => {
      const balanced: TeamAssignment[] = [
        { teamNumber: 1, players: [], avgAbility: 75 },
        { teamNumber: 2, players: [], avgAbility: 75 },
      ];
      const unbalanced: TeamAssignment[] = [
        { teamNumber: 1, players: [], avgAbility: 90 },
        { teamNumber: 2, players: [], avgAbility: 60 },
      ];

      const balancedScore = service.calculateBalanceScore(balanced);
      const unbalancedScore = service.calculateBalanceScore(unbalanced);

      expect(unbalancedScore).toBeGreaterThan(balancedScore);
    });

    it('should calculate correct standard deviation', () => {
      const teams: TeamAssignment[] = [
        { teamNumber: 1, players: [], avgAbility: 80 },
        { teamNumber: 2, players: [], avgAbility: 70 },
      ];

      const score = service.calculateBalanceScore(teams);

      // mean = 75, variance = ((80-75)^2 + (70-75)^2) / 2 = 25
      // std dev = 5
      expect(score).toBe(5);
    });
  });
});
