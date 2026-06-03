import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { PHONE_REGEX, PHONE_REGEX_MESSAGE } from './register.dto';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_REGEX, { message: PHONE_REGEX_MESSAGE })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
