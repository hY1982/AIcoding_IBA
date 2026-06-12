import { IsInt, IsOptional, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStatus, MATCH_STATUSES } from '@shared/match';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@shared/common';

/**
 * 查询比赛列表 DTO
 *
 * 支持按比赛状态筛选、分页查询当前球员参与的比赛。
 * status 为可选参数，不传则返回所有状态的比赛。
 */
export class QueryMatchDto {
  @ApiPropertyOptional({ description: '页码', minimum: 1, default: 1 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '每页条数',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @Type(() => Number)
  pageSize?: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    description: '比赛状态筛选（不传则返回所有状态）',
    enum: MATCH_STATUSES,
  })
  @IsEnum(MATCH_STATUSES)
  @IsOptional()
  status?: MatchStatus;
}
