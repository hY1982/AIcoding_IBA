import { IsInt, IsOptional, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@shared/common';

/**
 * 查询用户通知列表 DTO
 *
 * 支持按已读/未读筛选、分页查询。
 */
export class QueryNotificationDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @Type(() => Number)
  pageSize?: number = DEFAULT_PAGE_SIZE;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isRead?: boolean;
}
