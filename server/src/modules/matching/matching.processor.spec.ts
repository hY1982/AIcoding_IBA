import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { MatchingProcessor } from './matching.processor';
import { MatchingEngineService } from './services/matching-engine.service';
import { MatchingResult } from './interfaces/matching-result.interface';

describe('MatchingProcessor', () => {
  let processor: MatchingProcessor;
  let matchingEngine: jest.Mocked<MatchingEngineService>;

  beforeEach(async () => {
    matchingEngine = {
      runMatching: jest.fn(),
    } as unknown as jest.Mocked<MatchingEngineService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingProcessor,
        { provide: MatchingEngineService, useValue: matchingEngine },
      ],
    }).compile();

    processor = module.get<MatchingProcessor>(MatchingProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('should process job with regionCode and return result', async () => {
      const mockResult: MatchingResult = {
        intentionsScanned: 10,
        groupsProcessed: 2,
        matchesCreated: 1,
        matchesFailed: 0,
        expiredCount: 0,
        durationMs: 150,
      };
      matchingEngine.runMatching.mockResolvedValue(mockResult);

      const job = {
        id: 'job-1',
        data: { regionCode: 'shenzhen_futian' },
        attemptsMade: 0,
      } as unknown as Job<{ regionCode: string }>;

      const result = await processor.process(job);

      expect(matchingEngine.runMatching).toHaveBeenCalledWith('shenzhen_futian');
      expect(result).toEqual(mockResult);
    });

    it('should process job without regionCode', async () => {
      const mockResult: MatchingResult = {
        intentionsScanned: 50,
        groupsProcessed: 5,
        matchesCreated: 3,
        matchesFailed: 1,
        expiredCount: 2,
        durationMs: 500,
      };
      matchingEngine.runMatching.mockResolvedValue(mockResult);

      const job = {
        id: 'job-2',
        data: {},
        attemptsMade: 0,
      } as unknown as Job<{ regionCode?: string }>;

      const result = await processor.process(job);

      expect(matchingEngine.runMatching).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockResult);
    });

    it('should propagate errors from matching engine', async () => {
      matchingEngine.runMatching.mockRejectedValue(new Error('Database error'));

      const job = {
        id: 'job-3',
        data: { regionCode: 'test_region' },
        attemptsMade: 0,
      } as unknown as Job<{ regionCode: string }>;

      await expect(processor.process(job)).rejects.toThrow('Database error');
    });
  });

  describe('event handlers', () => {
    it('should handle completed event without error', () => {
      const job = {
        id: 'job-1',
        data: { regionCode: 'shenzhen_futian' },
        attemptsMade: 1,
      } as unknown as Job<{ regionCode: string }>;

      expect(() => processor.onCompleted(job)).not.toThrow();
    });

    it('should handle failed event without error', () => {
      const job = {
        id: 'job-1',
        data: { regionCode: 'shenzhen_futian' },
        attemptsMade: 2,
      } as unknown as Job<{ regionCode: string }>;

      expect(() => processor.onFailed(job, new Error('Test error'))).not.toThrow();
    });

    it('should handle active event without error', () => {
      const job = {
        id: 'job-1',
        data: { regionCode: 'shenzhen_futian' },
        attemptsMade: 0,
      } as unknown as Job<{ regionCode: string }>;

      expect(() => processor.onActive(job)).not.toThrow();
    });
  });
});
