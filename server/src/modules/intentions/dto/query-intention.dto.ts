import { IsInt, IsOptional, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { IntentionStatus, INTENTION_STATUSES } from '@shared/intention';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@shared/common';

/**
 * 查询意向列表 DTO
 *
 * 支持按状态筛选、分页查询。
 */
export class QueryIntentionDto {
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

  @IsEnum(INTENTION_STATUSES)
  @IsOptional()
  status?: IntentionStatus;
}
