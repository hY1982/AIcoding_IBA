import React from 'react';
import { Tag } from 'antd';
import type { ModuleStatus, ScenarioStatus, RiskLevel } from '@/types/test-dashboard';
import {
  MODULE_STATUS_LABELS,
  SCENARIO_STATUS_LABELS,
  RISK_LEVEL_LABELS,
} from '@/types/test-dashboard';

/**
 * 状态标签组件
 *
 * 统一渲染模块状态、场景状态和风险等级的标签样式。
 * 使用 Ant Design Tag 组件，根据状态类型自动选择颜色和图标。
 */

interface StatusBadgeProps {
  status: ModuleStatus | ScenarioStatus | RiskLevel;
  type?: 'module' | 'scenario' | 'risk';
}

const statusColorMap: Record<string, string> = {
  // 模块状态
  completed: 'success',
  in_progress: 'warning',
  pending: 'default',
  // 场景状态
  testable: 'processing',
  blocked: 'error',
  pending_dev: 'default',
  pending_api: 'default',
  // 风险等级
  high: 'error',
  medium: 'warning',
  low: 'success',
};

const statusIconMap: Record<string, string> = {
  completed: '✅',
  in_progress: '🟡',
  pending: '⚪',
  testable: '🟢',
  blocked: '🔴',
  pending_dev: '⚪',
  pending_api: '⚪',
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

function getLabel(
  status: ModuleStatus | ScenarioStatus | RiskLevel,
  type: string,
): string {
  if (type === 'module') {
    return MODULE_STATUS_LABELS[status as ModuleStatus];
  }
  if (type === 'risk') {
    return RISK_LEVEL_LABELS[status as RiskLevel];
  }
  return SCENARIO_STATUS_LABELS[status as ScenarioStatus];
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'scenario' }) => {
  const color = statusColorMap[status] || 'default';
  const icon = statusIconMap[status] || '';
  const label = getLabel(status, type);

  return (
    <Tag color={color} style={{ fontSize: 13 }}>
      {icon} {label}
    </Tag>
  );
};

export default StatusBadge;
