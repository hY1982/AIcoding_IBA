import { PartialType } from '@nestjs/mapped-types';
import { CreateIntentionDto } from './create-intention.dto';

/**
 * 更新比赛意向 DTO
 *
 * 继承 CreateIntentionDto，所有字段变为可选。
 * 仅 pending 状态的意向可被修改。
 * 修改后需重新满足提前 1 小时规则。
 */
export class UpdateIntentionDto extends PartialType(CreateIntentionDto) {}
