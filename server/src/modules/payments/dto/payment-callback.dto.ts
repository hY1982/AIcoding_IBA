import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import {
  PaymentCallbackStatus,
  PAYMENT_CALLBACK_STATUSES,
} from '../interfaces/payment-provider.interface';

/**
 * DTO for payment callback from third-party provider
 */
export class PaymentCallbackDto {
  @IsString()
  @IsNotEmpty()
  orderNo!: string;

  @IsEnum(PAYMENT_CALLBACK_STATUSES)
  status!: PaymentCallbackStatus;

  @IsString()
  @IsOptional()
  transactionId?: string;

  @IsString()
  @IsOptional()
  errorMessage?: string;
}
