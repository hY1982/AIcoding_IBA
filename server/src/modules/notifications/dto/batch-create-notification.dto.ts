import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayUnique,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  NotificationType,
  NOTIFICATION_TYPES,
  NotificationChannel,
  NOTIFICATION_CHANNELS,
} from '@shared/notification';

/**
 * 批量创建通知 DTO
 *
 * 用于为多个用户同时创建同类型通知（如比赛邀请、系统公告）。
 */
export class BatchCreateNotificationDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @Type(() => Number)
  userIds!: number[];

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
