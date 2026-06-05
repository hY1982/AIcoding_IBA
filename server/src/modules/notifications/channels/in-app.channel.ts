import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import {
  NotificationChannelInterface,
  ChannelSendResult,
} from '../interfaces/notification-channel.interface';

/**
 * In-App Notification Channel
 *
 * MVP 实现：仅更新通知记录的 sendStatus 和 sentAt，
 * 表示通知已送达应用内消息中心。
 *
 * 实际推送（WebSocket / 长轮询）由前端消息中心轮询或
 * 独立的消息推送服务负责。
 */
@Injectable()
export class InAppChannel implements NotificationChannelInterface {
  private readonly logger = new Logger(InAppChannel.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async send(notification: Notification): Promise<ChannelSendResult> {
    try {
      // 只修改内存中的 notification 对象，不执行 save
      // 由调用方（NotificationService.sendNotification）统一持久化
      notification.sendStatus = 'succeeded';
      notification.sentAt = new Date();

      this.logger.log(
        `In-app notification sent: id=${notification.id}, userId=${notification.userId}`,
      );

      return {
        success: true,
        channel: 'in_app',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send in-app notification: id=${notification.id}, error=${message}`,
      );

      return {
        success: false,
        channel: 'in_app',
        errorMessage: message,
      };
    }
  }
}
