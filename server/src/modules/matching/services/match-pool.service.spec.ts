import { Test, TestingModule } from '@nestjs/testing';
import { MatchPoolService } from './match-pool.service';
import { IntentionAvatar } from '../interfaces/intention-avatar.interface';
import { PoolingParams } from '../interfaces/match-pool.interface';

describe('MatchPoolService', () => {
  let service: MatchPoolService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MatchPoolService],
    }).compile();

    service = module.get<MatchPoolService>(MatchPoolService);
  });

  describe('buildAvatars', () => {
    it('should create avatars for all venue×format combinations', () => {
      const sources = [
        {
          intentionId: 1,
          playerId: 101,
          totalAbilityScore: 70,
          startTime: new Date('2026-06-30T14:00:00Z'),
          acceptableWaitMinutes: 30,
          durationMinutes: 120,
          submittedAt: new Date('2026-06-30T10:00:00Z'),
          venueIds: [1, 2],
          formatIds: [10, 20],
        },
      ];

      const avatars = service.buildAvatars(sources);

      expect(avatars).toHaveLength(4);
      expect(avatars.map((a) => a.id)).toEqual([
        '1_1_10',
        '1_1_20',
        '1_2_10',
        '1_2_20',
      ]);
    });

    it('should calculate timeWindowEnd correctly', () => {
      const sources = [
        {
          intentionId: 1,
          playerId: 101,
          totalAbilityScore: 70,
          startTime: new Date('2026-06-30T14:00:00Z'),
          acceptableWaitMinutes: 30,
          durationMinutes: 120,
          submittedAt: new Date('2026-06-30T10:00:00Z'),
          venueIds: [1],
          formatIds: [10],
        },
      ];

      const avatars = service.buildAvatars(sources);

      expect(avatars[0].timeWindowEnd).toEqual(
        new Date('2026-06-30T14:30:00Z'),
      );
    });
  });

  describe('buildPools', () => {
    it('should merge overlapping time windows into single pool', () => {
      const avatars: IntentionAvatar[] = [
        createAvatar(1, 1, 10, 70, '14:00', 30),
        createAvatar(2, 1, 10, 65, '14:10', 30),
        createAvatar(3, 1, 10, 80, '14:20', 30),
      ];

      const result = service.buildPools(avatars);

      expect(result.pools).toHaveLength(1);
      expect(result.pools[0].avatars).toHaveLength(3);
    });

    it('should split non-overlapping time windows into separate pools', () => {
      const avatars: IntentionAvatar[] = [
        createAvatar(1, 1, 10, 70, '14:00', 30),
        createAvatar(2, 1, 10, 65, '14:10', 30),
        // 时间窗口: 14:00-14:30, 14:10-14:40 → 重叠
        // 下一个是 15:00-15:30，不重叠
        createAvatar(3, 1, 10, 80, '15:00', 30),
      ];

      const result = service.buildPools(avatars);

      expect(result.pools).toHaveLength(2);
      expect(result.pools[0].avatars).toHaveLength(2);
      expect(result.pools[1].avatars).toHaveLength(1);
    });

    it('should group by different venue+format separately', () => {
      const avatars: IntentionAvatar[] = [
        createAvatar(1, 1, 10, 70, '14:00', 30),
        createAvatar(2, 2, 10, 65, '14:00', 30),
        createAvatar(3, 1, 20, 80, '14:00', 30),
      ];

      const result = service.buildPools(avatars);

      expect(result.pools).toHaveLength(3);
    });

    it('should update poolEndTime to min of all deadlines', () => {
      const avatars: IntentionAvatar[] = [
        createAvatar(1, 1, 10, 70, '14:00', 60), // 截止: 15:00
        createAvatar(2, 1, 10, 65, '14:30', 30), // 截止: 15:00
        createAvatar(3, 1, 10, 80, '14:45', 10), // 截止: 14:55
      ];

      const result = service.buildPools(avatars);

      expect(result.pools).toHaveLength(1);
      // poolEndTime = min(15:00, 15:00, 14:55) = 14:55
      expect(result.pools[0].poolEndTime).toEqual(
        new Date('2026-06-30T14:55:00Z'),
      );
    });
  });

  describe('segmentPool', () => {
    const defaultFormat = {
      id: 10,
      teamCountMin: 2,
      teamCountMax: 3,
      teamSize: 3,
      durationHours: 2,
    };

    const defaultParams: PoolingParams = {
      maxAbilitySpread: 12,
      minPoolSize: 6,
      timeAlignmentMinutes: 30,
    };

    it('should create single segment when spread <= maxSpread', () => {
      const pool = createPool([
        createAvatar(1, 1, 10, 50, '14:00', 30),
        createAvatar(2, 1, 10, 55, '14:00', 30),
        createAvatar(3, 1, 10, 58, '14:00', 30),
        createAvatar(4, 1, 10, 60, '14:00', 30),
        createAvatar(5, 1, 10, 62, '14:00', 30),
        createAvatar(6, 1, 10, 58, '14:00', 30),
      ]);

      const result = service.segmentPool(pool, defaultFormat, defaultParams);

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].avatars).toHaveLength(6);
    });

    it('should create multiple segments when spread > maxSpread', () => {
      // spread = 80 - 50 = 30, maxSpread = 12
      // segmentCount = ceil(30/12) = 3
      // 9个分身，3段，每段约3个，但 minPlayers=6，所以每段都不够
      // 需要更多分身让每段 >= 6
      const pool = createPool([
        // 低能力段 (50-58)
        createAvatar(1, 1, 10, 50, '14:00', 30),
        createAvatar(2, 1, 10, 52, '14:00', 30),
        createAvatar(3, 1, 10, 54, '14:00', 30),
        createAvatar(4, 1, 10, 55, '14:00', 30),
        createAvatar(5, 1, 10, 56, '14:00', 30),
        createAvatar(6, 1, 10, 58, '14:00', 30),
        // 中能力段 (60-68)
        createAvatar(7, 1, 10, 60, '14:00', 30),
        createAvatar(8, 1, 10, 62, '14:00', 30),
        createAvatar(9, 1, 10, 64, '14:00', 30),
        createAvatar(10, 1, 10, 65, '14:00', 30),
        createAvatar(11, 1, 10, 66, '14:00', 30),
        createAvatar(12, 1, 10, 68, '14:00', 30),
        // 高能力段 (70-80)
        createAvatar(13, 1, 10, 70, '14:00', 30),
        createAvatar(14, 1, 10, 72, '14:00', 30),
        createAvatar(15, 1, 10, 74, '14:00', 30),
        createAvatar(16, 1, 10, 75, '14:00', 30),
        createAvatar(17, 1, 10, 78, '14:00', 30),
        createAvatar(18, 1, 10, 80, '14:00', 30),
      ]);

      const result = service.segmentPool(pool, defaultFormat, defaultParams);

      // 18个分身，3段，每段6个
      expect(result.segments.length).toBeGreaterThan(1);
    });

    it('should discard segment with insufficient players', () => {
      // 只有4个分身，minPlayers=6
      const pool = createPool([
        createAvatar(1, 1, 10, 50, '14:00', 30),
        createAvatar(2, 1, 10, 55, '14:00', 30),
        createAvatar(3, 1, 10, 60, '14:00', 30),
        createAvatar(4, 1, 10, 65, '14:00', 30),
      ]);

      const result = service.segmentPool(pool, defaultFormat, defaultParams);

      expect(result.segments).toHaveLength(0);
      expect(result.discardedAvatars).toBe(4);
    });

    it('should calculate matchStartTime as earliest deadline aligned to granularity', () => {
      const pool = createPool([
        createAvatar(1, 1, 10, 50, '14:00', 30), // 截止: 14:30
        createAvatar(2, 1, 10, 55, '14:00', 30), // 截止: 14:30
        createAvatar(3, 1, 10, 60, '14:00', 30), // 截止: 14:30
        createAvatar(4, 1, 10, 65, '14:00', 30), // 截止: 14:30
        createAvatar(5, 1, 10, 70, '14:00', 30), // 截止: 14:30
        createAvatar(6, 1, 10, 58, '14:00', 30), // 截止: 14:30
      ]);

      const result = service.segmentPool(pool, defaultFormat, defaultParams);

      expect(result.segments).toHaveLength(1);
      // 最早截止时间点 = 14:30，对齐到30分钟 = 14:30
      expect(result.segments[0].matchStartTime).toEqual(
        new Date('2026-06-30T14:30:00Z'),
      );
    });

    it('should calculate duration as average with 120min floor', () => {
      const pool = createPool([
        createAvatar(1, 1, 10, 50, '14:00', 30, 90),
        createAvatar(2, 1, 10, 55, '14:00', 30, 90),
        createAvatar(3, 1, 10, 60, '14:00', 30, 90),
        createAvatar(4, 1, 10, 65, '14:00', 30, 90),
        createAvatar(5, 1, 10, 70, '14:00', 30, 90),
        createAvatar(6, 1, 10, 58, '14:00', 30, 90),
      ]);

      const result = service.segmentPool(pool, defaultFormat, defaultParams);

      expect(result.segments).toHaveLength(1);
      // avg = 90, but floor is 120
      expect(result.segments[0].matchEndTime.getTime() -
        result.segments[0].matchStartTime.getTime()).toBe(120 * 60000);
    });

    it('should set confirmDeadline to 1 hour before matchStartTime', () => {
      const pool = createPool([
        createAvatar(1, 1, 10, 50, '14:00', 30),
        createAvatar(2, 1, 10, 55, '14:00', 30),
        createAvatar(3, 1, 10, 60, '14:00', 30),
        createAvatar(4, 1, 10, 65, '14:00', 30),
        createAvatar(5, 1, 10, 70, '14:00', 30),
        createAvatar(6, 1, 10, 58, '14:00', 30),
      ]);

      const result = service.segmentPool(pool, defaultFormat, defaultParams);

      expect(result.segments.length).toBeGreaterThan(0);
      const matchStart = result.segments[0].matchStartTime.getTime();
      const confirmDeadline = result.segments[0].confirmDeadline.getTime();
      expect(matchStart - confirmDeadline).toBe(60 * 60 * 1000);
    });
  });

  describe('deduplicateAvatars', () => {
    it('should keep highest ability score for same intention', () => {
      const avatars: IntentionAvatar[] = [
        { ...createAvatar(1, 1, 10, 70, '14:00', 30), intentionId: 1 },
        { ...createAvatar(2, 1, 10, 75, '14:00', 30), intentionId: 1 },
        { ...createAvatar(3, 2, 10, 60, '14:00', 30), intentionId: 2 },
      ];

      const result = service.deduplicateAvatars(avatars);

      expect(result).toHaveLength(2);
      expect(result.find((a) => a.intentionId === 1)!.totalAbilityScore).toBe(
        75,
      );
    });
  });

  describe('alignTimeToGranularity', () => {
    it('should align to 30 minutes', () => {
      const date = new Date('2026-06-30T14:25:00Z');
      const aligned = service.alignTimeToGranularity(date, 30);
      expect(aligned).toEqual(new Date('2026-06-30T14:00:00Z'));
    });

    it('should align to hour', () => {
      const date = new Date('2026-06-30T14:45:00Z');
      const aligned = service.alignTimeToGranularity(date, 60);
      expect(aligned).toEqual(new Date('2026-06-30T14:00:00Z'));
    });

    it('should keep already aligned time', () => {
      const date = new Date('2026-06-30T14:00:00Z');
      const aligned = service.alignTimeToGranularity(date, 30);
      expect(aligned).toEqual(new Date('2026-06-30T14:00:00Z'));
    });
  });

  // ==================== Helpers ====================

  function createAvatar(
    id: number,
    venueId: number,
    formatId: number,
    ability: number,
    startTimeStr: string,
    waitMinutes: number,
    durationMinutes = 120,
  ): IntentionAvatar {
    const startTime = new Date(`2026-06-30T${startTimeStr}:00Z`);
    return {
      id: `${id}_${venueId}_${formatId}`,
      intentionId: id,
      playerId: 100 + id,
      totalAbilityScore: ability,
      venueId,
      formatId,
      startTime,
      acceptableWaitMinutes: waitMinutes,
      durationMinutes,
      submittedAt: new Date('2026-06-30T10:00:00Z'),
      timeWindowEnd: new Date(startTime.getTime() + waitMinutes * 60000),
    };
  }

  function createPool(avatars: IntentionAvatar[]) {
    return {
      venueId: avatars[0]?.venueId ?? 1,
      formatId: avatars[0]?.formatId ?? 10,
      avatars,
      poolStartTime: new Date(
        Math.min(...avatars.map((a) => a.startTime.getTime())),
      ),
      poolEndTime: new Date(
        Math.min(...avatars.map((a) => a.timeWindowEnd.getTime())),
      ),
    };
  }
});
