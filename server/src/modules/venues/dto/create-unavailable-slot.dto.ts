import { IsString, IsOptional, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUnavailableSlotDto {
  @ApiProperty({ description: '日期 YYYY-MM-DD' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'slotDate 格式必须为 YYYY-MM-DD' })
  slotDate!: string;

  @ApiProperty({ description: '开始时间 HH:mm（15分钟粒度）' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:(00|15|30|45)$/, { message: 'startTime 分钟数必须是 15 的倍数' })
  startTime!: string;

  @ApiProperty({ description: '结束时间 HH:mm（15分钟粒度）' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:(00|15|30|45)$/, { message: 'endTime 分钟数必须是 15 的倍数' })
  endTime!: string;

  @ApiProperty({ required: false, description: '不可预订原因（如维护、包场）' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateUnavailableSlotsDto {
  @ApiProperty({ description: '不可预订时段列表', type: [CreateUnavailableSlotDto] })
  slots!: CreateUnavailableSlotDto[];
}
