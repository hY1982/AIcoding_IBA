import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MockOrder } from './entities/mock-order.entity';
import { MockPaymentService } from './services/mock-payment.service';
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';

/**
 * Payments Module
 *
 * Provides payment abstraction through PaymentProviderInterface.
 * Currently uses MockPaymentService for MVP simulation.
 *
 * To switch to a real payment provider (WeChat/Alipay):
 * 1. Implement PaymentProviderInterface in a new service
 * 2. Replace `useClass: MockPaymentService` with the new service
 */
@Module({
  imports: [TypeOrmModule.forFeature([MockOrder])],
  providers: [
    MockPaymentService,
    {
      provide: PAYMENT_PROVIDER,
      useClass: MockPaymentService,
    },
  ],
  exports: [PAYMENT_PROVIDER, MockPaymentService],
})
export class PaymentsModule {}
