import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { BatchCreateNotificationDto } from '../dto/batch-create-notification.dto';
import { QueryNotificationDto } from '../dto/query-notification.dto';
import {
  NotificationChannelInterface,
  NOTIFICATION_CHANNEL_PROVIDER,
} from '../interfaces/notification-channel.interface';
import { PaginatedResponse } from '@shared/common';
import { NotificationChannel } from '@shared/notification';
import { maskPhone, maskIdCard } from '@common/utils/privacy.util';

// 预编译正则（模块级常量，避免重复编译）
const PHONE_REGEX = /\b1[3-9]\d{9}\b/g;
const ID_CARD_REGEX = /\b\d{17}[\dXx]\b/g;

/**
 * Notification Service
 *
 * Core service for creating, sending, and querying user notifications.
 *
 * Responsibilities:
 * - Create notification records with privacy-masked content
 * - Dispatch notifications through configured channels
 * - Provide paginated queries with read/unread filtering
 * - Track send status and delivery timestamps
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @Inject(NOTIFICATION_CHANNEL_PROVIDER)
    private readonly channelService: NotificationChannelInterface,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== CREATE ====================

  /**
   * Create a notification record.
   *
   * Automatically masks phone numbers and ID card numbers in content
   * to prevent leaking sensitive information in notification messages.
   */
  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const sanitizedContent = this.sanitizeContent(dto.content);

    const notification = this.notificationRepo.create({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      content: sanitizedContent,
      data: dto.data ?? null,
      sendStatus: 'pending',
      sentAt: null,
      sentVia: dto.sentVia ?? null,
      regionCode: dto.regionCode ?? null,
    });

    const saved = await this.notificationRepo.save(notification);

    this.logger.log(
      `Notification created: id=${saved.id}, type=${saved.type}, userId=${saved.userId}`,
    );

    return saved;
  }

  /**
   * Batch create notifications for multiple users.
   *
   * Uses repository.save for bulk write and wraps in a transaction
   * for atomicity. Each user receives an independent notification record.
   */
  async batchCreateNotifications(
    dto: BatchCreateNotificationDto,
  ): Promise<Notification[]> {
    if (dto.userIds.length === 0) {
      return [];
    }

    const sanitizedContent = this.sanitizeContent(dto.content);

    const notifications = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Notification);

      const entities = dto.userIds.map((userId) =>
        repo.create({
          userId,
          type: dto.type,
          title: dto.title,
          content: sanitizedContent,
          data: dto.data ?? null,
          sendStatus: 'pending',
          sentAt: null,
          sentVia: dto.sentVia ?? null,
          regionCode: dto.regionCode ?? null,
        }),
      );

      const saved = await repo.save(entities);
      return saved;
    });

    this.logger.log(
      `Batch notifications created: count=${notifications.length}, type=${dto.type}`,
    );

    return notifications;
  }

  // ==================== SEND ====================

  /**
   * Send a notification through configured channels.
   *
   * Updates sendStatus and sentAt based on channel result.
   * If no channels specified, defaults to ['in_app'].
   */
  async sendNotification(
    notificationId: number,
    channels?: NotificationChannel[],
  ): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification not found: id=${notificationId}`,
      );
    }

    const targetChannels = channels ?? ['in_app'];

    const results: Array<{ success: boolean; channel: string }> = [];
    for (const channel of targetChannels) {
      if (channel === 'in_app') {
        const result = await this.channelService.send(notification);
        results.push(result);
      } else {
        this.logger.warn(`Channel not implemented: ${channel}`);
        results.push({ success: false, channel });
      }
    }

    const anySucceeded = results.some((r) => r.success);
    // allSucceeded 保留用于未来扩展部分成功状态（如 mixed）
    // const allSucceeded = results.every((r) => r.success);

    notification.sendStatus = anySucceeded ? 'succeeded' : 'failed';

    notification.sentVia = targetChannels;
    const saved = await this.notificationRepo.save(notification);

    this.logger.log(
      `Notification sent: id=${saved.id}, status=${saved.sendStatus}, channels=[${targetChannels.join(', ')}]`,
    );

    return saved;
  }

  // ==================== QUERY ====================

  /**
   * Find notifications for a user with pagination and read filter.
   */
  async findByUser(
    userId: number,
    query: QueryNotificationDto,
  ): Promise<PaginatedResponse<Notification>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const qb = this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId });

    if (query.isRead !== undefined) {
      qb.andWhere('notification.is_read = :isRead', { isRead: query.isRead });
    }

    qb.orderBy('notification.created_at', 'DESC').skip(skip).take(pageSize);

    const [list, total] = await qb.getManyAndCount();

    return { page, pageSize, total, list };
  }

  // ==================== MARK AS READ ====================

  /**
   * Mark a single notification as read.
   *
   * Validates ownership to prevent users from marking others' notifications.
   */
  async markAsRead(
    notificationId: number,
    userId: number,
  ): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification not found: id=${notificationId}`,
      );
    }

    if (notification.userId !== userId) {
      throw new NotFoundException(
        `Notification not found: id=${notificationId}`,
      );
    }

    notification.isRead = true;
    const saved = await this.notificationRepo.save(notification);

    this.logger.log(`Notification marked as read: id=${saved.id}`);

    return saved;
  }

  /**
   * Mark all notifications for a user as read.
   */
  async markAllAsRead(userId: number): Promise<{ affected: number }> {
    const result = await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('user_id = :userId', { userId })
      .andWhere('is_read = false')
      .execute();

    const affected = result.affected ?? 0;

    this.logger.log(
      `Marked all notifications as read for userId=${userId}, affected=${affected}`,
    );

    return { affected };
  }

  // ==================== UNREAD COUNT ====================

  /**
   * Get the count of unread notifications for a user.
   */
  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, isRead: false },
    });
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Sanitize notification content by masking sensitive data.
   *
   * Masks phone numbers (11-digit Chinese mobile numbers) and
   * ID card numbers (18-digit).
   *
   * Uses pre-compiled regexes and a fast-path for content without digits.
   */
  private sanitizeContent(content: string): string {
    // 快速路径：不含数字的内容无需脱敏
    if (!/\d/.test(content)) {
      return content;
    }

    let sanitized = content;
    // 手机号: 13812345678 -> 138****5678
    sanitized = sanitized.replace(PHONE_REGEX, (phone) => maskPhone(phone));
    // 身份证号: 110101199001011234 -> 110***********1234
    sanitized = sanitized.replace(ID_CARD_REGEX, (id) => maskIdCard(id));
    // P1: 真实姓名脱敏暂缓实施，避免误脱敏普通中文文本
    return sanitized;
  }
}
