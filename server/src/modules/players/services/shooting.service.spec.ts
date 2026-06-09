import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ShootingService } from './shooting.service';
import { PlayerShootingRecord } from '../entities/player-shooting-record.entity';
import { CreateShootingRecordDto } from '../dto/create-shooting-record.dto';

type MockRepository<T extends object = object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends object>(): MockRepository<T> => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

/**
 * 构建可链式调用的 QueryBuilder mock
 */
function createMockQueryBuilder(records: PlayerShootingRecord[]) {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(records),
  };
  return qb;
}

describe('ShootingService', () => {
  let service: ShootingService;
  let shootingRepo: MockRepository<PlayerShootingRecord>;

  beforeEach(async () => {
    shootingRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShootingService,
        {
          provide: getRepositoryToken(PlayerShootingRecord),
          useValue: shootingRepo,
        },
      ],
    }).compile();

    service = module.get<ShootingService>(ShootingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRecord', () => {
    it('should create a free_throw record successfully', async () => {
      const playerId = 1;
      const dto: CreateShootingRecordDto = {
        recordType: 'free_throw',
        shotsAttempted: 10,
        shotsMade: 7,
        recordDate: '2026-06-09',
      };
      const expectedRecord = {
        id: 1,
        playerId,
        recordType: 'free_throw',
        shotsAttempted: 10,
        shotsMade: 7,
        recordDate: new Date('2026-06-09'),
      } as PlayerShootingRecord;

      shootingRepo.create!.mockReturnValue(expectedRecord);
      shootingRepo.save!.mockResolvedValue(expectedRecord);

      const result = await service.createRecord(playerId, dto);

      expect(shootingRepo.create).toHaveBeenCalledWith({
        playerId,
        recordType: 'free_throw',
        shotsAttempted: 10,
        shotsMade: 7,
        recordDate: new Date(2026, 5, 9),
      });
      expect(shootingRepo.save).toHaveBeenCalledWith(expectedRecord);
      expect(result).toEqual(expectedRecord);
    });

    it('should create a three_point record successfully', async () => {
      const playerId = 1;
      const dto: CreateShootingRecordDto = {
        recordType: 'three_point',
        shotsAttempted: 20,
        shotsMade: 8,
        recordDate: '2026-05-01',
      };
      const expectedRecord = {
        id: 2,
        playerId,
        recordType: 'three_point',
        shotsAttempted: 20,
        shotsMade: 8,
        recordDate: new Date('2026-05-01'),
      } as PlayerShootingRecord;

      shootingRepo.create!.mockReturnValue(expectedRecord);
      shootingRepo.save!.mockResolvedValue(expectedRecord);

      const result = await service.createRecord(playerId, dto);

      expect(result.recordType).toBe('three_point');
      expect(result.shotsMade).toBe(8);
      expect(result.shotsAttempted).toBe(20);
    });

    it('should throw BadRequestException when shotsMade > shotsAttempted', async () => {
      const playerId = 1;
      const dto: CreateShootingRecordDto = {
        recordType: 'free_throw',
        shotsAttempted: 10,
        shotsMade: 11,
        recordDate: '2026-06-09',
      };

      await expect(service.createRecord(playerId, dto)).rejects.toThrow(
        new BadRequestException('命中数不能大于出手数'),
      );
      expect(shootingRepo.create).not.toHaveBeenCalled();
      expect(shootingRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when recordDate is in the future', async () => {
      const playerId = 1;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dto: CreateShootingRecordDto = {
        recordType: 'free_throw',
        shotsAttempted: 10,
        shotsMade: 5,
        recordDate: futureDate.toISOString().split('T')[0],
      };

      await expect(service.createRecord(playerId, dto)).rejects.toThrow(
        new BadRequestException('记录日期不能是未来日期'),
      );
      expect(shootingRepo.create).not.toHaveBeenCalled();
      expect(shootingRepo.save).not.toHaveBeenCalled();
    });

    it('should allow shotsAttempted=0 and shotsMade=0', async () => {
      const playerId = 1;
      const dto: CreateShootingRecordDto = {
        recordType: 'free_throw',
        shotsAttempted: 0,
        shotsMade: 0,
        recordDate: '2026-06-09',
      };
      const expectedRecord = {
        id: 3,
        playerId,
        recordType: 'free_throw',
        shotsAttempted: 0,
        shotsMade: 0,
        recordDate: new Date('2026-06-09'),
      } as PlayerShootingRecord;

      shootingRepo.create!.mockReturnValue(expectedRecord);
      shootingRepo.save!.mockResolvedValue(expectedRecord);

      const result = await service.createRecord(playerId, dto);

      expect(result.shotsAttempted).toBe(0);
      expect(result.shotsMade).toBe(0);
    });
  });

  describe('getShootingStats', () => {
    it('should return aggregated stats for records within 6 months', async () => {
      const playerId = 1;
      const today = new Date();
      const twoMonthsAgo = new Date(today);
      twoMonthsAgo.setMonth(today.getMonth() - 2);
      const fourMonthsAgo = new Date(today);
      fourMonthsAgo.setMonth(today.getMonth() - 4);

      const records: PlayerShootingRecord[] = [
        {
          id: 1,
          playerId,
          recordType: 'free_throw',
          shotsAttempted: 10,
          shotsMade: 7,
          recordDate: twoMonthsAgo,
        } as PlayerShootingRecord,
        {
          id: 2,
          playerId,
          recordType: 'free_throw',
          shotsAttempted: 20,
          shotsMade: 15,
          recordDate: fourMonthsAgo,
        } as PlayerShootingRecord,
        {
          id: 3,
          playerId,
          recordType: 'three_point',
          shotsAttempted: 30,
          shotsMade: 10,
          recordDate: twoMonthsAgo,
        } as PlayerShootingRecord,
      ];

      shootingRepo.createQueryBuilder!.mockReturnValue(createMockQueryBuilder(records));

      const result = await service.getShootingStats(playerId);

      expect(result).toHaveLength(2);
      const freeThrow = result.find((s) => s.recordType === 'free_throw');
      const threePoint = result.find((s) => s.recordType === 'three_point');

      expect(freeThrow).toBeDefined();
      expect(freeThrow!.totalAttempted).toBe(30);
      expect(freeThrow!.totalMade).toBe(22);
      expect(freeThrow!.percentage).toBe(73.3);

      expect(threePoint).toBeDefined();
      expect(threePoint!.totalAttempted).toBe(30);
      expect(threePoint!.totalMade).toBe(10);
      expect(threePoint!.percentage).toBe(33.3);
    });

    it('should exclude records older than 6 months', async () => {
      const playerId = 1;
      const today = new Date();
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(today.getMonth() - 1);

      const records: PlayerShootingRecord[] = [
        {
          id: 2,
          playerId,
          recordType: 'free_throw',
          shotsAttempted: 10,
          shotsMade: 8,
          recordDate: oneMonthAgo,
        } as PlayerShootingRecord,
      ];

      shootingRepo.createQueryBuilder!.mockReturnValue(createMockQueryBuilder(records));

      const result = await service.getShootingStats(playerId);

      expect(result).toHaveLength(1);
      expect(result[0].totalAttempted).toBe(10);
      expect(result[0].totalMade).toBe(8);
      expect(result[0].percentage).toBe(80);
    });

    it('should return empty array when no records exist', async () => {
      shootingRepo.createQueryBuilder!.mockReturnValue(createMockQueryBuilder([]));

      const result = await service.getShootingStats(1);

      expect(result).toEqual([]);
    });

    it('should return empty array when all records are older than 6 months', async () => {
      const playerId = 1;

      shootingRepo.createQueryBuilder!.mockReturnValue(createMockQueryBuilder([]));

      const result = await service.getShootingStats(playerId);

      expect(result).toEqual([]);
    });

    it('should calculate percentage with one decimal precision', async () => {
      const playerId = 1;
      const today = new Date();
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(today.getMonth() - 1);

      const records: PlayerShootingRecord[] = [
        {
          id: 1,
          playerId,
          recordType: 'free_throw',
          shotsAttempted: 3,
          shotsMade: 1,
          recordDate: oneMonthAgo,
        } as PlayerShootingRecord,
      ];

      shootingRepo.createQueryBuilder!.mockReturnValue(createMockQueryBuilder(records));

      const result = await service.getShootingStats(playerId);

      expect(result[0].percentage).toBe(33.3);
    });

    it('should return 0 percentage when totalAttempted is 0', async () => {
      const playerId = 1;
      const today = new Date();
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(today.getMonth() - 1);

      const records: PlayerShootingRecord[] = [
        {
          id: 1,
          playerId,
          recordType: 'free_throw',
          shotsAttempted: 0,
          shotsMade: 0,
          recordDate: oneMonthAgo,
        } as PlayerShootingRecord,
      ];

      shootingRepo.createQueryBuilder!.mockReturnValue(createMockQueryBuilder(records));

      const result = await service.getShootingStats(playerId);

      expect(result[0].percentage).toBe(0);
    });
  });
});
