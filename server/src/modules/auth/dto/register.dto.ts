import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsNumber,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { USER_TYPES, UserType } from '@shared/common';
export { USER_TYPES };
import {
  GENDERS,
  Gender,
  BASKETBALL_POSITIONS,
  BasketballPosition,
} from '@shared/player';

/**
 * 密码复杂度校验：最小8位，至少包含1个字母和1个数字
 */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_REGEX_MESSAGE =
  '密码必须至少8位，且包含至少1个字母和1个数字';

/**
 * 手机号格式校验（中国大陆手机号）
 */
export const PHONE_REGEX = /^1[3-9]\d{9}$/;
export const PHONE_REGEX_MESSAGE = '请输入有效的11位手机号码';

class BaseRegisterDto {
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_REGEX, { message: PHONE_REGEX_MESSAGE })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(64)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MESSAGE })
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  nickname!: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  regionCode?: string;

  @IsEnum(USER_TYPES)
  @IsNotEmpty()
  userType!: UserType;
}

export class PlayerRegisterDto extends BaseRegisterDto {
  @IsEnum(USER_TYPES)
  userType: UserType = 'player';

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

  @IsEnum(BASKETBALL_POSITIONS, { each: true })
  @IsOptional()
  @ArrayMaxSize(3)
  positions?: BasketballPosition[];
}

export class VenueManagerRegisterDto extends BaseRegisterDto {
  @IsEnum(USER_TYPES)
  userType: UserType = 'venue_manager';

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  contactName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(PHONE_REGEX, { message: PHONE_REGEX_MESSAGE })
  contactPhone!: string;
}

/**
 * 统一注册请求 DTO（用于控制器接收和 ValidationPipe 验证）
 *
 * 合并 Player 和 VenueManager 的所有字段，通过 userType 区分必填字段。
 * 球员注册时：age, basketballAge, gender, height 必填
 * 场地方注册时：companyName, contactName, contactPhone 必填
 */
export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_REGEX, { message: PHONE_REGEX_MESSAGE })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(64)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MESSAGE })
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  nickname!: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  regionCode?: string;

  @IsEnum(USER_TYPES)
  @IsNotEmpty()
  userType!: UserType;

  // Player fields (optional at validation level, checked in service)
  @IsString()
  @IsOptional()
  birthDate?: string; // YYYY-MM-DD

  @IsString()
  @IsOptional()
  startPlayingDate?: string; // YYYY-MM

  @IsEnum(GENDERS)
  @IsOptional()
  gender?: Gender;

  @IsInt()
  @Min(50)
  @Max(300)
  @Type(() => Number)
  @IsOptional()
  height?: number;

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

  @IsEnum(BASKETBALL_POSITIONS, { each: true })
  @IsOptional()
  @ArrayMaxSize(3)
  positions?: BasketballPosition[];

  // VenueManager fields (optional at validation level, checked in service)
  @IsString()
  @IsOptional()
  @MaxLength(100)
  companyName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  contactName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  @Matches(PHONE_REGEX, { message: PHONE_REGEX_MESSAGE })
  contactPhone?: string;
}
