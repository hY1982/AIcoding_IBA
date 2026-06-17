/**
 * =============================================================================
 * Human-Driven Stress Test — 200 人大规模压力测试场景
 * =============================================================================
 *
 * 200 个 bot 球员 + 1 场地经理(2 场地)，随机意向(今天 8:00-20:00)，
 * 自动匹配，终端富表格展示。
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
import { runBatch, safeBotRun } from '../helpers/safe-runner';
import { TableColumn, printTable } from '../helpers/table-formatter';
import { generateBots } from '../bot-profiles';
import {
  DEFAULT_REGION, STRESS_BATCH_SIZE, STRESS_BATCH_DELAY_MS,
  BOT_PASSWORD, HUMAN_PHONE, HUMAN_PASSWORD, HUMAN_NICKNAME,
  REPORT_OUTPUT_DIR,
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

/**
 * 生成随机意向参数
 */
function generateRandomIntention(
  earliestMs: number,
  latestMs: number,
  venues: StressVenueInfo[],
  formats: Array<{ id: number; name: string; team_size: number }>,
): CreateIntentionPayload {
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

  // venueIds: 60% 选 2 个, 40% 选 1 个
  const venueIds: Array<{ venueId: number; priority: number }> = [];
  const shuffledVenues = [...venues].sort(() => Math.random() - 0.5);
  const venueCount = Math.random() < 0.6 ? Math.min(2, venues.length) : 1;
  for (let i = 0; i < venueCount; i++) {
    venueIds.push({ venueId: shuffledVenues[i].venueId, priority: i + 1 });
  }

  // formatIds: 70% 选 1 个(优先 3v3), 30% 选 2 个
  const formatIds: Array<{ formatId: number; priority: number }> = [];
  const fmtCount = Math.random() < 0.7 ? 1 : Math.min(2, formats.length);
  // 优先选 3v3 (team_size=3)
  const sortedFormats = [...formats].sort((a, b) => {
    if (a.team_size === 3) return -1;
    if (b.team_size === 3) return 1;
    return Math.random() - 0.5;
  });
  for (let i = 0; i < fmtCount; i++) {
    formatIds.push({ formatId: sortedFormats[i].id, priority: i + 1 });
  }

  return { startTime, durationMinutes, acceptableWaitMinutes, venueIds, formatIds };
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
  const metrics = new MetricsCollector();
  const report = new ReportGenerator();
  const interactive = new InteractivePrompt(autoMode);
  const dbTools = new DbTools(dataSource);
  const apiClient = new ApiClient('http://localhost:3000/api/v1', metrics);

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

    // 1.2 批量注册 200 球员
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
        // fallback: 直接登录
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
    // Phase 2: 场地创建 — 1 经理 2 场地
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

        // 创建 1 个大时段: 08:00-20:00（匹配引擎预订时自动拆分）
        const slots = [
          { slotDate: todayStr, startTime: '08:00', endTime: '20:00' },
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
    // Phase 4: 随机意向生成
    // ═══════════════════════════════════════════════════════════
    report.startPhase('Phase 4: 随机意向生成');

    // 计算合法 startTime 范围（使用上海时区）
    const shNow = getShanghaiNow();
    const shY = shNow.getUTCFullYear(), shM = shNow.getUTCMonth(), shD = shNow.getUTCDate();
    const earliest = new Date(Math.max(
      createShanghaiDate(shY, shM, shD, 8, 0, 0).getTime(),
      Date.now() + 1 * 60 * 60 * 1000, // 至少提前 1 小时
    ));
    const latest = createShanghaiDate(shY, shM, shD, 19, 30, 0);

    if (earliest >= latest) {
      console.log(`\n${YELLOW}  ⚠️  当前时间 ${formatLocalTime(new Date())}，合法意向时间范围不足 (需 >= 08:00 且 <= 19:30)${RESET}`);
      console.log(`  ${YELLOW}   earliest=${formatLocalTime(earliest)}, latest=${formatLocalTime(latest)}${RESET}`);
      console.log(`  ${YELLOW}   建议次日 10:00 后运行此场景${RESET}\n`);
      report.addFailure('意向时间', '合法 startTime 范围不足，无法生成意向');
      report.endPhase();
    } else {
      console.log(`  ${BLUE}合法 startTime 范围:${RESET} ${formatLocalTime(earliest)} ~ ${formatLocalTime(latest)}`);

      const eligiblePlayers = players.filter((b) => b.playerId && b.accessToken);

      // 分批：前 100 + 后 100
      const batchA = eligiblePlayers.slice(0, 100);
      const batchB = eligiblePlayers.slice(100);

      // 预生成每个 bot 的随机意向参数
      const allIntentionParams: CreateIntentionPayload[] = eligiblePlayers.map(() =>
        generateRandomIntention(earliest.getTime(), latest.getTime(), stressVenues, formats),
      );
      const intentionParamsA = allIntentionParams.slice(0, 100);
      const intentionParamsB = allIntentionParams.slice(100);

      // ---- Phase 4a: 前 100 个 bot 提交意向 ----
      report.printInfo('步骤 4a', `${batchA.length} 个球员提交意向（第一批）`);

      await runBatch(
        batchA,
        STRESS_BATCH_SIZE,
        async (bot, idx) => {
          const api = apiClient.clone();
          api.setTokens(bot.accessToken!, bot.refreshToken!);
          const params = intentionParamsA[idx];

          const result = await safeBotRun(bot, '意向', `提交-${bot.nickname}`, async () => {
            const intention = await api.createIntention(params);
            bot.intentionId = intention?.id;
            bot.intentionStartTime = params.startTime;
            return intention;
          }, metrics);

          if (result.success) {
            report.addSuccess('意向提交', `${bot.nickname} id=${bot.intentionId} start=${new Date(params.startTime).toLocaleTimeString('zh-CN', TZ_OPTS)} dur=${params.durationMinutes}min`, result.durationMs);
          } else {
            const errMsg = result.error?.message || '未知错误';
            console.log(`  ${RED}❌ 意向失败 | ${bot.nickname} | ${errMsg}${RESET}`);
            report.addFailure('意向提交', `${bot.nickname} ${errMsg}`, result.durationMs);
          }
        },
        STRESS_BATCH_DELAY_MS,
      );

      // ⏸️ 暂停等待真人提交意向
      if (!autoMode) {
        await interactive.pauseForHuman(' 第一批 100 bot 已提交意向，请提交你的意向', [
          { step: 1, description: '在 Mobile App 注册并登录' },
          { step: 2, description: '提交一个匹配上述时间/场地/赛制的意向' },
          { step: 3, description: '提交后按 Enter 继续 (或按 Enter 跳过)' },
        ]);
      }

      // ---- Phase 4b: 后 100 个 bot 提交意向 ----
      if (batchB.length > 0) {
        report.printInfo('步骤 4b', `${batchB.length} 个球员提交意向（第二批）`);

        await runBatch(
          batchB,
          STRESS_BATCH_SIZE,
          async (bot, idx) => {
            const api = apiClient.clone();
            api.setTokens(bot.accessToken!, bot.refreshToken!);
            const params = intentionParamsB[idx];

            const result = await safeBotRun(bot, '意向', `提交-${bot.nickname}`, async () => {
              const intention = await api.createIntention(params);
              bot.intentionId = intention?.id;
              bot.intentionStartTime = params.startTime;
              return intention;
            }, metrics);

            if (result.success) {
              report.addSuccess('意向提交', `${bot.nickname} id=${bot.intentionId} start=${new Date(params.startTime).toLocaleTimeString('zh-CN', TZ_OPTS)} dur=${params.durationMinutes}min`, result.durationMs);
            } else {
              const errMsg = result.error?.message || '未知错误';
              console.log(`  ${RED}❌ 意向失败 | ${bot.nickname} | ${errMsg}${RESET}`);
              report.addFailure('意向提交', `${bot.nickname} ${errMsg}`, result.durationMs);
            }
          },
          STRESS_BATCH_DELAY_MS,
        );
      }

      // 意向分布统计（基于全量）
      const successBots = eligiblePlayers.filter((b) => b.intentionId);
      const failedBots = eligiblePlayers.filter((b) => !b.intentionId);

      // 按小时统计（上海时区）
      const hourDist: Record<number, number> = {};
      const formatDist: Record<string, number> = {};
      const venueDist: Record<string, number> = {};
      for (let i = 0; i < successBots.length; i++) {
        const params = allIntentionParams[eligiblePlayers.indexOf(successBots[i])];
        const h = new Date(params.startTime).toLocaleString('en-US', { timeZone: 'Asia/Shanghai', hour: 'numeric', hour12: false });
        const hour = parseInt(h, 10);
        hourDist[hour] = (hourDist[hour] || 0) + 1;
        for (const f of params.formatIds) {
          const fmt = formats.find((ff) => ff.id === f.formatId);
          const key = fmt?.name || `format_${f.formatId}`;
          formatDist[key] = (formatDist[key] || 0) + 1;
        }
        for (const v of params.venueIds) {
          const sv = stressVenues.find((s) => s.venueId === v.venueId);
          const key = sv?.venueName || `venue_${v.venueId}`;
          venueDist[key] = (venueDist[key] || 0) + 1;
        }
      }

      // 打印分布表
      console.log(`\n${CYAN}${BOLD}  意向分布统计${RESET}`);
      console.log(`${DIM}  ${'─'.repeat(50)}${RESET}`);

      // 按小时
      const hourRows = Object.entries(hourDist)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([h, c]) => ({ 'Hour': `${h}:00`, 'Count': c, 'Bar': '█'.repeat(Math.min(c, 40)) }));
      printTable(
        [{ header: 'Hour', key: 'Hour', align: 'right' }, { header: 'Count', key: 'Count', align: 'right' }, { header: 'Distribution', key: 'Bar' }],
        hourRows,
        { title: 'By Hour (Shanghai)' },
      );

      // 按赛制
      const fmtRows = Object.entries(formatDist).map(([k, c]) => ({ 'Format': k, 'Count': c }));
      printTable(
        [{ header: 'Format', key: 'Format' }, { header: 'Count', key: 'Count', align: 'right' }],
        fmtRows,
        { title: 'By Format' },
      );

      // 按场地
      const venRows = Object.entries(venueDist).map(([k, c]) => ({ 'Venue': k, 'Count': c }));
      printTable(
        [{ header: 'Venue', key: 'Venue' }, { header: 'Count', key: 'Count', align: 'right' }],
        venRows,
        { title: 'By Venue' },
      );

      report.printInfo('意向汇总', `${successBots.length} 成功 / ${failedBots.length} 失败 / ${eligiblePlayers.length} 总计`);
      report.endPhase();
    }

    // ═══════════════════════════════════════════════════════════
    // Phase 5: 匹配前诊断 + 自动匹配
    // ═══════════════════════════════════════════════════════════
    report.startPhase('Phase 5: 匹配引擎');

    // 5.1 诊断
    report.printInfo('步骤 5.1', '匹配前诊断');

    const statusDist = await dataSource.query(
      `SELECT status, COUNT(*) as cnt FROM intentions GROUP BY status ORDER BY status`,
    );
    if (statusDist.length > 0) {
      const diagRows = statusDist.map((r: any) => ({
        'Status': r.status,
        'Count': Number(r.cnt),
      }));
      printTable(
        [{ header: 'Status', key: 'Status' }, { header: 'Count', key: 'Count', align: 'right' }],
        diagRows,
        { title: 'Intention Status Distribution' },
      );
    }

    // 5.2 触发匹配
    report.printInfo('步骤 5.2', '触发匹配引擎');
    const matchStart = performance.now();
    let matchResult: any;

    try {
      matchResult = await dbTools.triggerMatching(appContext, DEFAULT_REGION);
      const durationMs = Math.round(performance.now() - matchStart);
      metrics.record('匹配引擎', 'success', durationMs);

      const scanned = matchResult?.intentionsScanned ?? matchResult?.totalIntentions ?? '?';
      const created = matchResult?.matchesCreated ?? matchResult?.totalMatches ?? '?';
      report.addSuccess('匹配引擎执行', `扫描=${scanned}, 创建=${created}`, durationMs);
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - matchStart);
      metrics.record('匹配引擎', 'error', durationMs, err.message);
      report.addFailure('匹配引擎执行', err.message, durationMs);
    }

    // 5.3 查询比赛
    report.printInfo('步骤 5.3', '查询比赛记录');
    const pendingMatches = await dbTools.getPendingConfirmationMatches();
    const matchIds = pendingMatches.map((m) => Number(m.id));
    report.printInfo('比赛数量', `${matchIds.length} 场比赛已创建`);

    report.endPhase();

    // ═══════════════════════════════════════════════════════════
    // Phase 6: 结果展示 — 终端富表格
    // ═══════════════════════════════════════════════════════════
    report.startPhase('Phase 6: 结果展示');

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
    // 场地经理
    for (const vm2 of venueManagers) {
      accountRows.push({
        idx: accountRows.length + 1,
        phone: vm2.phone,
        password: vm2.password,
        nickname: vm2.nickname,
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
          match_info: r.match_id ? `#${r.match_id} ${r.match_status || ''} (${r.total_players || '?'}p)` : '-',
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
                COALESCE(SUM(total_players), 0) as total_matched_players
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
    // Phase 7: 完整性校验 + 报告
    // ═══════════════════════════════════════════════════════════
    await runIntegrityPhase(dataSource, metrics, report);

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
    }, null, 2), 'utf-8');
    console.log(`  ${GREEN}Accounts: ${accountsPath}${RESET}`);

    // 清理选项
    const shouldClean = await interactive.askYesNo('\n  是否清理测试数据？', false);
    if (shouldClean) {
      await dbTools.truncateAll();
      console.log(`  ${GREEN}测试数据已清理${RESET}`);
    } else {
      console.log(`  ${YELLOW}数据已保留，可在 Mobile App 继续浏览${RESET}`);
    }

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
