/**
 * Notification Channel Provider Interface
 *
 * Abstracts notification delivery operations across different channels
 * (push, sms, in_app). Allows seamless switching or adding new channels.
 *
 * For MVP: InAppChannel only updates sendStatus/sentAt in the database.
 * For production: Implement PushChannel and SmsChannel with actual SDKs.
 */

import { Notification } from '../entities/notification.entity';

export const NOTIFICATION_CHANNEL_PROVIDER = Symbol('NOTIFICATION_CHANNEL_PROVIDER');

export interface ChannelSendResult {
  success: boolean;
  channel: string;
  errorMessage?: string;
}

export interface NotificationChannelInterface {
  /**
   * Send a notification through this channel.
   *
   * @param notification - The notification entity to send
   * @returns Result indicating success/failure for this channel
   */
  send(notification: Notification): Promise<ChannelSendResult>;
}
