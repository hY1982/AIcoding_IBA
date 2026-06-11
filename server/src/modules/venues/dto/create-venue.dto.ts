import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  FLOOR_MATERIALS,
  FloorMaterial,
  COURT_TYPES,
  CourtType,
} from '@shared/venue';

/**
 * 创建场地 DTO
 *
 * MVP 必填字段：name, address, pricePerHour
 * 其他字段均为可选，提供默认值
 */
export class CreateVenueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address!: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  pricePerHour!: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  courtCount?: number;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude?: number;

  @IsEnum(FLOOR_MATERIALS)
  @IsOptional()
  floorMaterial?: FloorMaterial;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  lighting?: string;

  @IsEnum(COURT_TYPES)
  @IsOptional()
  courtType?: CourtType;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  ventilation?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  bigFan?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  airCondition?: boolean;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  turnoverTime?: number;

  @IsString()
  @IsOptional()
  openTime?: string;

  @IsString()
  @IsOptional()
  closeTime?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  parking?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  restroom?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  shower?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  lockerRoom?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  videoRecord?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  regionCode?: string;
}
