import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 意向场地选择项
 */
export class IntentionVenueItemDto {
  @IsNumber()
  @Type(() => Number)
  venueId!: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  priority!: number;
}

/**
 * 意向赛制选择项
 */
export class IntentionFormatItemDto {
  @IsNumber()
  @Type(() => Number)
  formatId!: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  priority!: number;
}

/**
 * 创建比赛意向 DTO
 *
 * 规则：
 * - startTime 必须至少提前 1 小时
 * - durationMinutes 范围 120-360 分钟
 * - venueIds 至少 1 个、最多 3 个
 * - formatIds 至少 1 个、最多 3 个
 * - endTime / expiresAt / regionCode 由后端自动计算，不可传入
 */
export class CreateIntentionDto {
  @IsString()
  @IsNotEmpty()
  startTime!: string; // ISO 8601

  @IsInt()
  @Min(120)
  @Max(360)
  @Type(() => Number)
  durationMinutes!: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  acceptableWaitMinutes?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => IntentionVenueItemDto)
  venueIds!: IntentionVenueItemDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => IntentionFormatItemDto)
  formatIds!: IntentionFormatItemDto[];
}
