import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { VENUE_STATUSES, VenueStatus } from '@shared/venue';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@shared/common';

/**
 * 查询场地列表 DTO
 */
export class QueryVenueDto {
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

  @IsString()
  @IsOptional()
  regionCode?: string;

  @IsEnum(VENUE_STATUSES)
  @IsOptional()
  status?: VenueStatus;
}
