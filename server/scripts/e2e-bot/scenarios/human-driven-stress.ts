/**
 * =============================================================================
 * Human-Driven Stress Test v2.0 — 2000 人大规模动态压力测试场景
 * =============================================================================
 *
 * 2000 个 bot 球员 + 1 场地经理(2 场地)，40 分钟内随机时间点提交意向，
 * 每 5 分钟自动触发匹配，支持多选意向、场地管理员确认、群聊测试。
 * 全自动化执行，无需人工干预，总时长 40 分钟。
 *
 * 用法:
 *   npm run e2e:bot -- --scenario=humanDrivenStress
 *   npm run e2e:bot -- --scenario=humanDrivenStress --auto
 */

import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { ApiClient, CreateIntentionPayload, PlayerRegisterPayload, VenueManagerRegisterPayload } from '../api-client';
import { BotContext, createEmptyBotContext } from '../helpers/bot-context';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { InteractivePrompt } from '../interactive';
import { DbTools } from '../helpers/db-tools';
import { ScenarioDefinition } from './scenario-definitions';
import { runPlayerProfilePhase } from './phase-03-player-profile';
import { runIntegrityPhase } from './phase-11-integrity';
import { runBatch, safeBotRun, sleep } from '../helpers/safe-runner';
import { TableColumn, printTable } from '../helpers/table-formatter';
import { generateBots } from '../bot-profiles';
import {
  DEFAULT_REGION, STRESS_BATCH_SIZE, STRESS_BATCH_DELAY_MS,
  BOT_PASSWORD, HUMAN_PHONE, HUMAN_PASSWORD, HUMAN_NICKNAME,
  REPORT_OUTPUT_DIR,
  TEST_DURATION_MS, MATCHING_INTERVAL_MS,
  MULTI_SELECT_RATE_MIN, MULTI_SELECT_RATE_MAX,
  INTENTION_SUBMISSION_WINDOW_MS,
} from '../config';

// --- 颜色 ---
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// --- 类型 ---
interface StressVenueInfo {
  venueId: number;
  venueName: string;
  timeSlotIds: number[];
}

interface IntentionSubmission {
  bot: BotContext;
  params: CreateIntentionPayload;
  scheduledMs: number;
  isMultiSelect: boolean;
}

interface MatchingRecord {
  timestamp: string;
  intentionsScanned: number;
  matchesCreated: number;
  matchesFailed: number;
  expiredCount: number;
  durationMs: number;
}

// --- 工具函数 ---
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TZ_OPTS = { timeZone: 'Asia/Shanghai' as const };

function formatLocalTime(d: Date): string {
  return d.toLocaleString('zh-CN', { ...TZ_OPTS, hour12: false });
}

function formatShanghaiTime(d: Date): string {
  return d.toLocaleString('zh-CN', { ...TZ_OPTS, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 获取当前上海时间的 Date 对象（内部 UTC 偏移 +8h，需用 getUTC* 读取） */
function getShanghaiNow(): Date {
  return new Date(Date.now() + SHANGHAI_OFFSET_MS);
}

/** 获取上海时区的日期字符串 YYYY-MM-DD */
function getShanghaiDateStr(): string {
  return getShanghaiNow().toISOString().split('T')[0];
}

/** 创建上海时区特定时刻的 Date 对象（返回正确的 UTC 时间戳） */
function createShanghaiDate(y: number, mo: number, d: number, h: number, mi: number, s: number): Date {
  return new Date(Date.UTC(y, mo, d, h, mi, s) - SHANGHAI_OFFSET_MS);
}

/** 将 Date 转换为上海时区的 ISO 字符串（用于提交给后端） */
function toShanghaiISOString(d: Date): string {
  return new Date(d.getTime() + SHANGHAI_OFFSET_MS).toISOString();
}

/** 获取上海时区当前时间戳 */
function getShanghaiTimestamp(): number {
  return Date.now() + SHANGHAI_OFFSET_MS;
}

// =============================================================================
// 多选意向生成
// =============================================================================

/**
 * 生成随机意向参数（支持多选场地/赛制，比例 30-50%）
 */
function generateRandomIntention(
  earliestMs: number,
  latestMs: number,
  venues: StressVenueInfo[],
  formats: Array<{ id: number; name: string; team_size: number }>,
): { payload: CreateIntentionPayload; isMultiSelect: boolean } {
  // startTime: 在合法范围内，30 分钟增量
  const slotCount = Math.floor((latestMs - earliestMs) / (30 * 60 * 1000));
  const slotIndex = randomInt(0, Math.max(0, slotCount));
  const startMs = earliestMs + slotIndex * 30 * 60 * 1000;
  const startTime = new Date(startMs).toISOString();

  // durationMinutes: 120/180/240/300/360
  const durations = [120, 180, 240, 300, 360];
  const durationMinutes = randomElement(durations);

  // acceptableWaitMinutes: 15-120, 15 分钟增量
  const waitOptions = [15, 30, 45, 60, 75, 90, 105, 120];
  const acceptableWaitMinutes = randomElement(waitOptions);

  // 多选比例: 30-50%
  const multiSelectRate = MULTI_SELECT_RATE_MIN + Math.random() * (MULTI_SELECT_RATE_MAX - MULTI_SELECT_RATE_MIN);
  const isMultiSelect = Math.random() < multiSelectRate;

  // venueIds: 多选时选 2 个，单选时选 1 个
  const venueIds: Array<{ venueId: number; priority: number }> = [];
  const shuffledVenues = [...venues].sort(() => Math.random() - 0.5);
  const venueCount = isMultiSelect ? Math.min(2, venues.length) : 1;
  for (let i = 0; i < venueCount; i++) {
    venueIds.push({ venueId: shuffledVenues[i].venueId, priority: i + 1 });
  }

  // formatIds: 多选时选 2 个，单选时选 1 个（优先 3v3）
  const formatIds: Array<{ formatId: number; priority: number }> = [];
  const fmtCount = isMultiSelect ? Math.min(2, formats.length) : 1;
  const sortedFormats = [...formats].sort((a, b) => {
    if (a.team_size === 3) return -1;
    if (b.team_size === 3) return 1;
    return Math.random() - 0.5;
  });
  for (let i = 0; i < fmtCount; i++) {
    formatIds.push({ formatId: sortedFormats[i].id, priority: i + 1 });
  }

  return {
    payload: { startTime, durationMinutes, acceptableWaitMinutes, venueIds, formatIds },
    isMultiSelect,
  };
}

// =============================================================================
// 测试编排器（管理 40 分钟生命周期）
// =============================================================================

class TestOrchestrator {
  private startTime: number = 0;
  private testDurationMs: number;

  constructor(testDurationMs: number = TEST_DURATION_MS) {
    this.testDurationMs = testDurationMs;
  }

  start(): void {
    this.startTime = Date.now();
  }

  isExpired(): boolean {
    return Date.now() - this.startTime >= this.testDurationMs;
  }

  remainingMs(): number {
    return Math.max(0, this.testDurationMs - (Date.now() - this.startTime));
  }

  elapsedMs(): number {
    return Date.now() - this.startTime;
  }

  getProgressPercent(): number {
    return Math.min(100, (this.elapsedMs() / this.testDurationMs) * 100);
  }
}

// =============================================================================
// 匹配监控器（每 5 分钟自动触发）
// =============================================================================

class MatchingMonitor {
  private records: MatchingRecord[] = [];
  private intervalId?: NodeJS.Timeout;

  constructor(
    private appContext: any,
    private dbTools: DbTools,
    private metrics: MetricsCollector,
    private report: ReportGenerator,
    private intervalMs: number = MATCHING_INTERVAL_MS,
  ) {}

  async start(regionCode: string, totalDurationMs: number): Promise<void> {
    // 立即执行第一次
    await this.executeMatching(regionCode);

    const startTime = Date.now();
    let executionCount = 1;

    // 使用循环而非 setInterval，确保每次执行完成后再等待
    while (Date.now() - startTime < totalDurationMs) {
      const nextExecutionTime = startTime + executionCount * this.intervalMs;
      const waitMs = nextExecutionTime - Date.now();

      if (waitMs > 0) {
        await sleep(waitMs);
      }

      // 检查是否已超时
      if (Date.now() - startTime >= totalDurationMs) break;

      await this.executeMatching(regionCode);
      executionCount++;
    }
  }

  stop(): void {
    // 循环模式不需要显式 stop，但保留接口兼容性
  }

  private async executeMatching(regionCode: string): Promise<void> {
    const matchStart = performance.now();
    const shanghaiTime = formatShanghaiTime(new Date());

    try {
      const matchResult = await this.dbTools.triggerMatching(this.appContext, regionCode);
      const durationMs = Math.round(performance.now() - matchStart);

      const scanned = matchResult?.intentionsScanned ?? 0;
      const created = matchResult?.matchesCreated ?? 0;
      const failed = matchResult?.matchesFailed ?? 0;
      const expired = matchResult?.expiredCount ?? 0;

      this.metrics.record('匹配引擎', 'success', durationMs);

      const record: MatchingRecord = {
        timestamp: shanghaiTime,
        intentionsScanned: scanned,
        matchesCreated: created,
        matchesFailed: failed,
        expiredCount: expired,
        durationMs,
      };
      this.records.push(record);
      this.report.recordMatchingFrequency(record);

      console.log(`  ${GREEN}✅ [${shanghaiTime}] 匹配引擎执行: 扫描=${scanned}, 创建=${created}, 失败=${failed}, 过期=${expired}, 耗时=${durationMs}ms${RESET}`);
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - matchStart);
      this.metrics.record('匹配引擎', 'error', durationMs, err.message);
      this.report.addFailure('匹配引擎执行', err.message, durationMs);
      console.log(`  ${RED}❌ [${shanghaiTime}] 匹配引擎失败: ${err.message}${RESET}`);
    }
  }

  getRecords(): MatchingRecord[] {
    return this.records;
  }

  getSummary(): { totalExecutions: number; totalMatchesCreated: number; totalExpired: number; avgDurationMs: number } {
    if (this.records.length === 0) {
      return { totalExecutions: 0, totalMatchesCreated: 0, totalExpired: 0, avgDurationMs: 0 };
    }
    const totalMatchesCreated = this.records.reduce((sum, r) => sum + r.matchesCreated, 0);
    const totalExpired = this.records.reduce((sum, r) => sum + r.expiredCount, 0);
    const avgDurationMs = Math.round(this.records.reduce((sum, r) => sum + r.durationMs, 0) / this.records.length);
    return { totalExecutions: this.records.length, totalMatchesCreated, totalExpired, avgDurationMs };
  }
}

// =============================================================================
// 动态意向提交调度器
// =============================================================================

class IntentionScheduler {
  private submissions: IntentionSubmission[] = [];

  constructor(
    private apiClient: ApiClient,
    private metrics: MetricsCollector,
    private report: ReportGenerator,
    private windowMs: number = INTENTION_SUBMISSION_WINDOW_MS,
  ) {}

  /**
   * 为每个 bot 生成随机提交计划
   */
  scheduleSubmissions(
    players: BotContext[],
    venues: StressVenueInfo[],
    formats: Array<{ id: number; name: string; team_size: number }>,
  ): IntentionSubmission[] {
    const eligiblePlayers = players.filter((b) => b.playerId && b.accessToken);
    const nowMs = Date.now();

    // 意向时间范围: 提交完成后的 now + 1h15m ~ now + 8h
    // 预留 45min 提交时间 + 40min 等待窗口 + 缓冲，确保意向不会过早过期
    const bufferMs = 45 * 60 * 1000; // 45min buffer for submission overhead
    const earliestMs = nowMs + bufferMs + 75 * 60 * 1000; // now + 45min + 1h15m = now + 2h
    const latestMs = nowMs + bufferMs + 8 * 60 * 60 * 1000;  // now + 45min + 8h

    this.submissions = eligiblePlayers.map((bot) => {
      const { payload, isMultiSelect } = generateRandomIntention(earliestMs, latestMs, venues, formats);
      // 随机提交时间: 0 ~ windowMs
      const scheduledMs = nowMs + Math.floor(Math.random() * this.windowMs);
      return { bot, params: payload, scheduledMs, isMultiSelect };
    });

    // 按 scheduledMs 排序
    this.submissions.sort((a, b) => a.scheduledMs - b.scheduledMs);

    return this.submissions;
  }

  /**
   * 执行所有提交的意向（非阻塞式并发）
   */
  async executeSubmissions(): Promise<{
    total: number;
    success: number;
    failed: number;
    multiSelectCount: number;
    singleSelectCount: number;
  }> {
    let total = 0;
    let success = 0;
    let failed = 0;
    let multiSelectCount = 0;
    let singleSelectCount = 0;

    const nowMs = Date.now();

    for (const sub of this.submissions) {
      const waitMs = sub.scheduledMs - nowMs;
      if (waitMs > 0) {
        await sleep(waitMs);
      }

      total++;
      if (sub.isMultiSelect) multiSelectCount++;
      else singleSelectCount++;

      const api = this.apiClient.clone();
      api.setTokens(sub.bot.accessToken!, sub.bot.refreshToken!);

      const result = await safeBotRun(sub.bot, '意向', `提交-${sub.bot.nickname}`, async () => {
        const intention = await api.createIntention(sub.params);
        sub.bot.intentionId = intention?.id;
        sub.bot.intentionStartTime = sub.params.startTime;
        return intention;
      }, this.metrics);

      if (result.success) {
        success++;
        if (total % 100 === 0 || total === this.submissions.length) {
          this.report.addSuccess('意向提交', `${sub.bot.nickname} id=${sub.bot.intentionId} start=${new Date(sub.params.startTime).toLocaleTimeString('zh-CN', TZ_OPTS)} dur=${sub.params.durationMinutes}min multi=${sub.isMultiSelect}`, result.durationMs);
        }
      } else {
        failed++;
        const errMsg = result.error?.message || '未知错误';
        if (total % 50 === 0 || total === this.submissions.length) {
          console.log(`  ${RED}❌ 意向失败 | ${sub.bot.nickname} | ${errMsg}${RESET}`);
        }
        this.report.addFailure('意向提交', `${sub.bot.nickname} ${errMsg}`, result.durationMs);
      }
    }

    return { total, success, failed, multiSelectCount, singleSelectCount };
  }

  getSubmissions(): IntentionSubmission[] {
    return this.submissions;
  }
}

// =============================================================================
// 主函数
// =============================================================================

export async function runHumanDrivenStressScenario(
  appContext: any,
  dataSource: DataSource,
  scenario: ScenarioDefinition,
  autoMode: boolean,
): Promise<void> {
  const orchestrator = new TestOrchestrator(TEST_DURATION_MS);
  const metrics = new MetricsCollector();
  const report = new ReportGenerator();
  const interactive = new InteractivePrompt(autoMode);
  const dbTools = new DbTools(dataSource);
  const apiClient = new ApiClient('http://localhost:3000/api/v1', metrics);

  const testStartTime = formatShanghaiTime(new Date());
  console.log(`\n${CYAN}${BOLD}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${CYAN}${BOLD}  动态压力测试启动${RESET}`);
  console.log(`${CYAN}${BOLD}  开始时间: ${testStartTime}${RESET}`);
  console.log(`${CYAN}${BOLD}  总时长: ${TEST_DURATION_MS / 60000} 分钟${RESET}`);
  console.log(`${CYAN}${BOLD}  匹配间隔: ${MATCHING_INTERVAL_MS / 60000} 分钟${RESET}`);
  console.log(`${CYAN}${BOLD}═══════════════════════════════════════════════════════════════${RESET}\n`);

  try {
    // ═══════════════════════════════════════════════════════════
    // Phase 0: 基础设施初始化
    // ═══════════════════════════════════════════════════════════
    report.startPhase('Phase 0: 基础设施初始化');

    report.printInfo('步骤 0.1', '检查后端服务');
    const { checkServerHealth } = require('../api-client');
    const healthy = await checkServerHealth();
    if (!healthy) {
      report.addFailure('HTTP 健康检查', '无法连接后端服务 localhost:3000');
      throw new Error('后端服务不可达，请先启动 npm run start:dev');
    }
    report.addSuccess('HTTP 健康检查', '后端服务可达');

    report.printInfo('步骤 0.2', '检查数据库连接');
    const dbOk = await dbTools.checkConnection();
    if (!dbOk) throw new Error('数据库连接失败');
    report.addSuccess('DB 连接', '数据库连接成功');

    report.printInfo('步骤 0.3', '清理历史数据');
    await dbTools.truncateAll();
    report.addSuccess('数据清理', '全部业务表已清空');

    report.printInfo('步骤 0.4', '写入种子数据');
    await dbTools.seedSystemParams();
    await dbTools.seedFormats();
    const formats = await dbTools.getFormats();
    report.addSuccess('种子数据', `${formats.length} 个赛制已写入`);

    report.printInfo('步骤 0.5', `生成 ${scenario.bots.playerCount} 个 Bot 档案`);
    const { players, venueManagers, human } = generateBots(scenario.bots);
    report.addSuccess('Bot 档案', `${players.length} 球员 + ${venueManagers.length} 场地经理`);

    report.endPhase();

    // ═══════════════════════════════════════════════════════════
    // Phase 1: 批量注册
    // ═══════════════════════════════════════════════════════════
    report.startPhase('Phase 1: 批量注册');

    // 1.1 场地经理注册
    report.printInfo('步骤 1.1', `注册 ${venueManagers.length} 个场地经理`);

    for (const bot of venueManagers) {
      const payload: VenueManagerRegisterPayload = {
        phone: bot.phone,
        password: bot.password,
        nickname: bot.nickname,
        userType: 'venue_manager',
        companyName: bot.companyName!,
        contactName: bot.contactName!,
        contactPhone: bot.contactPhone!,
        regionCode: DEFAULT_REGION,
      };

      const result = await safeBotRun(bot, '注册', `VM-${bot.nickname}`, async () => {
        await apiClient.clone().register(payload);
        const api = apiClient.clone();
        await api.login({ phone: bot.phone, password: bot.password });
        bot.accessToken = api.getAccessToken();
        bot.refreshToken = api.getRefreshToken();
        const profile = await api.getVenueManagerProfile();
        bot.venueManagerId = Number(profile?.id);
        return profile;
      }, metrics);

      if (result.success) {
        report.addSuccess('VM 注册', `${bot.nickname} vmId=${bot.venueManagerId}`, result.durationMs);
      }
    }

    // 1.2 批量注册球员
    report.printInfo('步骤 1.2', `注册 ${players.length} 个球员 (batch=${STRESS_BATCH_SIZE})`);

    await runBatch(
      players,
      STRESS_BATCH_SIZE,
      async (bot) => {
        const payload: PlayerRegisterPayload = {
          phone: bot.phone,
          password: bot.password,
          nickname: bot.nickname,
          userType: 'player',
          birthDate: bot.birthDate!,
          startPlayingDate: bot.startPlayingDate!,
          gender: bot.gender!,
          height: bot.height!,
          weight: bot.weight,
          wingspan: bot.wingspan,
          standingReach: bot.standingReach,
          jumpingReach: bot.jumpingReach,
          positions: bot.positions as any,
          regionCode: DEFAULT_REGION,
        };

        const result = await safeBotRun(bot, '注册', `P-${bot.nickname}`, async () => {
          const api = apiClient.clone();
          await api.register(payload);
          await api.login({ phone: bot.phone, password: bot.password });
          bot.accessToken = api.getAccessToken();
          bot.refreshToken = api.getRefreshToken();
          const profile = await api.getPlayerProfile();
          bot.userId = Number(profile?.userId ?? profile?.id);
          bot.playerId = Number(profile?.id);
          bot.baseAbilityScore = profile?.baseAbilityScore;
          return profile;
        }, metrics);

        if (result.success) {
          report.addSuccess('球员注册', `${bot.nickname} playerId=${bot.playerId} ability=${bot.baseAbilityScore?.toFixed(1)}`, result.durationMs);
        }
      },
      STRESS_BATCH_DELAY_MS,
    );

    // 1.3 真人注册（可选）
    if (!autoMode) {
      report.printInfo('步骤 1.3', '注册真人账户');
      const humanResult = await safeBotRun(human, '注册', '真人', async () => {
        const api = apiClient.clone();
        const hPayload: PlayerRegisterPayload = {
          phone: human.phone, password: human.password, nickname: human.nickname,
          userType: 'player', birthDate: human.birthDate!, startPlayingDate: human.startPlayingDate!,
          gender: human.gender!, height: human.height!, weight: human.weight,
          wingspan: human.wingspan, standingReach: human.standingReach,
          jumpingReach: human.jumpingReach, positions: human.positions as any,
          regionCode: DEFAULT_REGION,
        };
        await api.register(hPayload);
        await api.login({ phone: human.phone, password: human.password });
        human.accessToken = api.getAccessToken();
        human.refreshToken = api.getRefreshToken();
        const profile = await api.getPlayerProfile();
        human.playerId = Number(profile?.id);
        human.baseAbilityScore = profile?.baseAbilityScore;
        return profile;
      }, metrics);

      if (humanResult.success) {
        report.addSuccess('真人注册', `playerId=${human.playerId}`);
      } else {
        const loginResult = await safeBotRun(human, '注册', '真人-login', async () => {
          const api = apiClient.clone();
          await api.login({ phone: human.phone, password: human.password });
          human.accessToken = api.getAccessToken();
          human.refreshToken = api.getRefreshToken();
          const profile = await api.getPlayerProfile();
          human.playerId = Number(profile?.id);
          human.baseAbilityScore = profile?.baseAbilityScore;
          return profile;
        }, metrics);
        if (loginResult.success) {
          report.addSuccess('真人登录(fallback)', `playerId=${human.playerId}`);
        } else {
          report.addFailure('真人注册', `注册和登录均失败`);
        }
      }
    }

    // 注册汇总
    const vmOk = venueManagers.filter((b) => b.venueManagerId).length;
    const pOk = players.filter((b) => b.playerId).length;
    report.printInfo('注册汇总', `场地经理: ${vmOk}/${venueManagers.length}, 球员: ${pOk}/${players.length}`);

    report.endPhase();

    // ═══════════════════════════════════════════════════════════
    // Phase 2: 场地创建 + 时段发布
    // ═══════════════════════════════════════════════════════════
    report.startPhase('Phase 2: 场地创建 + 时段发布');

    const stressVenues: StressVenueInfo[] = [];
    const vm = venueManagers[0];
    const todayStr = getShanghaiDateStr();

    const venueNames = [
      `${(vm as any)?._venueName || '飞跃篮球馆'}-A`,
      `${(vm as any)?._venueName || '飞跃篮球馆'}-B`,
    ];

    for (let vi = 0; vi < 2; vi++) {
      if (!vm.accessToken) {
        report.addFailure('场地创建', '场地经理未登录');
        break;
      }

      const api = apiClient.clone();
      api.setTokens(vm.accessToken!, vm.refreshToken!);

      const venueName = venueNames[vi];
      const result = await safeBotRun(vm, '场地', `创建-${venueName}`, async () => {
        const venue = await api.createVenue({
          name: venueName,
          address: `${DEFAULT_REGION} 压力测试路${vi + 1}号`,
          pricePerHour: 180,
          courtCount: 3,
          latitude: 22.5431 + vi * 0.01,
          longitude: 114.0579 + vi * 0.01,
          floorMaterial: 'wood',
          lighting: 'LED',
          courtType: 'indoor',
          ventilation: true,
          bigFan: true,
          airCondition: true,
          parking: true,
          restroom: true,
          shower: true,
          lockerRoom: true,
          regionCode: DEFAULT_REGION,
        });
        return venue;
      }, metrics);

      if (result.success && result.result) {
        const venueId = result.result.id;

        const slots = [
          { slotDate: todayStr, startTime: '08:00', endTime: '10:00' },
          { slotDate: todayStr, startTime: '10:00', endTime: '12:00' },
          { slotDate: todayStr, startTime: '12:00', endTime: '14:00' },
          { slotDate: todayStr, startTime: '14:00', endTime: '16:00' },
          { slotDate: todayStr, startTime: '16:00', endTime: '18:00' },
          { slotDate: todayStr, startTime: '18:00', endTime: '20:00' },
        ];

        const slotResult = await safeBotRun(vm, '时段', `发布-V${venueId}`, async () => {
          return api.createTimeSlots(venueId, slots);
        }, metrics);

        const timeSlotIds = slotResult.success && Array.isArray(slotResult.result)
          ? slotResult.result.map((s: any) => s.id)
          : [];

        stressVenues.push({ venueId, venueName, timeSlotIds });
        report.addSuccess('场地创建', `${venueName} venueId=${venueId} ${timeSlotIds.length} 时段`, result.durationMs);
      }
    }

    report.printInfo('场地汇总', `${stressVenues.length} 个场地已创建`);
    report.endPhase();

    // ═══════════════════════════════════════════════════════════
    // Phase 3: 球员档案 + 能力值
    // ═══════════════════════════════════════════════════════════
    await runPlayerProfilePhase(players, apiClient, metrics, report);

    // ═══════════════════════════════════════════════════════════
    // Phase 4: 40 分钟动态意向提交
    // ═══════════════════════════════════════════════════════════
    report.startPhase('Phase 4: 40 分钟动态意向提交');

    const scheduler = new IntentionScheduler(apiClient, metrics, report);
    const scheduledSubs = scheduler.scheduleSubmissions(players, stressVenues, formats);

    const multiSelectCount = scheduledSubs.filter((s) => s.isMultiSelect).length;
    const singleSelectCount = scheduledSubs.length - multiSelectCount;

    report.printInfo('提交计划', `${scheduledSubs.length} 个意向已调度`);
    report.printInfo('多选意向', `${multiSelectCount} (${(multiSelectCount / scheduledSubs.length * 100).toFixed(1)}%)`);
    report.printInfo('单选意向', `${singleSelectCount} (${(singleSelectCount / scheduledSubs.length * 100).toFixed(1)}%)`);
    report.printInfo('时间窗口', `${INTENTION_SUBMISSION_WINDOW_MS / 60000} 分钟`);
    report.printInfo('当前时间(上海)', formatShanghaiTime(new Date()));

    // 提示真人用户可以在窗口期内提交意向
    console.log(`\n  ${YELLOW}${BOLD}💡 真人用户提示:${RESET}`);
    console.log(`  ${YELLOW}你可以在 ${INTENTION_SUBMISSION_WINDOW_MS / 60000} 分钟内通过 Mobile App 提交意向${RESET}`);
    console.log(`  ${YELLOW}真人账号: 手机号=${HUMAN_PHONE}, 密码=${HUMAN_PASSWORD}${RESET}\n`);

    const submissionResult = await scheduler.executeSubmissions();
    report.printInfo('提交结果', `总计=${submissionResult.total}, 成功=${submissionResult.success}, 失败=${submissionResult.failed}`);
    report.addSuccess('意向提交汇总', `成功=${submissionResult.success}/${submissionResult.total}, 多选=${submissionResult.multiSelectCount}`);

    report.endPhase();

    // ═══════════════════════════════════════════════════════════
    // Phase 5: 匹配监控（每 5 分钟自动触发，持续 40 分钟）
    // ═══════════════════════════════════════════════════════════
    report.startPhase('Phase 5: 匹配监控（每 5 分钟）');

    // 在意向提交完成后启动 40 分钟计时器
    orchestrator.start();
    report.printInfo('计时器启动', `40 分钟匹配监控开始`);

    const matchingMonitor = new MatchingMonitor(appContext, dbTools, metrics, report);
    await matchingMonitor.start(DEFAULT_REGION, TEST_DURATION_MS);

    report.printInfo('匹配监控', `已完成，每 ${MATCHING_INTERVAL_MS / 60000} 分钟执行一次`);

    const matchSummary = matchingMonitor.getSummary();
    report.printInfo('匹配汇总', `执行 ${matchSummary.totalExecutions} 次, 创建 ${matchSummary.totalMatchesCreated} 场比赛, 过期 ${matchSummary.totalExpired} 个意向`);
    report.addSuccess('匹配监控', `执行=${matchSummary.totalExecutions}, 创建=${matchSummary.totalMatchesCreated}, 平均耗时=${matchSummary.avgDurationMs}ms`);

    report.endPhase();

    // ═══════════════════════════════════════════════════════════
    // Phase 6: 查询比赛并展示结果
    // ═══════════════════════════════════════════════════════════
    report.startPhase('Phase 6: 结果展示');

    const pendingMatches = await dbTools.getPendingConfirmationMatches();
    const matchIds = pendingMatches.map((m) => Number(m.id));
    report.printInfo('比赛数量', `${matchIds.length} 场比赛已创建`);

    // 6.1 账号密码对照表
    report.printInfo('步骤 6.1', '账号密码对照表');

    const accountColumns: TableColumn[] = [
      { header: '#', key: 'idx', align: 'right' },
      { header: 'Phone', key: 'phone' },
      { header: 'Password', key: 'password' },
      { header: 'Nickname', key: 'nickname' },
      { header: 'Role', key: 'role' },
      { header: 'PlayerId', key: 'playerId', align: 'right' },
      { header: 'Ability', key: 'ability', align: 'right' },
      { header: 'Intention', key: 'intention' },
    ];

    const GREEN_COLOR = '\x1b[32m';
    const RED_COLOR = '\x1b[31m';

    const accountRows: Array<Record<string, string | number>> = players.map((bot, i) => ({
      idx: i + 1,
      phone: bot.phone,
      password: bot.password,
      nickname: bot.nickname,
      role: 'player',
      playerId: bot.playerId ?? 'N/A',
      ability: bot.baseAbilityScore?.toFixed(1) ?? 'N/A',
      intention: bot.intentionId ? 'OK' : 'FAIL',
    }));
    // 场地经理（突出显示）
    for (const vm2 of venueManagers) {
      accountRows.push({
        idx: accountRows.length + 1,
        phone: vm2.phone,
        password: vm2.password,
        nickname: `${vm2.nickname} [管理员]`,
        role: 'venue_mgr',
        playerId: '-',
        ability: '-',
        intention: '-',
      });
    }

    printTable(accountColumns, accountRows, {
      title: `Account Lookup (${accountRows.length} accounts)`,
      maxRows: 30,
      colorFn: (row, colKey) => {
        if (colKey === 'intention') {
          return row['intention'] === 'OK' ? GREEN_COLOR : row['intention'] === 'FAIL' ? RED_COLOR : '';
        }
        if (colKey === 'nickname' && String(row['nickname']).includes('[管理员]')) {
          return YELLOW;
        }
        return '';
      },
    });

    // 6.2 匹配球员属性表
    if (matchIds.length > 0) {
      report.printInfo('步骤 6.2', '匹配球员属性对比表');

      const matchPlayers = await dbTools.getMatchDetailsForReport();
      if (matchPlayers.length > 0) {
        const playerColumns: TableColumn[] = [
          { header: 'Match', key: 'match_id', align: 'right' },
          { header: 'Team', key: 'team_number', align: 'right' },
          { header: 'PlayerId', key: 'player_id', align: 'right' },
          { header: 'Nickname', key: 'nickname' },
          { header: 'Age', key: 'age', align: 'right' },
          { header: 'BKAge', key: 'basketball_age', align: 'right' },
          { header: 'Height', key: 'height', align: 'right' },
          { header: 'Ability', key: 'base_ability_score', align: 'right' },
          { header: 'Position', key: 'position' },
        ];

        const playerRows = matchPlayers.map((r) => ({
          match_id: r.match_id,
          team_number: r.team_number,
          player_id: r.player_id,
          nickname: r.nickname,
          age: r.age,
          basketball_age: r.basketball_age,
          height: r.height,
          base_ability_score: Number(r.base_ability_score)?.toFixed(1) ?? 'N/A',
          position: r.position ?? '-',
        }));

        printTable(playerColumns, playerRows, {
          title: `Matched Players (${playerRows.length} players in ${matchIds.length} matches)`,
          maxRows: 60,
        });
      }

      // 6.3 匹配意向详情表
      report.printInfo('步骤 6.3', '匹配意向详情表');

      const matchedIntentions = await dbTools.getMatchedIntentions();
      if (matchedIntentions.length > 0) {
        const intColumns: TableColumn[] = [
          { header: 'Match', key: 'match_id', align: 'right' },
          { header: 'IntId', key: 'intention_id', align: 'right' },
          { header: 'Nickname', key: 'nickname' },
          { header: 'StartTime', key: 'start_time' },
          { header: 'Duration', key: 'duration_minutes', align: 'right' },
          { header: 'Wait', key: 'acceptable_wait_minutes', align: 'right' },
          { header: 'Venue', key: 'venue_name' },
          { header: 'Format', key: 'format_name' },
        ];

        const intRows = matchedIntentions.map((r) => ({
          match_id: r.match_id,
          intention_id: r.intention_id,
          nickname: r.nickname,
          start_time: new Date(r.start_time).toLocaleTimeString('zh-CN', { ...TZ_OPTS, hour: '2-digit', minute: '2-digit', hour12: false }),
          duration_minutes: r.duration_minutes,
          acceptable_wait_minutes: r.acceptable_wait_minutes,
          venue_name: r.venue_name ?? '-',
          format_name: r.format_name ?? '-',
        }));

        printTable(intColumns, intRows, {
          title: `Matched Intentions (${intRows.length})`,
          maxRows: 60,
        });
      }

      // 6.4 场地时段状态表
      report.printInfo('步骤 6.4', '场地时段状态表');

      const slotStatus = await dbTools.getVenueSlotStatus();
      if (slotStatus.length > 0) {
        const slotColumns: TableColumn[] = [
          { header: 'Venue', key: 'venue_name' },
          { header: 'Date', key: 'slot_date' },
          { header: 'Time', key: 'time_range' },
          { header: 'Booked', key: 'booked' },
          { header: 'Match', key: 'match_info' },
        ];

        const slotRows = slotStatus.map((r) => ({
          venue_name: r.venue_name,
          slot_date: typeof r.slot_date === 'string' ? r.slot_date.split('T')[0] : String(r.slot_date),
          time_range: `${r.start_time}-${r.end_time}`,
          booked: r.is_booked ? 'Yes' : 'No',
          match_info: r.match_id ? `#${r.match_id} ${r.match_status || ''} (${r.required_players || '?'}p)` : '-',
        }));

        printTable(slotColumns, slotRows, {
          title: 'Venue Slot Status',
          colorFn: (row, colKey) => {
            if (colKey === 'booked') {
              return row['booked'] === 'Yes' ? GREEN_COLOR : DIM;
            }
            return '';
          },
        });
      }

      // 6.5 汇总统计
      report.printInfo('步骤 6.5', '汇总统计');

      const summaryStats = await dataSource.query(
        `SELECT COUNT(*) as total_matches,
                COALESCE(SUM(required_players), 0) as total_matched_players
         FROM matches`,
      );
      const abilityStats = await dataSource.query(
        `SELECT mp.team_number,
                ROUND(AVG(p.base_ability_score)::numeric, 1) as avg_ability,
                ROUND(MIN(p.base_ability_score)::numeric, 1) as min_ability,
                ROUND(MAX(p.base_ability_score)::numeric, 1) as max_ability
         FROM matches m
         JOIN match_players mp ON mp.match_id = m.id
         JOIN players p ON p.id = mp.player_id
         GROUP BY mp.team_number ORDER BY mp.team_number`,
      );

      const totalMatched = Number(summaryStats[0]?.total_matched_players || 0);
      const totalPlayers = players.filter((b) => b.playerId).length;

      console.log(`\n  ${BOLD}=== Summary Statistics ===${RESET}`);
      console.log(`  Total matches:     ${BOLD}${matchIds.length}${RESET}`);
      console.log(`  Players matched:   ${BOLD}${totalMatched}${RESET} / ${totalPlayers} (${totalPlayers > 0 ? ((totalMatched / totalPlayers) * 100).toFixed(1) : 0}%)`);
      console.log(`  Slot utilization:  ${BOLD}${slotStatus.filter((s) => s.is_booked).length}${RESET} / ${slotStatus.length} booked`);

      if (abilityStats.length > 0) {
        const abRows = abilityStats.map((r: any) => ({
          'Team': r.team_number,
          'Avg Ability': r.avg_ability,
          'Min': r.min_ability,
          'Max': r.max_ability,
        }));
        printTable(
          [{ header: 'Team', key: 'Team', align: 'right' }, { header: 'Avg Ability', key: 'Avg Ability', align: 'right' }, { header: 'Min', key: 'Min', align: 'right' }, { header: 'Max', key: 'Max', align: 'right' }],
          abRows,
          { title: 'Team Ability Stats' },
        );
      }
    } else {
      report.printWarning('无比赛', '匹配引擎未产生比赛，无法展示结果表格');
    }

    report.endPhase();

    // ═══════════════════════════════════════════════════════════
    // Phase 7: 球员确认 + 模拟支付
    // ═══════════════════════════════════════════════════════════
    if (matchIds.length > 0) {
      report.startPhase('Phase 7: 球员确认 + 模拟支付');

      const playerBotMap = new Map<number, BotContext>();
      for (const bot of players) {
        if (bot.playerId) playerBotMap.set(Number(bot.playerId), bot);
      }
      if (human.playerId) playerBotMap.set(Number(human.playerId), human);

      for (const matchId of matchIds) {
        report.printDivider();
        report.printInfo('比赛', `matchId=${matchId}`);

        const matchPlayers = await dbTools.getMatchPlayers(matchId);
        report.printInfo('参赛球员', `${matchPlayers.length} 人`);

        // Bot 确认参赛
        const botPlayers = matchPlayers
          .map((mp) => ({ mp, bot: playerBotMap.get(Number(mp.player_id)) }))
          .filter((x) => x.bot && x.bot.accessToken && x.mp.status === 'invited');

        report.printInfo('步骤 7.1', `${botPlayers.length} 个 bot 确认参赛`);

        await Promise.all(
          botPlayers.map(async ({ mp, bot }) => {
            const api = apiClient.clone();
            api.setTokens(bot!.accessToken!, bot!.refreshToken!);

            const start = performance.now();
            try {
              const result = await api.confirmMatch(matchId);
              const durationMs = Math.round(performance.now() - start);
              metrics.record('比赛确认', 'success', durationMs);
              bot!.confirmedMatch = true;
              bot!.matchId = matchId;
              report.addSuccess(`确认参赛`, `${bot!.nickname} orderNo=${result?.orderNo || '?'}`, durationMs);
            } catch (err: any) {
              const durationMs = Math.round(performance.now() - start);
              metrics.record('比赛确认', 'error', durationMs, err.message);
              report.addFailure(`确认参赛`, `${bot!.nickname} ${err.message}`, durationMs);
            }
          }),
        );

        // 验证状态变化和支付
        report.printInfo('步骤 7.2', '验证状态变化和支付');
        const playerStatuses = await dbTools.getMatchPlayerStatuses(matchId);
        const confirmedCount = playerStatuses.filter((p) => p.status === 'confirmed').length;
        const paidCount = playerStatuses.filter((p) => p.deposit_paid).length;
        report.addSuccess('状态验证', `confirmed=${confirmedCount}/${playerStatuses.length}, paid=${paidCount}`);

        // 查询支付订单
        const mockOrders = await dbTools.getMockOrders(matchId);
        if (mockOrders.length > 0) {
          report.addSuccess('支付订单', `${mockOrders.length} 笔订单, 金额=${mockOrders[0]?.amount || '?'}`);
        }

        // 重复确认幂等测试
        if (botPlayers.length > 0) {
          report.printInfo('步骤 7.3', '边界: 重复确认幂等性');
          const firstBot = botPlayers[0].bot!;
          const api = apiClient.clone();
          api.setTokens(firstBot.accessToken!, firstBot.refreshToken!);

          try {
            const result = await api.confirmMatch(matchId);
            report.addSuccess('重复确认幂等', result?.alreadyConfirmed ? '已确认（幂等）' : '返回成功');
          } catch (err: any) {
            report.addSuccess('重复确认拦截', err.message);
          }
        }
      }

      report.endPhase();
    }

    // ═══════════════════════════════════════════════════════════
    // Phase 8: 场地管理员确认
    // ═══════════════════════════════════════════════════════════
    report.startPhase('Phase 8: 场地管理员确认');

    // 展示管理员账号信息
    console.log(`\n  ${YELLOW}${BOLD}场地管理员账号信息:${RESET}`);
    for (const vm2 of venueManagers) {
      console.log(`  ${YELLOW}  昵称: ${vm2.nickname}${RESET}`);
      console.log(`  ${YELLOW}  手机号: ${vm2.phone}${RESET}`);
      console.log(`  ${YELLOW}  密码: ${vm2.password}${RESET}`);
      console.log(`  ${YELLOW}  公司: ${vm2.companyName}${RESET}`);
      console.log(`  ${YELLOW}  允许真人登录检查场地状态${RESET}\n`);
    }

    // 查询场地预订请求并自动确认
    for (const venue of stressVenues) {
      const bookingRequests = await dbTools.getVenueBookingRequests(venue.venueId);
      if (bookingRequests.length > 0) {
        report.printInfo('场地预订请求', `venueId=${venue.venueId} 有 ${bookingRequests.length} 条请求`);

        for (const req of bookingRequests) {
          const confirmed = await dbTools.confirmVenueBookingRequest(req.id);
          if (confirmed) {
            report.addSuccess('场地确认', `requestId=${req.id} matchId=${req.match_id} → confirmed`);
          } else {
            report.addFailure('场地确认', `requestId=${req.id} 确认失败`);
          }
        }
      } else {
        report.printInfo('场地预订请求', `venueId=${venue.venueId} 无请求`);
      }
    }

    // 验证已确认的比赛
    const confirmedMatches = await dbTools.getConfirmedMatches();
    report.printInfo('已确认比赛', `${confirmedMatches.length} 场`);
    report.addSuccess('场地确认汇总', `${confirmedMatches.length} 场比赛已确认`);

    report.endPhase();

    // ═══════════════════════════════════════════════════════════
    // Phase 9: 群聊消息测试
    // ═══════════════════════════════════════════════════════════
    if (matchIds.length > 0) {
      report.startPhase('Phase 9: 群聊消息测试');

      const playerBotMap = new Map<number, BotContext>();
      for (const bot of players) {
        if (bot.playerId) playerBotMap.set(Number(bot.playerId), bot);
      }
      if (human.playerId) playerBotMap.set(Number(human.playerId), human);

      for (const matchId of matchIds.slice(0, 3)) { // 最多测试前 3 场比赛
        report.printDivider();
        report.printInfo('比赛', `matchId=${matchId}`);

        const matchPlayerIds = (await dbTools.getMatchPlayers(matchId)).map((mp) => Number(mp.player_id));
        const matchBots = matchPlayerIds
          .map((id) => playerBotMap.get(id))
          .filter((b): b is BotContext => !!b && !!b.accessToken);

        report.printInfo('参赛 bot', `${matchBots.length} 人将发消息`);

        // 发送消息
        for (const bot of matchBots.slice(0, 5)) { // 每场比赛最多 5 人发消息
          const api = apiClient.clone();
          api.setTokens(bot.accessToken!, bot.refreshToken!);

          const start = performance.now();
          try {
            await api.sendMessage(matchId, {
              content: `大家好，我是${bot.nickname}，期待比赛！`,
              messageType: 'text',
            });
            const durationMs = Math.round(performance.now() - start);
            metrics.record('发送消息', 'success', durationMs);
            bot.messagesSent = (bot.messagesSent || 0) + 1;
            report.addSuccess(`发消息`, `${bot.nickname}`, durationMs);
          } catch (err: any) {
            const durationMs = Math.round(performance.now() - start);
            metrics.record('发送消息', 'error', durationMs, err.message);
            report.addFailure(`发消息`, `${bot.nickname} ${err.message}`, durationMs);
          }
        }

        // 查询消息历史
        report.printInfo('步骤 9.2', '查询消息历史');
        if (matchBots.length > 0) {
          const api = apiClient.clone();
          api.setTokens(matchBots[0].accessToken!, matchBots[0].refreshToken!);
          const start = performance.now();
          try {
            const history = await api.getMessageHistory(matchId, 1, 50);
            const durationMs = Math.round(performance.now() - start);
            const total = history?.total ?? history?.list?.length ?? 0;
            metrics.record('消息历史', 'success', durationMs);
            report.addSuccess('消息历史', `共 ${total} 条消息`, durationMs);

            // DB 验证
            const dbMessages = await dbTools.getMessageHistory(matchId);
            report.addSuccess('DB消息验证', `DB中 ${dbMessages.length} 条消息`);
          } catch (err: any) {
            report.addFailure('消息历史', err.message);
          }
        }

        // 非参赛者拦截测试
        report.printInfo('步骤 9.3', '边界: 非参赛者发消息拦截');
        const nonParticipant = players.find(
          (b) => b.accessToken && b.playerId && !matchPlayerIds.includes(b.playerId),
        );
        if (nonParticipant) {
          const api = apiClient.clone();
          api.setTokens(nonParticipant.accessToken!, nonParticipant.refreshToken!);
          try {
            await api.sendMessage(matchId, { content: '我不是参赛球员' });
            report.addFailure('非参赛者拦截', '系统未阻止非参赛者发消息！');
          } catch (err: any) {
            report.addSuccess('非参赛者拦截', err.message);
          }
        }
      }

      report.endPhase();
    }

    // ═══════════════════════════════════════════════════════════
    // Phase 10: 通知验证
    // ═══════════════════════════════════════════════════════════
    report.startPhase('Phase 10: 通知验证');

    const notifStats = await dataSource.query(
      `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as users FROM notifications`,
    );
    const totalNotifs = Number(notifStats[0]?.total || 0);
    const notifUsers = Number(notifStats[0]?.users || 0);
    report.addSuccess('通知存在性', `共 ${totalNotifs} 条通知, ${notifUsers} 个用户`);

    const typeDistribution = await dataSource.query(
      `SELECT type, COUNT(*) as cnt FROM notifications GROUP BY type ORDER BY cnt DESC`,
    );
    if (typeDistribution.length > 0) {
      for (const row of typeDistribution) {
        report.addSuccess(`通知类型`, `${row.type}: ${row.cnt} 条`);
      }
    }

    const readStats = await dataSource.query(
      `SELECT is_read, COUNT(*) as cnt FROM notifications GROUP BY is_read`,
    );
    const unread = Number(readStats.find((r: any) => !r.is_read)?.cnt || 0);
    const read = Number(readStats.find((r: any) => r.is_read)?.cnt || 0);
    report.addSuccess('读取状态', `未读: ${unread}, 已读: ${read}`);

    report.endPhase();

    // ═══════════════════════════════════════════════════════════
    // Phase 11: SQL 完整性校验
    // ═══════════════════════════════════════════════════════════
    await runIntegrityPhase(dataSource, metrics, report);

    // ═══════════════════════════════════════════════════════════
    // Phase 12: 生成增强报告
    // ═══════════════════════════════════════════════════════════
    report.startPhase('Phase 12: 生成增强报告');

    // 计算匹配成功率
    const allIntentions = await dataSource.query(`SELECT COUNT(*) as total FROM intentions`);
    const matchedIntentions = await dataSource.query(
      `SELECT COUNT(DISTINCT i.id) as cnt
       FROM intentions i
       JOIN match_players mp ON mp.intention_id = i.id`,
    );
    const totalIntentions = Number(allIntentions[0]?.total || 0);
    const matchedIntentionCount = Number(matchedIntentions[0]?.cnt || 0);
    const matchSuccessRate = totalIntentions > 0 ? (matchedIntentionCount / totalIntentions * 100).toFixed(1) : '0';

    // 多选 vs 单选成功率统计
    const multiSelectSuccess = await dataSource.query(
      `SELECT COUNT(DISTINCT i.id) as cnt
       FROM intentions i
       JOIN match_players mp ON mp.intention_id = i.id
       WHERE (SELECT COUNT(*) FROM intention_venues WHERE intention_id = i.id) > 1`,
    );
    const singleSelectSuccess = await dataSource.query(
      `SELECT COUNT(DISTINCT i.id) as cnt
       FROM intentions i
       JOIN match_players mp ON mp.intention_id = i.id
       WHERE (SELECT COUNT(*) FROM intention_venues WHERE intention_id = i.id) = 1`,
    );
    const multiTotal = await dataSource.query(
      `SELECT COUNT(*) as cnt FROM intentions i WHERE (SELECT COUNT(*) FROM intention_venues WHERE intention_id = i.id) > 1`,
    );
    const singleTotal = await dataSource.query(
      `SELECT COUNT(*) as cnt FROM intentions i WHERE (SELECT COUNT(*) FROM intention_venues WHERE intention_id = i.id) = 1`,
    );

    const multiTotalCount = Number(multiTotal[0]?.cnt || 0);
    const singleTotalCount = Number(singleTotal[0]?.cnt || 0);
    const multiSuccessCount = Number(multiSelectSuccess[0]?.cnt || 0);
    const singleSuccessCount = Number(singleSelectSuccess[0]?.cnt || 0);

    report.setMatchSuccessRate({
      totalIntentions,
      matchedIntentions: matchedIntentionCount,
      successRate: `${matchSuccessRate}%`,
      multiSelectSuccessRate: multiTotalCount > 0 ? `${(multiSuccessCount / multiTotalCount * 100).toFixed(1)}%` : 'N/A',
      singleSelectSuccessRate: singleTotalCount > 0 ? `${(singleSuccessCount / singleTotalCount * 100).toFixed(1)}%` : 'N/A',
    });

    // 失败原因分析
    const failureAnalysis: Array<{ category: string; count: number; percentage: number; examples: string[] }> = [];
    const failedIntentionBots = players.filter((b) => b.intentionId === undefined && b.errors.length > 0);
    const errorGroups = new Map<string, { count: number; examples: string[] }>();
    for (const bot of failedIntentionBots) {
      for (const err of bot.errors) {
        const key = err.phase;
        if (!errorGroups.has(key)) errorGroups.set(key, { count: 0, examples: [] });
        const group = errorGroups.get(key)!;
        group.count++;
        if (group.examples.length < 3) group.examples.push(err.message);
      }
    }
    for (const [category, data] of Array.from(errorGroups)) {
      const totalErrors = failedIntentionBots.reduce((sum, b) => sum + b.errors.length, 0);
      failureAnalysis.push({
        category,
        count: data.count,
        percentage: totalErrors > 0 ? (data.count / totalErrors * 100) : 0,
        examples: data.examples,
      });
    }
    report.setFailureAnalysis(failureAnalysis);

    // 系统状态结论
    report.addSystemConclusion(`测试总时长: ${(orchestrator.elapsedMs() / 60000).toFixed(1)} 分钟`);
    report.addSystemConclusion(`注册成功率: ${pOk}/${players.length} 球员, ${vmOk}/${venueManagers.length} 场地经理`);
    report.addSystemConclusion(`意向提交: ${submissionResult?.success || 0}/${submissionResult?.total || 0} 成功`);
    report.addSystemConclusion(`匹配引擎: ${matchSummary?.totalExecutions || 0} 次执行, ${matchSummary?.totalMatchesCreated || 0} 场比赛创建`);
    report.addSystemConclusion(`匹配成功率: ${matchSuccessRate}% (${matchedIntentionCount}/${totalIntentions})`);
    report.addSystemConclusion(`多选意向成功率: ${multiTotalCount > 0 ? (multiSuccessCount / multiTotalCount * 100).toFixed(1) : 'N/A'}%`);
    report.addSystemConclusion(`单选意向成功率: ${singleTotalCount > 0 ? (singleSuccessCount / singleTotalCount * 100).toFixed(1) : 'N/A'}%`);

    // 潜在风险
    if (matchIds.length === 0) {
      report.addPotentialRisk('匹配引擎未创建任何比赛，可能意向数量不足或时间范围不匹配');
    }
    if (submissionResult && submissionResult.failed > submissionResult.total * 0.1) {
      report.addPotentialRisk(`意向提交失败率过高: ${(submissionResult.failed / submissionResult.total * 100).toFixed(1)}%`);
    }
    if (matchSummary && matchSummary.totalExpired > matchSummary.totalMatchesCreated * 2) {
      report.addPotentialRisk('过期意向数量远大于创建的比赛，可能等待时间设置不合理');
    }

    // 写入报告
    const reportPath = await report.writeReport('humanDrivenStress', metrics);
    console.log(`\n${GREEN}${BOLD}  Report: ${reportPath}${RESET}`);

    // 单独写入账号表 JSON
    const accountsPath = path.join(process.cwd(), REPORT_OUTPUT_DIR, `e2e-bot-accounts-humanDrivenStress-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.mkdirSync(path.dirname(accountsPath), { recursive: true });
    fs.writeFileSync(accountsPath, JSON.stringify({
      generated: new Date().toISOString(),
      scenario: 'humanDrivenStress',
      accounts: accountRows,
      venueManagers: venueManagers.map((vm2) => ({
        phone: vm2.phone,
        password: vm2.password,
        nickname: vm2.nickname,
        companyName: vm2.companyName,
        venueIds: stressVenues.filter((v) => v.venueName.startsWith((vm2 as any)._venueName || '')).map((v) => v.venueId),
      })),
    }, null, 2), 'utf-8');
    console.log(`  ${GREEN}Accounts: ${accountsPath}${RESET}`);

    report.endPhase();

    // 测试完成提示
    console.log(`\n${CYAN}${BOLD}═══════════════════════════════════════════════════════════════${RESET}`);
    console.log(`${CYAN}${BOLD}  测试完成！${RESET}`);
    console.log(`${CYAN}${BOLD}  总用时: ${(orchestrator.elapsedMs() / 60000).toFixed(1)} 分钟${RESET}`);
    console.log(`${CYAN}${BOLD}  真人账号: 手机号=${HUMAN_PHONE}, 密码=${HUMAN_PASSWORD}${RESET}`);
    console.log(`${CYAN}${BOLD}  可在 Mobile App 登录查看结果${RESET}`);
    console.log(`${CYAN}${BOLD}═══════════════════════════════════════════════════════════════${RESET}\n`);

  } catch (err: any) {
    console.error(`\n${YELLOW}❌ 测试执行失败: ${err.message}${RESET}`);
    if (err.stack) console.error(err.stack);
    try {
      const reportPath = await report.writeReport('humanDrivenStress-failed', metrics);
      console.log(`  ${YELLOW}部分报告: ${reportPath}${RESET}`);
    } catch { /* ignore */ }
  } finally {
    interactive.close();
  }
}
