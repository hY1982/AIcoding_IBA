import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsArray,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  GENDERS,
  Gender,
  BASKETBALL_POSITIONS,
  BasketballPosition,
} from '@shared/player';

/**
 * 创建球员 DTO
 *
 * 用于在认证注册后补充/完善球员资料，或在管理后台直接创建球员记录。
 * 所有字段均经过 class-validator 校验，确保数据有效性。
 *
 * 与 PlayerRegisterDto 的关系：
 * - PlayerRegisterDto 用于注册接口（含手机号、密码等认证信息）
 * - CreatePlayerDto 仅包含球员属性，用于球员资料管理接口
 */
export class CreatePlayerDto {
  @IsString()
  @IsNotEmpty()
  birthDate!: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  startPlayingDate!: string; // YYYY-MM

  @IsEnum(GENDERS)
  gender!: Gender;

  @IsInt()
  @Min(50)
  @Max(300)
  @Type(() => Number)
  height!: number;

  @IsNumber()
  @IsOptional()
  @Min(20)
  @Max(300)
  @Type(() => Number)
  weight?: number;

  @IsInt()
  @IsOptional()
  @Min(50)
  @Max(300)
  @Type(() => Number)
  wingspan?: number;

  @IsInt()
  @IsOptional()
  @Min(100)
  @Max(400)
  @Type(() => Number)
  standingReach?: number;

  @IsInt()
  @IsOptional()
  @Min(100)
  @Max(500)
  @Type(() => Number)
  jumpingReach?: number;

  /**
   * 司职位置，最多3个，按数组顺序表示优先级（索引0=最高优先级）
   */
  @IsArray()
  @IsEnum(BASKETBALL_POSITIONS, { each: true })
  @IsOptional()
  @ArrayMaxSize(3)
  positions?: BasketballPosition[];

  @IsString()
  @IsOptional()
  @MaxLength(20)
  regionCode?: string;
}
