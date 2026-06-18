import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MatchExpirationScheduler } from './match-expiration.scheduler';
import { MatchConfirmationService } from './services/match-confirmation.service';
import { DataSource } from 'typeorm';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    eval: jest.fn(),
    disconnect: jest.fn(),
  }));
});

describe('MatchExpirationScheduler', () => {
  let scheduler: MatchExpirationScheduler;
  let mockDataSource: {
    query: jest.Mock;
  };
  let mockConfirmationService: {
    finalizeMatch: jest.Mock;
    autoConfirmVenueBooking: jest.Mock;
  };
  let mockRedis: {
    set: jest.Mock;
    eval: jest.Mock;
    disconnect: jest.Mock;
  };

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn(),
    };

    mockConfirmationService = {
      finalizeMatch: jest.fn(),
      autoConfirmVenueBooking: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchExpirationScheduler,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: MatchConfirmationService,
          useValue: mockConfirmationService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              host: 'localhost',
              port: 6379,
              password: undefined,
              db: 0,
              keyPrefix: 'basketball:',
            }),
          },
        },
      ],
    }).compile();

    scheduler = module.get<MatchExpirationScheduler>(MatchExpirationScheduler);

    // Access the internal redis instance for mocking
    mockRedis = (scheduler as any).redis;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleExpirationSchedule', () => {
    it('should skip when lock is not acquired', async () => {
      mockRedis.set.mockResolvedValue(null); // Lock not acquired

      await scheduler.handleExpirationSchedule();

      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('should process all three phases when lock is acquired', async () => {
      // Acquire lock
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      // Phase 1: expired matches
      mockDataSource.query
        .mockResolvedValueOnce([{ id: '1' }, { id: '2' }]) // Phase 1 SELECT
        .mockResolvedValueOnce([{ id: '3' }]) // Phase 2 SELECT
        .mockResolvedValueOnce([{ id: '10' }, { id: '11' }]) // Phase 3 SELECT
        .mockResolvedValueOnce(undefined) // Phase 3 UPDATE intentions
        .mockResolvedValueOnce([undefined, 2]); // Phase 3 UPDATE match_players

      mockConfirmationService.finalizeMatch.mockResolvedValue({
        status: 'expired',
      });
      mockConfirmationService.autoConfirmVenueBooking.mockResolvedValue({
        success: true,
        message: 'confirmed',
      });

      await scheduler.handleExpirationSchedule();

      // Phase 1: finalizeMatch called for each expired match
      expect(mockConfirmationService.finalizeMatch).toHaveBeenCalledWith(1);
      expect(mockConfirmationService.finalizeMatch).toHaveBeenCalledWith(2);

      // Phase 2: autoConfirmVenueBooking called for each venue timeout
      expect(mockConfirmationService.autoConfirmVenueBooking).toHaveBeenCalledWith(3);

      // Phase 3: intentions expired + match players released
      expect(mockDataSource.query).toHaveBeenCalledTimes(5);
    });

    it('should handle finalizeMatch errors gracefully', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      mockDataSource.query
        .mockResolvedValueOnce([{ id: '1' }]) // Phase 1 SELECT
        .mockResolvedValueOnce([]) // Phase 2 SELECT (empty)
        .mockResolvedValueOnce([]); // Phase 3 SELECT (empty)

      mockConfirmationService.finalizeMatch.mockRejectedValue(
        new Error('DB error'),
      );

      // Should not throw
      await scheduler.handleExpirationSchedule();

      expect(mockConfirmationService.finalizeMatch).toHaveBeenCalledWith(1);
    });

    it('should handle autoConfirmVenueBooking errors gracefully', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      mockDataSource.query
        .mockResolvedValueOnce([]) // Phase 1 SELECT (empty)
        .mockResolvedValueOnce([{ id: '5' }]) // Phase 2 SELECT
        .mockResolvedValueOnce([]); // Phase 3 SELECT (empty)

      mockConfirmationService.autoConfirmVenueBooking.mockRejectedValue(
        new Error('Venue booking failed'),
      );

      await scheduler.handleExpirationSchedule();

      expect(mockConfirmationService.autoConfirmVenueBooking).toHaveBeenCalledWith(5);
    });
  });

  describe('Phase 1: expirePlayerConfirmationMatches', () => {
    it('should use SKIP LOCKED to avoid concurrent processing', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      mockDataSource.query
        .mockResolvedValueOnce([{ id: '1' }]) // SELECT with SKIP LOCKED
        .mockResolvedValueOnce([]) // Phase 2
        .mockResolvedValueOnce([]); // Phase 3

      mockConfirmationService.finalizeMatch.mockResolvedValue({
        status: 'expired',
      });

      await scheduler.handleExpirationSchedule();

      // Verify the SELECT query includes SKIP LOCKED
      const selectQuery = mockDataSource.query.mock.calls[0][0];
      expect(selectQuery).toContain('FOR UPDATE SKIP LOCKED');
      expect(selectQuery).toContain("status = 'pending_players'");
      expect(selectQuery).toContain('confirm_deadline');
    });

    it('should return 0 when no expired matches', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      mockDataSource.query
        .mockResolvedValueOnce([]) // Phase 1: no matches
        .mockResolvedValueOnce([]) // Phase 2
        .mockResolvedValueOnce([]); // Phase 3

      await scheduler.handleExpirationSchedule();

      expect(mockConfirmationService.finalizeMatch).not.toHaveBeenCalled();
    });
  });

  describe('Phase 2: autoConfirmVenueMatches', () => {
    it('should query pending_venue matches past venueConfirmDeadline', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      mockDataSource.query
        .mockResolvedValueOnce([]) // Phase 1
        .mockResolvedValueOnce([{ id: '7' }]) // Phase 2 SELECT
        .mockResolvedValueOnce([]); // Phase 3

      mockConfirmationService.autoConfirmVenueBooking.mockResolvedValue({
        success: true,
        message: 'auto_confirmed',
      });

      await scheduler.handleExpirationSchedule();

      const selectQuery = mockDataSource.query.mock.calls[1][0];
      expect(selectQuery).toContain("status = 'pending_venue'");
      expect(selectQuery).toContain('venue_confirm_deadline');
      expect(selectQuery).toContain('FOR UPDATE SKIP LOCKED');
    });
  });

  describe('Phase 3: expireIntentions', () => {
    it('should batch update expired intentions and release match players', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      mockDataSource.query
        .mockResolvedValueOnce([]) // Phase 1
        .mockResolvedValueOnce([]) // Phase 2
        .mockResolvedValueOnce([{ id: '100' }, { id: '101' }]) // Phase 3 SELECT
        .mockResolvedValueOnce(undefined) // UPDATE intentions
        .mockResolvedValueOnce([undefined, 3]); // UPDATE match_players

      await scheduler.handleExpirationSchedule();

      // Verify batch UPDATE for intentions
      const updateIntentionsCall = mockDataSource.query.mock.calls[3];
      expect(updateIntentionsCall[0]).toContain('UPDATE intentions');
      expect(updateIntentionsCall[0]).toContain("status = 'expired'");
      expect(updateIntentionsCall[1]).toEqual([100, 101]);

      // Verify UPDATE for match_players release
      const updateMatchPlayersCall = mockDataSource.query.mock.calls[4];
      expect(updateMatchPlayersCall[0]).toContain('UPDATE match_players');
      expect(updateMatchPlayersCall[0]).toContain("status = 'withdrawn'");
      expect(updateMatchPlayersCall[0]).toContain("status = 'pending_players'");
    });

    it('should only release invited players in pending_players matches', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      mockDataSource.query
        .mockResolvedValueOnce([]) // Phase 1
        .mockResolvedValueOnce([]) // Phase 2
        .mockResolvedValueOnce([{ id: '50' }]) // Phase 3 SELECT
        .mockResolvedValueOnce(undefined) // UPDATE intentions
        .mockResolvedValueOnce([undefined, 0]); // UPDATE match_players (none released)

      await scheduler.handleExpirationSchedule();

      const updateMatchPlayersCall = mockDataSource.query.mock.calls[4];
      // Should filter by pending_players match status and invited player status
      expect(updateMatchPlayersCall[0]).toContain("m.status = 'pending_players'");
      expect(updateMatchPlayersCall[0]).toContain("mp.status = 'invited'");
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect Redis on module destroy', async () => {
      mockRedis.disconnect.mockResolvedValue(undefined);
      await scheduler.onModuleDestroy();
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });
});
