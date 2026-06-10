import { PartialType } from '@nestjs/mapped-types';
import {
  IsInt,
  Min,
  Max,
  IsNumber,
  IsOptional,
  IsEnum,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePlayerDto } from './create-player.dto';
import { BASKETBALL_POSITIONS, BasketballPosition } from '@shared/player';

/**
 * 更新球员 DTO
 *
 * 继承自 CreatePlayerDto，所有字段均为可选（PartialType）。
 * 支持更新 MVP 基础属性以及 P1 扩展属性。
 *
 * 业务规则：
 * - 位置最多3个限制始终生效
 * - 仅当更新影响能力值的字段时，才会触发 baseAbilityScore 重算
 * - matchAdjustValue 不受更新影响
 */
export class UpdatePlayerDto extends PartialType(CreatePlayerDto) {
  /**
   * 司职位置，最多3个，按数组顺序表示优先级
   * 显式重新定义以保留 @ArrayMaxSize(3) 校验
   */
  @IsEnum(BASKETBALL_POSITIONS, { each: true })
  @IsOptional()
  @ArrayMaxSize(3)
  positions?: BasketballPosition[];

  // ===== MVP 基础属性（显式重定义以保留 @Type 装饰器） =====

  /**
   * 站立摸高（cm）
   */
  @IsInt()
  @IsOptional()
  @Min(100)
  @Max(400)
  @Type(() => Number)
  standingReach?: number;

  /**
   * 起跳摸高（cm）
   */
  @IsInt()
  @IsOptional()
  @Min(100)
  @Max(500)
  @Type(() => Number)
  jumpingReach?: number;

  // ===== P1 扩展属性 =====

  /**
   * 卧推重量（kg）
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(500)
  @Type(() => Number)
  benchPress?: number;

  /**
   * 手掌长度（cm）
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  handLength?: number;

  /**
   * 百米成绩（秒）
   */
  @IsNumber()
  @IsOptional()
  @Min(5)
  @Max(30)
  @Type(() => Number)
  sprint100m?: number;

  /**
   * 突破能力等级（0-4）
   */
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(4)
  @Type(() => Number)
  breakthroughLevel?: number;

  /**
   * 传球能力等级（0-4）
   */
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(4)
  @Type(() => Number)
  passingLevel?: number;

  /**
   * 防守能力等级（0-4）
   */
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(4)
  @Type(() => Number)
  defenseLevel?: number;
}
