import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';
import { PHONE_REGEX, PHONE_REGEX_MESSAGE } from './register.dto';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_REGEX, { message: PHONE_REGEX_MESSAGE })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128, { message: '密码长度不能超过128个字符' })
  password!: string;
}
