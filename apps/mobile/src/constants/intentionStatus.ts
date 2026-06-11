import type { IntentionStatus } from '@shared/intention';

export const INTENTION_STATUS_COLORS: Record<IntentionStatus, string> = {
  pending: '#f39c12',
  matched: '#3498db',
  confirmed: '#27ae60',
  cancelled: '#95a5a6',
  expired: '#7f8c8d',
  failed: '#e74c3c',
};
