import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

/**
 * DTO for creating a payment order
 */
export class CreatePaymentOrderDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  matchId!: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  playerId!: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: '金额格式不正确，应为最多两位小数的数字字符串',
  })
  amount!: string; // decimal string, e.g., "50.00"

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
