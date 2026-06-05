import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter } from 'events';
import { MessageService } from './message.service';
import { MatchMessage } from '../entities/match-message.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { Player } from '@modules/players/entities/player.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { SendMessageDto } from '../dto/send-message.dto';
import { QueryMessageDto } from '../dto/query-message.dto';

// ==================== Mock Types ====================

type MockRepository<T extends object = object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends object>(): MockRepository<T> => ({
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const createMockQueryBuilder = <T extends object>(items: T[] = []) => {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([items, items.length]),
  };
  return qb as unknown as jest.Mocked<SelectQueryBuilder<T>>;
};

// ==================== Mock Data Helpers ====================

function createMockMatch(overrides: Partial<Match> = {}): Match {
  const now = new Date();
  return {
    id: 1,
    venueId: 10,
    formatId: 20,
    startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    endTime: new Date(now.getTime() + 4 * 60 * 60 * 1000),
    status: 'confirmed',
    teamCount: 3,
    playersPerTeam: 3,
    totalPlayers: 9,
    confirmedPlayers: 9,
    depositAmount: '50.00',
    groupChatId: 'match_1_abc123',
    regionCode: 'shenzhen_futian',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Match;
}

function createMockMatchMessage(
  overrides: Partial<MatchMessage> = {},
): MatchMessage {
  return {
    id: 1,
    matchId: 1,
    senderId: 100,
    content: 'Hello!',
    messageType: 'text',
    createdAt: new Date(),
    ...overrides,
  } as MatchMessage;
}

function createMockSystemParam(
  overrides: Partial<SystemParam> = {},
): SystemParam {
  return {
    id: 1,
    paramKey: 'group_chat_expiry_days',
    paramValue: { expiry_days: 7 },
    description: '群聊有效期天数',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ==================== Test Suite ====================

describe('MessageService', () => {
  let service: MessageService;
  let messageRepo: MockRepository<MatchMessage>;
  let matchRepo: MockRepository<Match>;
  let matchPlayerRepo: MockRepository<MatchPlayer>;
  let playerRepo: MockRepository<Player>;
  let systemParamRepo: MockRepository<SystemParam>;
  let eventEmitter: EventEmitter;

  beforeEach(async () => {
    messageRepo = createMockRepository();
    matchRepo = createMockRepository();
    matchPlayerRepo = createMockRepository();
    playerRepo = createMockRepository();
    systemParamRepo = createMockRepository();
    eventEmitter = new EventEmitter();

    // Default player resolution: userId 100 -> playerId 100
    playerRepo.findOne!.mockResolvedValue({ id: 100, userId: 100 } as Player);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: getRepositoryToken(MatchMessage),
          useValue: messageRepo,
        },
        {
          provide: getRepositoryToken(Match),
          useValue: matchRepo,
        },
        {
          provide: getRepositoryToken(MatchPlayer),
          useValue: matchPlayerRepo,
        },
        {
          provide: getRepositoryToken(Player),
          useValue: playerRepo,
        },
        {
          provide: getRepositoryToken(SystemParam),
          useValue: systemParamRepo,
        },
        {
          provide: EventEmitter,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    eventEmitter.removeAllListeners();
    // Reset the private cache to prevent cross-test contamination
    (service as unknown as { expiryDaysCache: unknown }).expiryDaysCache = null;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== SEND MESSAGE ====================

  describe('sendMessage', () => {
    it('should send a text message successfully', async () => {
      const match = createMockMatch();
      const dto: SendMessageDto = { content: 'Hello everyone!' };
      const mockMessage = createMockMatchMessage({
        content: 'Hello everyone!',
      });

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());
      messageRepo.create!.mockReturnValue(mockMessage);
      messageRepo.save!.mockResolvedValue(mockMessage);

      const result = await service.sendMessage(1, 100, dto);

      expect(result.content).toBe('Hello everyone!');
      expect(result.messageType).toBe('text');
      expect(messageRepo.save).toHaveBeenCalled();
    });

    it('should send an image message successfully', async () => {
      const match = createMockMatch();
      const dto: SendMessageDto = {
        content: 'https://example.com/image.jpg',
        messageType: 'image',
      };
      const mockMessage = createMockMatchMessage({
        content: 'https://example.com/image.jpg',
        messageType: 'image',
      });

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());
      messageRepo.create!.mockReturnValue(mockMessage);
      messageRepo.save!.mockResolvedValue(mockMessage);

      const result = await service.sendMessage(1, 100, dto);

      expect(result.messageType).toBe('image');
    });

    it('should throw NotFoundException when match does not exist', async () => {
      matchRepo.findOneBy!.mockResolvedValue(null);

      const dto: SendMessageDto = { content: 'Test' };
      await expect(service.sendMessage(999, 100, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when sender is not a match participant', async () => {
      const match = createMockMatch();
      matchRepo.findOneBy!.mockResolvedValue(match);
      playerRepo.findOne!.mockResolvedValue(null);
      matchPlayerRepo.count!.mockResolvedValue(0);

      const dto: SendMessageDto = { content: 'Test' };
      await expect(service.sendMessage(1, 999, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when group chat has expired', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const match = createMockMatch({ createdAt: eightDaysAgo });

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());

      const dto: SendMessageDto = { content: 'Test' };
      await expect(service.sendMessage(1, 100, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when content is empty', async () => {
      const match = createMockMatch();
      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());

      const dto: SendMessageDto = { content: '' };
      await expect(service.sendMessage(1, 100, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when content is whitespace only', async () => {
      const match = createMockMatch();
      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());

      const dto: SendMessageDto = { content: '   \t\n  ' };
      await expect(service.sendMessage(1, 100, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when content exceeds max length', async () => {
      const match = createMockMatch();
      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());

      const dto: SendMessageDto = { content: 'a'.repeat(1001) };
      await expect(service.sendMessage(1, 100, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when messageType is invalid', async () => {
      const match = createMockMatch();
      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());

      const dto = {
        content: 'Test',
        messageType: 'system',
      } as unknown as SendMessageDto;
      await expect(service.sendMessage(1, 100, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should default messageType to text when not provided', async () => {
      const match = createMockMatch();
      const dto: SendMessageDto = { content: 'Hello!' };
      const mockMessage = createMockMatchMessage();

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());
      messageRepo.create!.mockReturnValue(mockMessage);
      messageRepo.save!.mockResolvedValue(mockMessage);

      const result = await service.sendMessage(1, 100, dto);

      expect(result.messageType).toBe('text');
    });

    it('should emit MessageSentEvent after successful send', async () => {
      const match = createMockMatch();
      const dto: SendMessageDto = { content: 'Hello!' };
      const mockMessage = createMockMatchMessage();

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());
      messageRepo.create!.mockReturnValue(mockMessage);
      messageRepo.save!.mockResolvedValue(mockMessage);

      const eventSpy = jest.fn();
      eventEmitter.on('message:sent', eventSpy);

      await service.sendMessage(1, 100, dto);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          matchId: 1,
          senderId: 100,
          content: 'Hello!',
          messageType: 'text',
        }),
      );
    });
  });

  // ==================== SEND SYSTEM MESSAGE ====================

  describe('sendSystemMessage', () => {
    it('should send a system message successfully', async () => {
      const match = createMockMatch();
      const mockMessage = createMockMatchMessage({
        senderId: 0,
        content: '比赛即将开始',
        messageType: 'system',
      });

      matchRepo.findOneBy!.mockResolvedValue(match);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());
      messageRepo.create!.mockReturnValue(mockMessage);
      messageRepo.save!.mockResolvedValue(mockMessage);

      const result = await service.sendSystemMessage(1, '比赛即将开始');

      expect(result.messageType).toBe('system');
      expect(result.content).toBe('比赛即将开始');
    });

    it('should throw ForbiddenException when group chat has expired', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const match = createMockMatch({ createdAt: eightDaysAgo });

      matchRepo.findOneBy!.mockResolvedValue(match);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());

      await expect(service.sendSystemMessage(1, 'Test')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when match does not exist', async () => {
      matchRepo.findOneBy!.mockResolvedValue(null);

      await expect(service.sendSystemMessage(999, 'Test')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when content is empty', async () => {
      const match = createMockMatch();

      matchRepo.findOneBy!.mockResolvedValue(match);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());

      await expect(service.sendSystemMessage(1, '   ')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ==================== GET MESSAGE HISTORY ====================

  describe('getMessageHistory', () => {
    it('should return paginated message history for a participant', async () => {
      const match = createMockMatch();
      const messages = [
        createMockMatchMessage({ id: 1, content: 'Message 1' }),
        createMockMatchMessage({ id: 2, content: 'Message 2' }),
      ];

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);

      const qb = createMockQueryBuilder(messages);
      messageRepo.createQueryBuilder!.mockReturnValue(qb);

      const query: QueryMessageDto = { page: 1, pageSize: 20 };
      const result = await service.getMessageHistory(1, 100, query);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.total).toBe(2);
      expect(result.list).toHaveLength(2);
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      const match = createMockMatch();
      matchRepo.findOneBy!.mockResolvedValue(match);
      playerRepo.findOne!.mockResolvedValue(null);
      matchPlayerRepo.count!.mockResolvedValue(0);

      const query: QueryMessageDto = {};
      await expect(service.getMessageHistory(1, 999, query)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when match does not exist', async () => {
      matchRepo.findOneBy!.mockResolvedValue(null);

      const query: QueryMessageDto = {};
      await expect(service.getMessageHistory(999, 100, query)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should apply pagination correctly', async () => {
      const match = createMockMatch();
      const messages = Array.from({ length: 5 }, (_, i) =>
        createMockMatchMessage({ id: i + 1 }),
      );

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);

      const qb = createMockQueryBuilder(messages);
      messageRepo.createQueryBuilder!.mockReturnValue(qb);

      const query: QueryMessageDto = { page: 2, pageSize: 10 };
      await service.getMessageHistory(1, 100, query);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(qb.skip).toHaveBeenCalledWith(10);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('should return empty list when no messages exist', async () => {
      const match = createMockMatch();

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);

      const qb = createMockQueryBuilder([]);
      messageRepo.createQueryBuilder!.mockReturnValue(qb);

      const query: QueryMessageDto = {};
      const result = await service.getMessageHistory(1, 100, query);

      expect(result.list).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should order messages by createdAt descending', async () => {
      const match = createMockMatch();

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);

      const qb = createMockQueryBuilder([]);
      messageRepo.createQueryBuilder!.mockReturnValue(qb);

      const query: QueryMessageDto = {};
      await service.getMessageHistory(1, 100, query);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(qb.orderBy).toHaveBeenCalledWith('message.created_at', 'DESC');
    });
  });

  // ==================== CAN SEND MESSAGES (BOUNDARY TESTS) ====================

  describe('canSendMessages boundary tests via sendMessage', () => {
    /**
     * 固定时间基准，消除 Date.now() 时序漂移导致的测试不稳定。
     * 所有边界测试使用同一时间锚点，确保 createdAt 和运行时 now 的一致性。
     */
    const FIXED_NOW = new Date('2026-06-05T12:00:00.000Z');

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW.getTime());
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should allow messages within configured expiry days', async () => {
      const threeDaysAgo = new Date(
        FIXED_NOW.getTime() - 3 * 24 * 60 * 60 * 1000,
      );
      const match = createMockMatch({ createdAt: threeDaysAgo });
      const dto: SendMessageDto = { content: 'Recent message' };
      const mockMessage = createMockMatchMessage({ content: 'Recent message' });

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(
        createMockSystemParam({ paramValue: { expiry_days: 5 } }),
      );
      messageRepo.create!.mockReturnValue(mockMessage);
      messageRepo.save!.mockResolvedValue(mockMessage);

      const result = await service.sendMessage(1, 100, dto);
      expect(result.content).toBe('Recent message');
    });

    it('should block messages after configured expiry days', async () => {
      const sixDaysAgo = new Date(
        FIXED_NOW.getTime() - 6 * 24 * 60 * 60 * 1000,
      );
      const match = createMockMatch({ createdAt: sixDaysAgo });

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(
        createMockSystemParam({ paramValue: { expiry_days: 5 } }),
      );

      const dto: SendMessageDto = { content: 'Too late' };
      await expect(service.sendMessage(1, 100, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should use default 7 days when system param is missing', async () => {
      const sixDaysAgo = new Date(
        FIXED_NOW.getTime() - 6 * 24 * 60 * 60 * 1000,
      );
      const match = createMockMatch({ createdAt: sixDaysAgo });
      const dto: SendMessageDto = { content: 'Default expiry test' };
      const mockMessage = createMockMatchMessage({
        content: 'Default expiry test',
      });

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(null);
      messageRepo.create!.mockReturnValue(mockMessage);
      messageRepo.save!.mockResolvedValue(mockMessage);

      const result = await service.sendMessage(1, 100, dto);
      expect(result.content).toBe('Default expiry test');
    });

    it('should allow messages exactly at expiry day boundary', async () => {
      const exactlySevenDaysAgo = new Date(
        FIXED_NOW.getTime() - 7 * 24 * 60 * 60 * 1000,
      );
      const match = createMockMatch({ createdAt: exactlySevenDaysAgo });
      const dto: SendMessageDto = { content: 'Boundary test' };
      const mockMessage = createMockMatchMessage({ content: 'Boundary test' });

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());
      messageRepo.create!.mockReturnValue(mockMessage);
      messageRepo.save!.mockResolvedValue(mockMessage);

      const result = await service.sendMessage(1, 100, dto);
      expect(result.content).toBe('Boundary test');
    });

    it('should use cached expiry days on subsequent calls', async () => {
      const match = createMockMatch();
      const dto: SendMessageDto = { content: 'Cache test' };
      const mockMessage = createMockMatchMessage({ content: 'Cache test' });

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockResolvedValue(createMockSystemParam());
      messageRepo.create!.mockReturnValue(mockMessage);
      messageRepo.save!.mockResolvedValue(mockMessage);

      // First call — should query database
      await service.sendMessage(1, 100, dto);
      expect(systemParamRepo.findOneBy).toHaveBeenCalledTimes(1);

      // Second call — should use cache, no additional DB query
      await service.sendMessage(1, 100, dto);
      expect(systemParamRepo.findOneBy).toHaveBeenCalledTimes(1);
    });

    it('should fallback to default when system param query throws', async () => {
      const sixDaysAgo = new Date(
        FIXED_NOW.getTime() - 6 * 24 * 60 * 60 * 1000,
      );
      const match = createMockMatch({ createdAt: sixDaysAgo });
      const dto: SendMessageDto = { content: 'DB error fallback' };
      const mockMessage = createMockMatchMessage({
        content: 'DB error fallback',
      });

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      systemParamRepo.findOneBy!.mockRejectedValue(
        new Error('Connection timeout'),
      );
      messageRepo.create!.mockReturnValue(mockMessage);
      messageRepo.save!.mockResolvedValue(mockMessage);

      const result = await service.sendMessage(1, 100, dto);
      expect(result.content).toBe('DB error fallback');
    });

    it('should fallback to default when system param value is invalid', async () => {
      const sixDaysAgo = new Date(
        FIXED_NOW.getTime() - 6 * 24 * 60 * 60 * 1000,
      );
      const match = createMockMatch({ createdAt: sixDaysAgo });
      const dto: SendMessageDto = { content: 'Invalid param fallback' };
      const mockMessage = createMockMatchMessage({
        content: 'Invalid param fallback',
      });

      matchRepo.findOneBy!.mockResolvedValue(match);
      matchPlayerRepo.count!.mockResolvedValue(1);
      // paramValue has expiry_days but it's a string, not a number
      systemParamRepo.findOneBy!.mockResolvedValue(
        createMockSystemParam({ paramValue: { expiry_days: 'seven' } }),
      );
      messageRepo.create!.mockReturnValue(mockMessage);
      messageRepo.save!.mockResolvedValue(mockMessage);

      const result = await service.sendMessage(1, 100, dto);
      expect(result.content).toBe('Invalid param fallback');
    });
  });
});
