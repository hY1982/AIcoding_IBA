// v2.0 新增：Saga 支付补偿相关类型

/**
 * 支付订单状态
 */
export const PAYMENT_ORDER_STATUSES = [
  'pending',    // 待支付
  'paid',       // 已支付
  'refunded',   // 已退款
  'failed',     // 支付失败
  'closed',     // 已关闭（超时未支付）
] as const;
export type PaymentOrderStatus = (typeof PAYMENT_ORDER_STATUSES)[number];

/**
 * 支付订单（API 响应契约）
 */
export interface PaymentOrder {
  orderNo: string;
  matchId: number;
  playerId: number;
  amount: string; // decimal 作为 string 传输
  status: PaymentOrderStatus;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
}

/**
 * Saga 补偿请求
 */
export interface SagaCompensationRequest {
  orderNo: string;
  reason: string; // 补偿原因（如 'transaction_failed', 'venue_rejected'）
  amount: string;
  matchId: number;
  playerId: number;
}

/**
 * Saga 补偿结果
 */
export interface SagaCompensationResult {
  orderNo: string;
  refundOrderNo: string | null;
  success: boolean;
  errorMessage: string | null;
  compensatedAt: string;
}
