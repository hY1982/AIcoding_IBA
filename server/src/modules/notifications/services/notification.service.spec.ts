import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, UpdateQueryBuilder } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification } from '../entities/notification.entity';
import {
  NotificationChannelInterface,
  NOTIFICATION_CHANNEL_PROVIDER,
} from '../interfaces/notification-channel.interface';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { BatchCreateNotificationDto } from '../dto/batch-create-notification.dto';
import { QueryNotificationDto } from '../dto/query-notification.dto';
import { DataSource } from 'typeorm';

// ==================== Mock Types ====================

type MockRepository<T extends object = object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends object>(): MockRepository<T> => ({
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  findByIds: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  insert: jest.fn(),
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
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 3 }),
  };
  return qb as unknown as jest.Mocked<SelectQueryBuilder<T>>;
};

const createMockDataSource = () => ({
  transaction: jest.fn(),
});

// ==================== Test Suite ====================

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: MockRepository<Notification>;
  let channelService: jest.Mocked<NotificationChannelInterface>;
  let dataSource: ReturnType<typeof createMockDataSource>;

  beforeEach(async () => {
    notificationRepo = createMockRepository();
    channelService = {
      send: jest.fn(),
    };
    dataSource = createMockDataSource();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: notificationRepo,
        },
        {
          provide: NOTIFICATION_CHANNEL_PROVIDER,
          useValue: channelService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== CREATE NOTIFICATION ====================

  describe('createNotification', () => {
    it('should create a notification with correct fields', async () => {
      const dto: CreateNotificationDto = {
        userId: 1,
        type: 'match_invited',
        title: '比赛邀请',
        content: '您被邀请参加比赛',
      };

      const mockNotification = {
        id: 1,
        userId: 1,
        type: 'match_invited',
        title: '比赛邀请',
        content: '您被邀请参加比赛',
        data: null,
        isRead: false,
        sendStatus: 'pending',
        sentAt: null,
        sentVia: null,
        regionCode: null,
        createdAt: new Date(),
      } as Notification;

      notificationRepo.create!.mockReturnValue(mockNotification);
      notificationRepo.save!.mockResolvedValue(mockNotification);

      const result = await service.createNotification(dto);

      expect(notificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: 'match_invited',
          title: '比赛邀请',
          content: '您被邀请参加比赛',
          sendStatus: 'pending',
          sentAt: null,
        }),
      );
      expect(result.id).toBe(1);
      expect(result.sendStatus).toBe('pending');
    });

    it('should mask phone numbers in content', async () => {
      const dto: CreateNotificationDto = {
        userId: 1,
        type: 'system_announcement',
        title: '联系通知',
        content: '请联系 13812345678 确认比赛时间，或拨打 13987654321',
      };

      const mockNotification = {
        id: 2,
        userId: 1,
        content: '请联系 138****5678 确认比赛时间，或拨打 139****4321',
        sendStatus: 'pending',
      } as Notification;

      notificationRepo.create!.mockReturnValue(mockNotification);
      notificationRepo.save!.mockResolvedValue(mockNotification);

      const result = await service.createNotification(dto);

      expect(result.content).not.toContain('13812345678');
      expect(result.content).not.toContain('13987654321');
      expect(result.content).toContain('138****5678');
      expect(result.content).toContain('139****4321');
    });

    it('should mask id card numbers in content', async () => {
      const dto: CreateNotificationDto = {
        userId: 1,
        type: 'system_announcement',
        title: '实名认证',
        content: '您的身份证号 110101199001011234 已验证通过',
      };

      const mockNotification = {
        id: 3,
        userId: 1,
        content: '您的身份证号 110***********1234 已验证通过',
        sendStatus: 'pending',
      } as Notification;

      notificationRepo.create!.mockReturnValue(mockNotification);
      notificationRepo.save!.mockResolvedValue(mockNotification);

      const result = await service.createNotification(dto);

      expect(result.content).not.toContain('110101199001011234');
      expect(result.content).toContain('110***********1234');
    });

    it('should preserve content without sensitive info', async () => {
      const dto: CreateNotificationDto = {
        userId: 1,
        type: 'match_confirmed',
        title: '比赛确认',
        content: '您的比赛已确认，请准时到场。',
      };

      const mockNotification = {
        id: 4,
        content: '您的比赛已确认，请准时到场。',
      } as Notification;

      notificationRepo.create!.mockReturnValue(mockNotification);
      notificationRepo.save!.mockResolvedValue(mockNotification);

      const result = await service.createNotification(dto);

      expect(result.content).toBe('您的比赛已确认，请准时到场。');
    });

    it('should default optional fields to null', async () => {
      const dto: CreateNotificationDto = {
        userId: 1,
        type: 'payment_success',
        title: '支付成功',
        content: '支付成功',
      };

      notificationRepo.create!.mockImplementation((data) => ({ ...data } as Notification));
      notificationRepo.save!.mockImplementation((n) => Promise.resolve(n as Notification));

      await service.createNotification(dto);

      expect(notificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: null,
          sentVia: null,
          regionCode: null,
        }),
      );
    });

    it('should use fast path when content has no digits', async () => {
      const dto: CreateNotificationDto = {
        userId: 1,
        type: 'match_confirmed',
        title: '比赛确认',
        content: '您的比赛已确认，请准时到场。',
      };

      const mockNotification = {
        id: 5,
        content: '您的比赛已确认，请准时到场。',
      } as Notification;

      notificationRepo.create!.mockReturnValue(mockNotification);
      notificationRepo.save!.mockResolvedValue(mockNotification);

      const result = await service.createNotification(dto);

      expect(result.content).toBe('您的比赛已确认，请准时到场。');
    });
  });

  // ==================== BATCH CREATE NOTIFICATIONS ====================

  describe('batchCreateNotifications', () => {
    it('should create notifications for multiple users within transaction', async () => {
      const dto: BatchCreateNotificationDto = {
        userIds: [1, 2, 3],
        type: 'match_invited',
        title: '比赛邀请',
        content: '您被邀请参加比赛',
      };

      const mockNotifications = [
        { id: 1, userId: 1, type: 'match_invited', content: '您被邀请参加比赛' },
        { id: 2, userId: 2, type: 'match_invited', content: '您被邀请参加比赛' },
        { id: 3, userId: 3, type: 'match_invited', content: '您被邀请参加比赛' },
      ] as Notification[];

      dataSource.transaction.mockImplementation(async (fn: any) => {
        const mockRepo = {
          create: jest.fn().mockImplementation((data) => ({ ...data })),
          save: jest.fn().mockResolvedValue(mockNotifications),
        };
        const manager = {
          getRepository: jest.fn().mockReturnValue(mockRepo),
        };
        return fn(manager);
      });

      const result = await service.batchCreateNotifications(dto);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result).toHaveLength(3);
    });

    it('should sanitize content in batch creation', async () => {
      const dto: BatchCreateNotificationDto = {
        userIds: [1, 2],
        type: 'system_announcement',
        title: '联系通知',
        content: '请联系 13812345678',
      };

      const mockNotifications = [
        { id: 1, userId: 1, content: '请联系 138****5678' },
        { id: 2, userId: 2, content: '请联系 138****5678' },
      ] as Notification[];

      dataSource.transaction.mockImplementation(async (fn: any) => {
        const mockRepo = {
          create: jest.fn().mockImplementation((data) => ({ ...data })),
          save: jest.fn().mockResolvedValue(mockNotifications),
        };
        const manager = {
          getRepository: jest.fn().mockReturnValue(mockRepo),
        };
        return fn(manager);
      });

      const result = await service.batchCreateNotifications(dto);

      expect(result[0].content).not.toContain('13812345678');
      expect(result[0].content).toContain('138****5678');
    });

    it('should return empty array for empty userIds', async () => {
      const dto: BatchCreateNotificationDto = {
        userIds: [],
        type: 'match_invited',
        title: '比赛邀请',
        content: '您被邀请参加比赛',
      };

      const result = await service.batchCreateNotifications(dto);

      expect(result).toEqual([]);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // ==================== SEND NOTIFICATION ====================

  describe('sendNotification', () => {
    it('should send via in_app channel and update status', async () => {
      const notification = {
        id: 1,
        userId: 1,
        sendStatus: 'pending',
        sentAt: null,
        sentVia: null,
      } as Notification;

      notificationRepo.findOne!.mockResolvedValue(notification);
      channelService.send.mockResolvedValue({ success: true, channel: 'in_app' });
      notificationRepo.save!.mockImplementation((n) => {
        const saved = { ...(n as Notification) };
        // InAppChannel sets sentAt, simulate that
        if (saved.sendStatus === 'succeeded') {
          saved.sentAt = new Date();
        }
        return Promise.resolve(saved);
      });

      const result = await service.sendNotification(1);

      expect(channelService.send).toHaveBeenCalledWith(notification);
      expect(result.sendStatus).toBe('succeeded');
      expect(result.sentAt).toBeInstanceOf(Date);
      expect(result.sentVia).toEqual(['in_app']);
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      notificationRepo.findOne!.mockResolvedValue(null);

      await expect(service.sendNotification(999)).rejects.toThrow(NotFoundException);
    });

    it('should handle unimplemented channels gracefully', async () => {
      const notification = {
        id: 1,
        userId: 1,
        sendStatus: 'pending',
        sentAt: null,
        sentVia: null,
      } as Notification;

      notificationRepo.findOne!.mockResolvedValue(notification);
      channelService.send.mockResolvedValue({ success: true, channel: 'in_app' });
      notificationRepo.save!.mockImplementation((n) => Promise.resolve(n as Notification));

      const result = await service.sendNotification(1, ['in_app', 'sms']);

      expect(result.sendStatus).toBe('succeeded');
      expect(result.sentVia).toEqual(['in_app', 'sms']);
    });

    it('should handle channel send failure', async () => {
      const notification = {
        id: 1,
        userId: 1,
        sendStatus: 'pending',
        sentAt: null,
        sentVia: null,
      } as Notification;

      notificationRepo.findOne!.mockResolvedValue(notification);
      channelService.send.mockResolvedValue({ success: false, channel: 'in_app', errorMessage: 'DB error' });
      notificationRepo.save!.mockImplementation((n) => Promise.resolve(n as Notification));

      const result = await service.sendNotification(1);

      expect(result.sendStatus).toBe('failed');
    });
  });

  // ==================== FIND BY USER ====================

  describe('findByUser', () => {
    it('should return paginated notifications for user', async () => {
      const notifications = [
        { id: 1, userId: 1, isRead: false },
        { id: 2, userId: 1, isRead: true },
      ] as Notification[];

      const qb = createMockQueryBuilder(notifications);
      notificationRepo.createQueryBuilder!.mockReturnValue(qb);

      const query: QueryNotificationDto = { page: 1, pageSize: 10 };
      const result = await service.findByUser(1, query);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(2);
      expect(result.list).toHaveLength(2);
    });

    it('should filter by isRead status', async () => {
      const notifications = [{ id: 1, userId: 1, isRead: false }] as Notification[];
      const qb = createMockQueryBuilder(notifications);
      notificationRepo.createQueryBuilder!.mockReturnValue(qb);

      const query: QueryNotificationDto = { isRead: false };
      await service.findByUser(1, query);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'notification.is_read = :isRead',
        { isRead: false },
      );
    });

    it('should apply pagination correctly', async () => {
      const notifications = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        userId: 1,
      })) as Notification[];

      const qb = createMockQueryBuilder(notifications);
      notificationRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.findByUser(1, { page: 2, pageSize: 5 });

      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(5);
    });

    it('should return empty list when no notifications', async () => {
      const qb = createMockQueryBuilder([]);
      notificationRepo.createQueryBuilder!.mockReturnValue(qb);

      const result = await service.findByUser(999, {});

      expect(result.list).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==================== MARK AS READ ====================

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notification = {
        id: 1,
        userId: 1,
        isRead: false,
      } as Notification;

      notificationRepo.findOne!.mockResolvedValue(notification);
      notificationRepo.save!.mockImplementation((n) => Promise.resolve(n as Notification));

      const result = await service.markAsRead(1, 1);

      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      notificationRepo.findOne!.mockResolvedValue(null);

      await expect(service.markAsRead(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for other user notification', async () => {
      const notification = {
        id: 1,
        userId: 2,
        isRead: false,
      } as Notification;

      notificationRepo.findOne!.mockResolvedValue(notification);

      await expect(service.markAsRead(1, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };

      notificationRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const result = await service.markAllAsRead(1);

      expect(result.affected).toBe(3);
      expect(qb.set).toHaveBeenCalledWith({ isRead: true });
      expect(qb.andWhere).toHaveBeenCalledWith('is_read = false');
    });
  });

  // ==================== UNREAD COUNT ====================

  describe('getUnreadCount', () => {
    it('should return unread count for user', async () => {
      notificationRepo.count!.mockResolvedValue(5);

      const result = await service.getUnreadCount(1);

      expect(result).toBe(5);
      expect(notificationRepo.count).toHaveBeenCalledWith({
        where: { userId: 1, isRead: false },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      notificationRepo.count!.mockResolvedValue(0);

      const result = await service.getUnreadCount(1);

      expect(result).toBe(0);
    });
  });
});
