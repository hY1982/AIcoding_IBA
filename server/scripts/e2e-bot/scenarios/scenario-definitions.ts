/**
 * E2E Bot 测试 — 5 个场景定义
 *
 * 每个场景定义 bot 数量、赛制、时间参数和预期结果。
 */

import { BotGenerationConfig } from '../bot-profiles';

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  bots: BotGenerationConfig;
  format: '3v3' | '5v5' | 'mixed';
  startTimeHoursAhead: number;
  durationMinutes: number;
  acceptableWaitMinutes?: number;  // 意向过期时间，默认 30 分钟
  includeStress: boolean;
  includeEdgeCases: boolean;
  expectedMatches: { min: number; max: number };
}

export const SCENARIOS: Record<string, ScenarioDefinition> = {
  smooth3v3: {
    id: 'smooth3v3',
    name: '3v3 顺利匹配全流程',
    description: '6 个 bot 球员 + 真人，刚好组成 1 场 3v3 的 2 队。全流程跑通：注册→场地→意向→匹配→确认→消息→反馈',
    bots: { playerCount: 6, venueManagerCount: 2 },
    format: '3v3',
    startTimeHoursAhead: 2,
    durationMinutes: 120,
    includeStress: false,
    includeEdgeCases: true,
    expectedMatches: { min: 1, max: 2 },
  },

  shortage5v5: {
    id: 'shortage5v5',
    name: '5v5 人数不足',
    description: '7 个 bot 球员 + 真人（不足 5v5×2 队=10 人）。测试匹配后确认不足→比赛失败→保证金退回流程',
    bots: { playerCount: 7, venueManagerCount: 2 },
    format: '5v5',
    startTimeHoursAhead: 3,
    durationMinutes: 180,
    includeStress: false,
    includeEdgeCases: false,
    expectedMatches: { min: 1, max: 1 },
  },

  peakHour: {
    id: 'peakHour',
    name: '高峰期多场地并发',
    description: '30 个 bot 球员 + 5 个场地方，多时段多场比赛。验证并发确认和时段预订',
    bots: { playerCount: 30, venueManagerCount: 5 },
    format: '3v3',
    startTimeHoursAhead: 2,
    durationMinutes: 120,
    includeStress: false,
    includeEdgeCases: true,
    expectedMatches: { min: 3, max: 6 },
  },

  fullStress: {
    id: 'fullStress',
    name: '50 账号全量压力测试',
    description: '全部 39 个 bot 球员 + 10 个场地方 + 真人。全量流程 + 压力测试（并发注册/突发意向/快速消息）',
    bots: { playerCount: 39, venueManagerCount: 10 },
    format: 'mixed',
    startTimeHoursAhead: 2,
    durationMinutes: 120,
    includeStress: true,
    includeEdgeCases: true,
    expectedMatches: { min: 3, max: 10 },
  },

  humanDriven: {
    id: 'humanDriven',
    name: '真人驱动 E2E 测试',
    description: '5 个 Bot 后台准备意向 + 真人通过 Mobile App 注册/录入意向/确认比赛。最接近真实使用场景的测试流程',
    bots: { playerCount: 5, venueManagerCount: 1 },
    format: '3v3',
    startTimeHoursAhead: 3,
    durationMinutes: 120,
    acceptableWaitMinutes: 120,  // 真人操作需要较长时间，意向 2 小时后才过期
    includeStress: false,
    includeEdgeCases: false,
    expectedMatches: { min: 1, max: 2 },
  },

  edgeCases: {
    id: 'edgeCases',
    name: '边界与异常场景专项',
    description: '10 个 bot 球员 + 3 个场地方，专注边界测试：重复注册、错误密码、时间重叠、越界数据、非授权操作、并发冲突',
    bots: { playerCount: 10, venueManagerCount: 3 },
    format: '3v3',
    startTimeHoursAhead: 2,
    durationMinutes: 120,
    includeStress: false,
    includeEdgeCases: true,
    expectedMatches: { min: 0, max: 2 },
  },

  humanDrivenStress: {
    id: 'humanDrivenStress',
    name: '200 人大规模压力测试',
    description: '200 bot 球员 + 1 场地经理(2 场地)。随机意向(今天 8:00-20:00)、自动匹配、终端表格展示',
    bots: { playerCount: 200, venueManagerCount: 1 },
    format: 'mixed',
    startTimeHoursAhead: 0,   // 场景内部随机生成，不使用此值
    durationMinutes: 120,      // 默认值，实际由随机覆盖
    includeStress: true,
    includeEdgeCases: false,
    expectedMatches: { min: 5, max: 30 },
  },
};

export function getScenario(id: string): ScenarioDefinition {
  const scenario = SCENARIOS[id];
  if (!scenario) {
    const available = Object.keys(SCENARIOS).join(', ');
    throw new Error(`未知场景 "${id}"，可用场景: ${available}`);
  }
  return scenario;
}

export function listScenarios(): void {
  console.log('\n可用测试场景:\n');
  for (const [id, def] of Object.entries(SCENARIOS)) {
    const botTotal = def.bots.playerCount + def.bots.venueManagerCount;
    console.log(`  ${id.padEnd(15)} ${def.name}`);
    console.log(`  ${' '.repeat(15)} ${def.description}`);
    console.log(`  ${' '.repeat(15)} Bot: ${def.bots.playerCount} 球员 + ${def.bots.venueManagerCount} 场地方 = ${botTotal} 总计`);
    console.log('');
  }
}
