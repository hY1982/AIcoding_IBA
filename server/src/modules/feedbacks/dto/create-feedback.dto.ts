import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  IsArray,
  ValidateNested,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LEVEL_MATCH_OPTIONS,
  SPORTSMANSHIP_OPTIONS,
  ACTION_CLEANLINESS_OPTIONS,
} from '@shared/feedback';
import type { LevelMatch, Sportsmanship, ActionCleanliness } from '@shared/feedback';

/**
 * 单条球员评分 DTO
 *
 * 用于在 CreateFeedbackDto 中嵌套提交对其他球员的多维度评价。
 */
export class CreateFeedbackPlayerRatingDto {
  @ApiProperty({ description: '被评价球员ID' })
  @IsInt()
  @Type(() => Number)
  ratedPlayerId!: number;

  @ApiPropertyOptional({ description: '水平匹配评价', enum: LEVEL_MATCH_OPTIONS })
  @IsOptional()
  @IsEnum(LEVEL_MATCH_OPTIONS)
  levelMatch?: LevelMatch;

  @ApiPropertyOptional({ description: '体育道德评价', enum: SPORTSMANSHIP_OPTIONS })
  @IsOptional()
  @IsEnum(SPORTSMANSHIP_OPTIONS)
  sportsmanship?: Sportsmanship;

  @ApiPropertyOptional({ description: '动作干净程度评价', enum: ACTION_CLEANLINESS_OPTIONS })
  @IsOptional()
  @IsEnum(ACTION_CLEANLINESS_OPTIONS)
  actionCleanliness?: ActionCleanliness;

  @ApiPropertyOptional({ description: '是否准时到场' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPunctual?: boolean;
}

/**
 * 创建赛后反馈 DTO
 *
 * 球员提交对整场比赛的总体评价，以及对其他参赛球员的多维度评分。
 *
 * 业务规则（由 FeedbackService 在应用层补充校验）：
 * - 每场比赛每个球员只能提交一次反馈（数据库唯一约束兜底）
 * - ratedPlayerId 不能等于提交者自身 playerId（禁止自评）
 * - ratedPlayerId 必须是同场比赛的其他 confirmed 球员
 */
export class CreateFeedbackDto {
  @ApiProperty({ description: '比赛ID' })
  @IsInt()
  @Type(() => Number)
  matchId!: number;

  @ApiProperty({ description: '提交反馈的球员ID' })
  @IsInt()
  @Type(() => Number)
  playerId!: number;

  @ApiProperty({ description: '总体评分 (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  overallRating!: number;

  @ApiPropertyOptional({ description: '总体评价理由', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overallReason?: string;

  @ApiProperty({ description: '对其他球员的多维度评分', type: [CreateFeedbackPlayerRatingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFeedbackPlayerRatingDto)
  playerRatings!: CreateFeedbackPlayerRatingDto[];
}
