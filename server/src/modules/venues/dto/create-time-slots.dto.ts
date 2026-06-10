import { Type } from 'class-transformer';
import { ValidateNested, ArrayMinSize, IsArray } from 'class-validator';
import { CreateTimeSlotDto } from './create-time-slot.dto';

/**
 * 创建场地时段列表 DTO
 *
 * 包装 CreateTimeSlotDto 数组，支持 ValidationPipe 对数组元素的嵌套校验。
 */
export class CreateTimeSlotsDto {
  @IsArray()
  @ArrayMinSize(1, { message: '时段列表不能为空' })
  @ValidateNested({ each: true })
  @Type(() => CreateTimeSlotDto)
  slots!: CreateTimeSlotDto[];
}
