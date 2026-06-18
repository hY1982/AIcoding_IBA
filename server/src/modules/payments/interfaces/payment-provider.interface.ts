/**
 * Payment Provider Interface
 *
 * Abstracts payment operations to allow seamless switching between
 * different payment providers (mock, WeChat Pay, Alipay, etc.).
 *
 * Design decision: All monetary values are passed as strings to avoid
 * floating-point precision issues. The implementation is responsible
 * for converting to the appropriate numeric type for the underlying API.
 */

export interface PaymentOrderResult {
  orderNo: string;
  amount: string;
  expireAt: Date;
  status: 'pending' | 'paid' | 'closed' | 'failed';
}

export interface PaymentProcessResult {
  success: boolean;
  orderNo: string;
  paidAt?: Date;
  errorMessage?: string;
}

export interface PaymentCallbackResult {
  orderNo: string;
  success: boolean;
  processed: boolean; // true = this invocation actually processed the callback
  message: string;
}

export interface PaymentOrderStatus {
  orderNo: string;
  status: 'pending' | 'paid' | 'closed' | 'failed';
  amount: string;
  createdAt: Date;
  paidAt?: Date;
  closedAt?: Date;
}

export interface CreatePaymentOrderInput {
  matchId: number;
  playerId: number;
  amount: string;
  description?: string;
}

export const PAYMENT_CALLBACK_STATUSES = [
  'success',
  'failed',
  'closed',
] as const;
export type PaymentCallbackStatus = (typeof PAYMENT_CALLBACK_STATUSES)[number];

export interface PaymentCallbackInput {
  orderNo: string;
  status: PaymentCallbackStatus;
  transactionId?: string;
  errorMessage?: string;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProviderInterface {
  /** Create a payment order and return order details */
  createOrder(dto: CreatePaymentOrderInput): Promise<PaymentOrderResult>;

  /** Process payment for an existing order (simulates user confirming payment) */
  processPayment(orderNo: string): Promise<PaymentProcessResult>;

  /** Handle async payment callback from third-party provider */
  handleCallback(dto: PaymentCallbackInput): Promise<PaymentCallbackResult>;

  /** Query order status from payment provider */
  queryOrder(orderNo: string): Promise<PaymentOrderStatus>;

  /** Close an expired or cancelled order */
  closeOrder(orderNo: string): Promise<boolean>;

  /** v2.0: Refund a payment (Saga compensation) */
  refund?(orderNo: string): Promise<boolean>;
}
