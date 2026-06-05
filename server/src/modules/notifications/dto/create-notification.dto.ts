import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  NotificationType,
  NOTIFICATION_TYPES,
  NotificationChannel,
  NOTIFICATION_CHANNELS,
} from '@shared/notification';

/**
 * 创建通知 DTO
 *
 * 用于内部服务调用创建通知记录。
 */
export class CreateNotificationDto {
  @IsInt()
  @Type(() => Number)
  userId!: number;

  @IsEnum(NOTIFICATION_TYPES)
  type!: NotificationType;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsEnum(NOTIFICATION_CHANNELS, { each: true })
  @ArrayUnique()
  sentVia?: NotificationChannel[];

  @IsOptional()
  @IsString()
  regionCode?: string;
}
