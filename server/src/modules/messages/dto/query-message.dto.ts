import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DEFAULT_PAGE_SIZE } from '@shared/common';

/**
 * 查询消息历史 DTO
 *
 * 支持按比赛分页查询群聊消息历史。
 *
 * 性能考虑：
 * - pageSize 最大限制为 50，防止深度分页导致的性能陷阱
 * - 消息按 createdAt DESC 排序，利用 (match_id, created_at) 复合索引
 */
export class QueryMessageDto {
  @ApiPropertyOptional({ description: '页码', minimum: 1, default: 1 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '每页条数',
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  pageSize?: number = DEFAULT_PAGE_SIZE;
}
