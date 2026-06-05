import { IsString, IsNotEmpty, Matches, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PHONE_REGEX, PHONE_REGEX_MESSAGE } from './register.dto';

/**
 * 短信验证码使用场景
 */
export const SMS_CODE_SCENES = ['register', 'login', 'reset_password'] as const;
export type SmsCodeScene = (typeof SMS_CODE_SCENES)[number];

/**
 * 发送短信验证码请求 DTO
 *
 * MVP 阶段为模拟实现，但 DTO 设计面向未来真实短信服务扩展。
 */
export class SendSmsCodeDto {
  @ApiProperty({
    description: '手机号',
    example: '13800138000',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_REGEX, { message: PHONE_REGEX_MESSAGE })
  phone!: string;

  @ApiPropertyOptional({
    description: '使用场景',
    enum: SMS_CODE_SCENES,
    example: 'register',
  })
  @IsOptional()
  @IsEnum(SMS_CODE_SCENES)
  scene?: SmsCodeScene;
}
