import { IsString, IsNotEmpty, Matches } from 'class-validator';

/**
 * 创建单个时段 DTO
 */
export class CreateTimeSlotDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式必须为 YYYY-MM-DD' })
  slotDate!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, {
    message: '时间格式必须为 HH:mm 或 HH:mm:ss',
  })
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, {
    message: '时间格式必须为 HH:mm 或 HH:mm:ss',
  })
  endTime!: string;
}
