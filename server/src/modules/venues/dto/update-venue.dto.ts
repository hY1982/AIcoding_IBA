import { PartialType } from '@nestjs/mapped-types';
import { CreateVenueDto } from './create-venue.dto';

/**
 * 更新场地 DTO
 *
 * 继承 CreateVenueDto，所有字段变为可选
 */
export class UpdateVenueDto extends PartialType(CreateVenueDto) {}
