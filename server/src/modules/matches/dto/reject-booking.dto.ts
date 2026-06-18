import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectBookingDto {
  @ApiProperty({ description: '拒绝原因', maxLength: 500 })
  @IsString()
  @IsNotEmpty({ message: '拒绝原因不能为空' })
  @MaxLength(500, { message: '拒绝原因最多500个字符' })
  rejectionReason!: string;
}
