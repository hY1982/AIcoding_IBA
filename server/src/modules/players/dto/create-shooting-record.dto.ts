import {
  IsEnum,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ShootingRecordType, SHOOTING_RECORD_TYPES } from '@shared/player';

/**
 * 录入投篮记录 DTO
 *
 * 支持罚球线(free_throw)和三分线(three_point)两种类型。
 * 录入格式：投T中Z（shotsAttempted = T, shotsMade = Z）
 *
 * recordDate 严格限定为 YYYY-MM-DD 日期格式，避免时分秒歧义。
 *
 * 跨字段校验：命中数不能大于出手数（由 class-validator 的 @Validate 在实例级别执行）
 */
export class CreateShootingRecordDto {
  @ApiProperty({
    description: '投篮记录类型',
    enum: SHOOTING_RECORD_TYPES,
    example: 'free_throw',
  })
  @IsEnum(SHOOTING_RECORD_TYPES)
  @IsNotEmpty()
  recordType!: ShootingRecordType;

  @ApiProperty({
    description: '出手次数',
    minimum: 0,
    maximum: 1000,
    example: 10,
  })
  @IsInt()
  @Min(0)
  @Max(1000)
  @Type(() => Number)
  shotsAttempted!: number;

  @ApiProperty({
    description: '命中次数',
    minimum: 0,
    maximum: 1000,
    example: 7,
  })
  @IsInt()
  @Min(0)
  @Max(1000)
  @Type(() => Number)
  shotsMade!: number;

  @ApiProperty({
    description: '记录日期（YYYY-MM-DD）',
    example: '2026-06-09',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'recordDate 必须是 YYYY-MM-DD 格式的日期字符串',
  })
  @IsNotEmpty()
  recordDate!: string;
}
