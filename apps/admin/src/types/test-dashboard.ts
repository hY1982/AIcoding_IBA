/**
 * 集成测试仪表板专用类型定义
 *
 * 为 TestDashboardPage 及其子组件提供完整的类型支持。
 * 所有状态枚举使用 const 数组 + 联合类型（单一来源模式），
 * 与 shared/types 保持一致的风格。
 */

// ───────────────────────────────────────────────────────────────
// 模块完成状态
// ───────────────────────────────────────────────────────────────

export const MODULE_STATUSES = ['completed', 'in_progress', 'pending'] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export const MODULE_STATUS_LABELS: Record<ModuleStatus, string> = {
  completed: '已完成',
  in_progress: '进行中',
  pending: '待开发',
};

// ───────────────────────────────────────────────────────────────
// 测试场景执行状态
// ───────────────────────────────────────────────────────────────

export const SCENARIO_STATUSES = [
  'testable',
  'blocked',
  'pending_dev',
  'pending_api',
] as const;
export type ScenarioStatus = (typeof SCENARIO_STATUSES)[number];

export const SCENARIO_STATUS_LABELS: Record<ScenarioStatus, string> = {
  testable: '可测试',
  blocked: '阻塞',
  pending_dev: '待开发',
  pending_api: '待接口',
};

// ───────────────────────────────────────────────────────────────
// 风险等级
// ───────────────────────────────────────────────────────────────

export const RISK_LEVELS = ['high', 'medium', 'low'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

// ───────────────────────────────────────────────────────────────
// 测试数据准备步骤
// ───────────────────────────────────────────────────────────────

export interface TestDataStep {
  step: number;
  description: string;
  sqlTemplate?: string;
  sampleData?: Record<string, unknown>;
}

// ───────────────────────────────────────────────────────────────
// 风险项
// ───────────────────────────────────────────────────────────────

export interface RiskItem {
  level: RiskLevel;
  description: string;
  mitigation?: string;
  relatedModuleId?: string;
}

// ───────────────────────────────────────────────────────────────
// 测试场景
// ───────────────────────────────────────────────────────────────

export interface TestScenario {
  id: string;
  name: string;
  module: string;
  moduleId: string;
  status: ScenarioStatus;
  completionStatus: ModuleStatus;
  testData: TestDataStep[];
  executionSteps: string[];
  expectedResult: string;
  acceptanceCriteria: string[];
  risks: RiskItem[];
  relatedEntities: string[];
  notes?: string;
}

// ───────────────────────────────────────────────────────────────
// 模块定义
// ───────────────────────────────────────────────────────────────

export interface ModuleDef {
  id: string;
  name: string;
  phase: number;
  status: ModuleStatus;
  totalScenarios: number;
  testableScenarios: number;
  description: string;
  entityNames: string[];
}

// ───────────────────────────────────────────────────────────────
// 筛选状态
// ───────────────────────────────────────────────────────────────

export interface ScenarioFilters {
  moduleId: string | null;
  status: ScenarioStatus | null;
  keyword: string;
}
