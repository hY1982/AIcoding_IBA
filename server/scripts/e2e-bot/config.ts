/**
 * E2E Bot 测试 — 全局配置常量
 */

// HTTP API 基址（对应后端 npm run start:dev）
export const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:3000/api/v1';

// Bot 账号配置
export const BOT_PASSWORD = 'BotTest123!';
export const HUMAN_PHONE = '13900000000';
export const HUMAN_PASSWORD = 'HumanTest123!';
export const HUMAN_NICKNAME = '真人测试员';

// 默认地区（所有 bot 统一，确保匹配引擎能匹配）
export const DEFAULT_REGION = 'shenzhen_futian';

// 并发控制
export const BATCH_SIZE_REGISTRATION = 10;
export const BATCH_SIZE_INTENTION = 10;
export const BATCH_SIZE_MESSAGE = 5;
export const BATCH_SIZE_FEEDBACK = 5;
export const BATCH_DELAY_MS = 100;

// 超时保护
export const SCENARIO_TIMEOUT_MS = 60_000;
export const STRESS_TIMEOUT_MS = 120_000;
export const HUMAN_WAIT_TIMEOUT_MS = 180_000; // 真人操作等待 3 分钟

// 报告输出路径
export const REPORT_OUTPUT_DIR = 'scripts';

// DB 清理的表列表（顺序很重要，子表先清）
export const DB_TABLES_TO_TRUNCATE = [
  'feedback_player_ratings',
  'feedbacks',
  'adjust_update_failures',
  'match_messages',
  'match_teams',
  'match_players',
  'mock_orders',
  'matches',
  'intention_venues',
  'intention_formats',
  'intentions',
  'notifications',
  'venue_unavailable_slots',
  'venue_time_slots',
  'venues',
  'player_shooting_records',
  'player_positions',
  'players',
  'venue_managers',
  'system_params',
  'formats',
  'users',
];
