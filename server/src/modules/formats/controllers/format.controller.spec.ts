import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FormatController } from './format.controller';
import { Format } from '../entities/format.entity';

// ==================== Mock Types ====================

type MockRepository = {
  find: jest.Mock;
};

// ==================== Test Data ====================

function createMockFormat(overrides: Partial<Format> = {}): Format {
  return {
    id: 1,
    name: '3v3短赛',
    formatType: 'short',
    teamSize: 3,
    teamCountMin: 3,
    teamCountMax: 4,
    winCondition: '先进5球或11分',
    durationHours: 1.5,
    description: '3对3短赛，先进5球或先得11分者胜',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    intentionFormats: Promise.resolve([]),
    ...overrides,
  } as Format;
}

// ==================== Tests ====================

describe('FormatController', () => {
  let controller: FormatController;
  let mockRepo: MockRepository;

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormatController],
      providers: [
        {
          provide: getRepositoryToken(Format),
          useValue: mockRepo,
        },
      ],
    }).compile();

    controller = module.get<FormatController>(FormatController);
  });

  describe('findAll', () => {
    it('should return all active formats', async () => {
      const formats = [
        createMockFormat({ id: 1, name: '3v3短赛', teamSize: 3 }),
        createMockFormat({ id: 2, name: '4v4短赛', teamSize: 4 }),
        createMockFormat({ id: 3, name: '5v5短赛', teamSize: 5 }),
      ];
      mockRepo.find.mockResolvedValue(formats);

      const result = await controller.findAll();

      expect(result).toEqual(formats);
      expect(mockRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
    });

    it('should return empty array when no active formats exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
    });

    it('should not return inactive formats', async () => {
      const activeFormats = [createMockFormat({ id: 1, isActive: true })];
      mockRepo.find.mockResolvedValue(activeFormats);

      const result = await controller.findAll();

      expect(result).toHaveLength(1);
      expect(mockRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
    });
  });
});
