import { IsString, IsNotEmpty, Matches, MaxLength, ValidateIf } from 'class-validator';
import { PHONE_REGEX, PHONE_REGEX_MESSAGE } from './register.dto';

/**
 * 登录请求 DTO
 *
 * 支持两种登录方式：
 * 1. 手机号登录：符合中国大陆手机号格式
 * 2. 用户名登录：内置管理员账号 "admin"
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @ValidateIf((o) => o.phone !== 'admin')
  @Matches(PHONE_REGEX, { message: PHONE_REGEX_MESSAGE })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128, { message: '密码长度不能超过128个字符' })
  password!: string;
}
