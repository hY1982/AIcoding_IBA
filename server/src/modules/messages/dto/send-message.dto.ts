import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
/**
 * 用户消息类型
 *
 * 普通参与者只能发送 text 和 image 类型消息。
 * system 类型由服务端通过 sendSystemMessage 内部方法发送，不对外暴露。
 */
const USER_MESSAGE_TYPES = ['text', 'image'] as const;
type UserMessageType = (typeof USER_MESSAGE_TYPES)[number];

/**
 * 发送消息 DTO
 *
 * 用于客户端提交群聊消息。发送者身份由控制器从 JWT token 解析，
 * 不通过请求体传入，防止用户冒充他人发送消息。
 *
 * 安全设计：
 * - 不包含 senderId 字段
 * - messageType 仅允许 text/image，system 类型被排除
 * - content 限制最大 1000 字符，防止超长消息攻击
 */
export class SendMessageDto {
  @ApiProperty({ description: '消息内容', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content!: string;

  @ApiPropertyOptional({
    description: '消息类型（仅允许 text 或 image）',
    enum: ['text', 'image'],
    default: 'text',
  })
  @IsOptional()
  @IsEnum(USER_MESSAGE_TYPES)
  messageType?: UserMessageType = 'text';
}
