/**
 * 端到端验收演示页面 — 专用类型定义
 *
 * 为 AcceptanceDemoPage 及其子组件提供完整的类型支持。
 * 所有状态枚举使用 const 数组 + 联合类型（单一来源模式）。
 */

// ───────────────────────────────────────────────────────────────
// 约束类型
// ───────────────────────────────────────────────────────────────

export const CONSTRAINT_TYPES = ['CHECK', 'UNIQUE', 'FK', 'NOT_NULL'] as const;
export type ConstraintType = (typeof CONSTRAINT_TYPES)[number];

export const CONSTRAINT_TYPE_LABELS: Record<ConstraintType, string> = {
  CHECK: 'CHECK',
  UNIQUE: 'UNIQUE',
  FK: 'FOREIGN KEY',
  NOT_NULL: 'NOT NULL',
};

export const CONSTRAINT_TYPE_COLORS: Record<ConstraintType, string> = {
  CHECK: '#ff4d4f',
  UNIQUE: '#faad14',
  FK: '#1890ff',
  NOT_NULL: '#52c41a',
};

// ───────────────────────────────────────────────────────────────
// 字段定义
// ───────────────────────────────────────────────────────────────

export interface FieldDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  special?: string;
  constraints?: ConstraintType[];
}

// ───────────────────────────────────────────────────────────────
// 约束定义
// ───────────────────────────────────────────────────────────────

export interface ConstraintDef {
  type: ConstraintType;
  name: string;
  description: string;
  table: string;
  columns?: string[];
  sql?: string;
}

// ───────────────────────────────────────────────────────────────
// 表结构定义
// ───────────────────────────────────────────────────────────────

export interface TableSchema {
  name: string;
  description: string;
  fields: FieldDef[];
  constraints: ConstraintDef[];
  indexes?: string[];
  specialFeatures?: string[];
}

// ───────────────────────────────────────────────────────────────
// 示例数据
// ───────────────────────────────────────────────────────────────

export interface SampleRecord {
  [key: string]: unknown;
}

// ───────────────────────────────────────────────────────────────
// 状态流转
// ───────────────────────────────────────────────────────────────

export interface StatusTransition {
  from: string;
  to: string[];
}

export interface StatusFlow {
  entity: string;
  field: string;
  states: string[];
  stateLabels: Record<string, string>;
  transitions: StatusTransition[];
}

// ───────────────────────────────────────────────────────────────
// 验收标准
// ───────────────────────────────────────────────────────────────

export const CRITERIA_CATEGORIES = ['business', 'database'] as const;
export type CriteriaCategory = (typeof CRITERIA_CATEGORIES)[number];

export const CRITERIA_CATEGORY_LABELS: Record<CriteriaCategory, string> = {
  business: '业务逻辑验收',
  database: '数据库专业验收',
};

export interface AcceptanceCriterion {
  id: string;
  category: CriteriaCategory;
  description: string;
  checked: boolean;
}

// ───────────────────────────────────────────────────────────────
// 测试分类
// ───────────────────────────────────────────────────────────────

export const TEST_CATEGORIES = ['business_logic', 'database_professional'] as const;
export type TestCategory = (typeof TEST_CATEGORIES)[number];

export const TEST_CATEGORY_LABELS: Record<TestCategory, string> = {
  business_logic: '业务逻辑测试',
  database_professional: '数据库专业测试',
};

export interface TestItem {
  id: string;
  category: TestCategory;
  name: string;
  description: string;
  expectedResult: string;
  relatedTables: string[];
}

// ───────────────────────────────────────────────────────────────
// 流程步骤
// ───────────────────────────────────────────────────────────────

export interface ProcessStep {
  id: string;
  title: string;
  description: string;
  actor: string;
  tables: TableSchema[];
  sampleData: Record<string, SampleRecord[]>;
  statusFlows?: StatusFlow[];
  acceptanceCriteria: AcceptanceCriterion[];
  testItems: TestItem[];
  businessFlow: string[];
}

// ───────────────────────────────────────────────────────────────
// 实体关系
// ───────────────────────────────────────────────────────────────

export interface EntityRelation {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  relationType: 'one-to-one' | 'one-to-many' | 'many-to-many';
  onDelete: string;
}
