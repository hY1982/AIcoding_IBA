import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { MatchingScheduler } from './matching.scheduler';
import { MatchingJobData } from './matching.processor';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    eval: jest.fn(),
    disconnect: jest.fn(),
  }));
});

describe('MatchingScheduler', () => {
  let scheduler: MatchingScheduler;
  let mockQueue: {
    add: jest.Mock;
    getJobs: jest.Mock;
    getJobCounts: jest.Mock;
  };
  let mockConfigService: { get: jest.Mock };
  let mockDataSource: {
    createQueryBuilder: jest.Mock;
  };
  let mockRedis: {
    set: jest.Mock;
    eval: jest.Mock;
  };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
      getJobs: jest.fn().mockResolvedValue([]),
      getJobCounts: jest
        .fn()
        .mockResolvedValue({ waiting: 0, active: 0, delayed: 0 }),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'redis') {
          return {
            host: 'localhost',
            port: 6379,
            password: undefined,
            db: 0,
            keyPrefix: 'basketball:',
          };
        }
        return undefined;
      }),
    };

    mockDataSource = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingScheduler,
        { provide: getQueueToken('matching'), useValue: mockQueue },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    scheduler = module.get<MatchingScheduler>(MatchingScheduler);

    // 获取内部 redis 实例
    mockRedis = (scheduler as any).redis;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('handleMatchingSchedule', () => {
    it('should skip when no active regions', async () => {
      const mockQb = createMockQueryBuilder([]);
      mockDataSource.createQueryBuilder.mockReturnValue(mockQb);

      await scheduler.handleMatchingSchedule();

      expect(mockDataSource.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should schedule job for region with pending intentions', async () => {
      // 模拟有活跃地区
      const regionQb = createMockQueryBuilder([
        { regionCode: 'shenzhen_futian' },
      ]);
      // 模拟 hasPendingIntentions 返回 true
      const countQb = createMockQueryBuilder([{ count: '5' }]);
      // 模拟 getJobs 返回空（无活跃 job）
      mockQueue.getJobs.mockResolvedValue([]);
      // 模拟成功获取锁
      mockRedis.set.mockResolvedValue('OK');
      // 模拟成功添加 job
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      let callCount = 0;
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return regionQb; // getActiveRegionCodes
        if (callCount === 2) return countQb; // hasPendingIntentions
        return regionQb;
      });

      await scheduler.handleMatchingSchedule();

      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'match-region',
        { regionCode: 'shenzhen_futian' },
        expect.any(Object),
      );
    });

    it('should skip when lock is already held', async () => {
      const regionQb = createMockQueryBuilder([
        { regionCode: 'shenzhen_futian' },
      ]);
      const countQb = createMockQueryBuilder([{ count: '5' }]);

      let callCount = 0;
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return regionQb;
        if (callCount === 2) return countQb;
        return regionQb;
      });

      // 锁已被占用
      mockRedis.set.mockResolvedValue(null);

      await scheduler.handleMatchingSchedule();

      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should skip when queue has active job for region', async () => {
      const regionQb = createMockQueryBuilder([
        { regionCode: 'shenzhen_futian' },
      ]);
      const countQb = createMockQueryBuilder([{ count: '5' }]);

      let callCount = 0;
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return regionQb;
        if (callCount === 2) return countQb;
        return regionQb;
      });

      mockRedis.set.mockResolvedValue('OK');
      // 模拟有活跃 job（getJobCounts 返回非零）
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 1,
        active: 0,
        delayed: 0,
      });
      // 队列已有该地区的活跃 job
      mockQueue.getJobs.mockResolvedValue([
        { id: 'existing-job', data: { regionCode: 'shenzhen_futian' } },
      ]);

      await scheduler.handleMatchingSchedule();

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should handle scheduler exceptions gracefully', async () => {
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // 不应抛出异常
      await expect(scheduler.handleMatchingSchedule()).resolves.not.toThrow();
    });

    it('should skip region when no pending intentions', async () => {
      const regionQb = createMockQueryBuilder([
        { regionCode: 'shenzhen_futian' },
      ]);
      // hasPendingIntentions 返回 0
      const countQb = createMockQueryBuilder([{ count: '0' }]);

      let callCount = 0;
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return regionQb;
        if (callCount === 2) return countQb;
        return regionQb;
      });

      mockRedis.set.mockResolvedValue('OK');

      await scheduler.handleMatchingSchedule();

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should handle redis lock acquisition failure', async () => {
      const regionQb = createMockQueryBuilder([
        { regionCode: 'shenzhen_futian' },
      ]);
      const countQb = createMockQueryBuilder([{ count: '5' }]);

      let callCount = 0;
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return regionQb;
        if (callCount === 2) return countQb;
        return regionQb;
      });

      // Redis set 抛出异常
      mockRedis.set.mockRejectedValue(new Error('Redis connection error'));

      await scheduler.handleMatchingSchedule();

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should handle getJobs exception gracefully', async () => {
      const regionQb = createMockQueryBuilder([
        { regionCode: 'shenzhen_futian' },
      ]);
      const countQb = createMockQueryBuilder([{ count: '5' }]);

      let callCount = 0;
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return regionQb;
        if (callCount === 2) return countQb;
        return regionQb;
      });

      mockRedis.set.mockResolvedValue('OK');
      // getJobs 抛出异常，但 scheduler 应该保守处理（假设没有活跃 job）
      mockQueue.getJobs.mockRejectedValue(new Error('Queue error'));
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      await scheduler.handleMatchingSchedule();

      // 应该继续添加 job，因为 getJobs 异常时返回 false（保守策略）
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should skip paused region when consecutiveFailures >= 3', async () => {
      const regionQb = createMockQueryBuilder([
        { regionCode: 'shenzhen_futian' },
      ]);
      const countQb = createMockQueryBuilder([{ count: '5' }]);

      let callCount = 0;
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return regionQb;
        if (callCount === 2) return countQb;
        return regionQb;
      });

      mockRedis.set.mockResolvedValue('OK');
      mockQueue.add.mockRejectedValue(new Error('Queue error'));

      // 先让地区暂停
      for (let i = 0; i < 3; i++) {
        callCount = 0;
        await scheduler.handleMatchingSchedule();
      }

      // 验证状态为暂停
      const state = (scheduler as any).regionStates.get('shenzhen_futian');
      expect(state.isPaused).toBe(true);
      expect(state.consecutiveFailures).toBe(3);

      // 再次执行，应该直接跳过
      callCount = 0;
      await scheduler.handleMatchingSchedule();

      // add 调用次数仍为3次（没有新增）
      expect(mockQueue.add).toHaveBeenCalledTimes(3);
    });

    it('should resume paused region when consecutiveFailures < 3', async () => {
      const regionQb = createMockQueryBuilder([
        { regionCode: 'shenzhen_futian' },
      ]);
      const countQb = createMockQueryBuilder([{ count: '5' }]);

      let callCount = 0;
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return regionQb;
        if (callCount === 2) return countQb;
        return regionQb;
      });

      // 设置地区状态为暂停，但 consecutiveFailures < 3
      const state = (scheduler as any).getOrCreateRegionState(
        'shenzhen_futian',
      );
      state.isPaused = true;
      state.consecutiveFailures = 2;

      mockRedis.set.mockResolvedValue('OK');
      mockQueue.add.mockResolvedValue({ id: 'job-resumed' });

      await scheduler.handleMatchingSchedule();

      // 应该恢复并添加 job
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should track consecutive failures and pause region after 3 failures', async () => {
      const regionQb = createMockQueryBuilder([
        { regionCode: 'shenzhen_futian' },
      ]);
      const countQb = createMockQueryBuilder([{ count: '5' }]);

      let callCount = 0;
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return regionQb;
        if (callCount === 2) return countQb;
        return regionQb;
      });

      mockRedis.set.mockResolvedValue('OK');
      // 模拟 add 连续失败
      mockQueue.add.mockRejectedValue(new Error('Queue error'));

      // 连续执行3次，每次都会失败
      for (let i = 0; i < 3; i++) {
        callCount = 0;
        await scheduler.handleMatchingSchedule();
      }

      // 第4次执行时，该地区应该已被暂停
      callCount = 0;
      await scheduler.handleMatchingSchedule();

      // 验证暂停后不再尝试添加 job（add 调用次数应为3次）
      expect(mockQueue.add).toHaveBeenCalledTimes(3);
    });

    it('should resume paused region after failures decrease', async () => {
      const regionQb = createMockQueryBuilder([
        { regionCode: 'shenzhen_futian' },
      ]);
      const countQb = createMockQueryBuilder([{ count: '5' }]);

      let callCount = 0;
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return regionQb;
        if (callCount === 2) return countQb;
        return regionQb;
      });

      mockRedis.set.mockResolvedValue('OK');
      mockQueue.add.mockRejectedValue(new Error('Queue error'));

      // 失败2次（未达到暂停阈值）
      for (let i = 0; i < 2; i++) {
        callCount = 0;
        await scheduler.handleMatchingSchedule();
      }

      // 手动重置失败计数（模拟恢复）
      const state = (scheduler as any).regionStates.get('shenzhen_futian');
      if (state) {
        state.consecutiveFailures = 0;
        state.isPaused = false;
      }

      // 再次执行，应该恢复正常
      callCount = 0;
      mockQueue.add.mockResolvedValue({ id: 'job-recovered' });
      await scheduler.handleMatchingSchedule();

      expect(mockQueue.add).toHaveBeenCalledTimes(3);
    });
  });

  describe('lock management', () => {
    it('should release lock after processing', async () => {
      const regionQb = createMockQueryBuilder([
        { regionCode: 'shenzhen_futian' },
      ]);
      const countQb = createMockQueryBuilder([{ count: '5' }]);

      let callCount = 0;
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return regionQb;
        if (callCount === 2) return countQb;
        return regionQb;
      });

      mockRedis.set.mockResolvedValue('OK');
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      await scheduler.handleMatchingSchedule();

      // 验证释放锁的 eval 被调用
      expect(mockRedis.eval).toHaveBeenCalled();
    });

    it('should handle release lock failure gracefully', async () => {
      const regionQb = createMockQueryBuilder([
        { regionCode: 'shenzhen_futian' },
      ]);
      const countQb = createMockQueryBuilder([{ count: '5' }]);

      let callCount = 0;
      mockDataSource.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return regionQb;
        if (callCount === 2) return countQb;
        return regionQb;
      });

      mockRedis.set.mockResolvedValue('OK');
      mockQueue.add.mockResolvedValue({ id: 'job-1' });
      // 模拟释放锁失败
      mockRedis.eval.mockRejectedValue(new Error('Redis eval error'));

      // 不应抛出异常
      await expect(scheduler.handleMatchingSchedule()).resolves.not.toThrow();
    });
  });

  describe('redis configuration defaults', () => {
    it('should use default redis config when config is missing', async () => {
      // 创建一个新的 scheduler 实例，使用空的 config
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MatchingScheduler,
          { provide: getQueueToken('matching'), useValue: mockQueue },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: DataSource, useValue: mockDataSource },
        ],
      }).compile();

      const newScheduler = module.get<MatchingScheduler>(MatchingScheduler);
      expect(newScheduler).toBeDefined();
    });
  });
});

// ==================== Helpers ====================

function createMockQueryBuilder(
  results: Array<Record<string, unknown>> = [],
): SelectQueryBuilder<Record<string, unknown>> {
  const qb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(results),
    getRawOne: jest.fn().mockResolvedValue(results[0] ?? null),
    getOne: jest.fn().mockResolvedValue(results[0] ?? null),
    getMany: jest.fn().mockResolvedValue(results),
    getCount: jest.fn().mockResolvedValue(results.length),
  } as unknown as SelectQueryBuilder<Record<string, unknown>>;
  return qb;
}
