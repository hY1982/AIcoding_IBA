/**
 * =============================================================================
 * 篮球匹配平台 — 50 机器人端到端用户测试脚本
 * =============================================================================
 *
 * 用法:
 *   npm run e2e:bot -- --list                        # 列出可用场景
 *   npm run e2e:bot -- --scenario=smooth3v3          # 运行指定场景
 *   npm run e2e:bot -- --scenario=fullStress --auto  # 自动模式（跳过真人交互）
 *   npm run e2e:bot -- --scenario=peakHour --no-cleanup  # 运行后保留数据
 *
 * 前置条件:
 *   1. Docker 环境已启动 (PostgreSQL + Redis)
 *   2. 数据库迁移已执行 (npm run migration:run)
 *   3. 后端 HTTP 服务已启动 (npm run start:dev, 端口 3000)
 */

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

// 全局配置
import { API_BASE_URL, DEFAULT_REGION } from './e2e-bot/config';

// 工具
import { ApiClient, checkServerHealth } from './e2e-bot/api-client';
import { MetricsCollector } from './e2e-bot/metrics-collector';
import { ReportGenerator } from './e2e-bot/report-generator';
import { InteractivePrompt } from './e2e-bot/interactive';
import { DbTools } from './e2e-bot/helpers/db-tools';
import { generateBots } from './e2e-bot/bot-profiles';

// 场景
import { getScenario, listScenarios, SCENARIOS } from './e2e-bot/scenarios/scenario-definitions';

// Phase 执行器
import { runRegistrationPhase } from './e2e-bot/scenarios/phase-01-registration';
import { runVenueSetupPhase } from './e2e-bot/scenarios/phase-02-venue-setup';
import { runPlayerProfilePhase } from './e2e-bot/scenarios/phase-03-player-profile';
import { runIntentionPhase } from './e2e-bot/scenarios/phase-04-intention';
import { runMatchingPhase } from './e2e-bot/scenarios/phase-05-matching';
import { runConfirmationPhase } from './e2e-bot/scenarios/phase-06-confirmation';
import { runMessagingPhase } from './e2e-bot/scenarios/phase-07-messaging';
import { runFeedbackPhase } from './e2e-bot/scenarios/phase-08-feedback';
import { runNotificationPhase } from './e2e-bot/scenarios/phase-09-notification';
import { runStressPhase } from './e2e-bot/scenarios/phase-10-stress';
import { runIntegrityPhase } from './e2e-bot/scenarios/phase-11-integrity';

// ─── 颜色 ───
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// ─── 命令行参数解析 ───

interface CliArgs {
  scenario: string;
  list: boolean;
  auto: boolean;
  noCleanup: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    scenario: 'smooth3v3',
    list: false,
    auto: false,
    noCleanup: false,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === '--list') {
      args.list = true;
    } else if (arg === '--auto') {
      args.auto = true;
    } else if (arg === '--no-cleanup') {
      args.noCleanup = true;
    } else if (arg.startsWith('--scenario=')) {
      args.scenario = arg.split('=')[1];
    } else if (arg.startsWith('--scenario')) {
      // 支持 --scenario smooth3v3 格式
      const idx = process.argv.indexOf(arg);
      if (idx >= 0 && process.argv[idx + 1]) {
        args.scenario = process.argv[idx + 1];
      }
    }
  }

  return args;
}

// ─── Phase 0: 基础设施初始化 ───

async function phaseZero(
  report: ReportGenerator,
  dbTools: DbTools,
  scenario: ReturnType<typeof getScenario>,
): Promise<{ players: any[]; venueManagers: any[]; human: any }> {
  report.startPhase('Phase 0: 基础设施初始化');

  // 0.1 HTTP 健康检查
  report.printInfo('步骤 0.1', `检查后端服务 (${API_BASE_URL})`);
  const healthy = await checkServerHealth();
  if (!healthy) {
    report.addFailure('HTTP 健康检查', `无法连接到后端服务，请先启动 npm run start:dev`);
    throw new Error('后端服务不可达');
  }
  report.addSuccess('HTTP 健康检查', '后端服务可达');

  // 0.2 DB 连接检查
  report.printInfo('步骤 0.2', '检查数据库连接');
  const dbOk = await dbTools.checkConnection();
  if (!dbOk) {
    report.addFailure('DB 连接', '数据库连接失败');
    throw new Error('数据库不可达');
  }
  report.addSuccess('DB 连接', '数据库连接成功');

  // 0.3 清理数据
  report.printInfo('步骤 0.3', '清理历史数据 (TRUNCATE CASCADE)');
  try {
    await dbTools.truncateAll();
    report.addSuccess('数据清理', '全部业务表已清空');
  } catch (err: any) {
    report.addFailure('数据清理', err.message);
    throw err;
  }

  // 0.4 写入种子数据
  report.printInfo('步骤 0.4', '写入种子数据 (SystemParam + Format)');
  try {
    await dbTools.seedSystemParams();
    await dbTools.seedFormats();
    const formats = await dbTools.getFormats();
    report.addSuccess('种子数据', `${formats.length} 个赛制已写入: ${formats.map((f) => f.name).join(', ')}`);
  } catch (err: any) {
    report.addFailure('种子数据', err.message);
    throw err;
  }

  // 0.5 生成 Bot 档案
  report.printInfo('步骤 0.5', `生成 Bot 档案 (场景: ${scenario.id})`);
  const { players, venueManagers, human } = generateBots(scenario.bots);
  report.addSuccess(
    'Bot 档案',
    `${players.length} 球员 + ${venueManagers.length} 场地经理 + 1 真人 = ${players.length + venueManagers.length + 1} 总计`,
  );

  report.endPhase();
  return { players, venueManagers, human };
}

// ─── 主流程 ───

async function main() {
  // 在 NestJS AppModule 加载前设置，静默 TypeORM 日志和 schema 同步
  process.env.E2E_TEST = 'true';

  const cliArgs = parseArgs();

  // --list: 列出可用场景
  if (cliArgs.list) {
    listScenarios();
    process.exit(0);
  }

  // 验证场景
  const scenario = getScenario(cliArgs.scenario);

  // 打印 Banner
  console.log('');
  console.log(`${CYAN}${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${CYAN}${BOLD}║  🏀 篮球匹配平台 — 50 Bot 端到端测试                    ║${RESET}`);
  console.log(`${CYAN}${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}`);
  console.log('');
  console.log(`  场景: ${GREEN}${BOLD}${scenario.name}${RESET} (${scenario.id})`);
  console.log(`  描述: ${scenario.description}`);
  console.log(`  模式: ${cliArgs.auto ? YELLOW + '自动模式 (跳过真人交互)' + RESET : GREEN + '交互模式 (含真人暂停点)' + RESET}`);
  console.log(`  清理: ${cliArgs.noCleanup ? YELLOW + '运行后保留数据' + RESET : GREEN + '运行前自动清理' + RESET}`);
  console.log('');

  // 创建 NestJS ApplicationContext（仅用于 DB 操作和匹配触发）
  let app: any;
  let dataSource: DataSource;

  try {
    const { AppModule } = require('../src/app.module');
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    dataSource = app.get<DataSource>(getDataSourceToken());
  } catch (err: any) {
    console.error(`${RED}❌ 无法创建 NestJS ApplicationContext: ${err.message}${RESET}`);
    console.error('请确认: 1) Docker 已启动  2) .env 配置正确  3) 迁移已执行');
    process.exit(1);
  }

  // 初始化工具
  const metrics = new MetricsCollector();
  const report = new ReportGenerator();
  const interactive = new InteractivePrompt(cliArgs.auto);
  const dbTools = new DbTools(dataSource);
  const apiClient = new ApiClient(API_BASE_URL, metrics);

  try {
    // ═══ Phase 0: 基础设施初始化 ═══
    const { players, venueManagers, human } = await phaseZero(report, dbTools, scenario);

    // ═══ Phase 1: 批量注册 ═══
    await runRegistrationPhase(players, venueManagers, human, apiClient, metrics, report, dbTools);

    // ═══ Phase 2: 场地创建 + 时段发布 ═══
    await runVenueSetupPhase(venueManagers, apiClient, metrics, report);

    // ═══ Phase 3: 球员档案 + 能力值 ═══
    await runPlayerProfilePhase(players, apiClient, metrics, report);

    // ═══ Phase 4: 意向提交 + 真人暂停点 ═══
    const intentionResult = await runIntentionPhase(
      players, venueManagers, human, apiClient, metrics, report, interactive, dbTools, scenario,
    );

    // ═══ Phase 5: 匹配引擎 ═══
    const matchingResult = await runMatchingPhase(app, dbTools, metrics, report);

    // ═══ Phase 6: 比赛确认 + 支付 ═══
    await runConfirmationPhase(
      players, human, matchingResult.matchIds, apiClient, metrics, report, interactive, dbTools,
    );

    // ═══ Phase 7: 群聊消息 ═══
    await runMessagingPhase(
      players, human, matchingResult.matchIds, apiClient, metrics, report, interactive, dbTools,
    );

    // ═══ Phase 8: 赛后反馈 ═══
    await runFeedbackPhase(
      players, human, matchingResult.matchIds, apiClient, metrics, report, interactive, dbTools,
    );

    // ═══ Phase 9: 通知验证 ═══
    await runNotificationPhase(
      players, human, matchingResult.matchIds, dataSource, metrics, report,
    );

    // ═══ Phase 10: 压力测试（仅 fullStress） ═══
    if (scenario.includeStress) {
      await runStressPhase(players, matchingResult.matchIds, apiClient, metrics, report);
    } else {
      report.startPhase('Phase 10: 压力测试');
      report.addSkip('压力测试', `场景 ${scenario.id} 不包含压力测试 (仅 fullStress)`);
      report.endPhase();
    }

    // ═══ Phase 11: SQL 完整性校验 ═══
    const integrityResult = await runIntegrityPhase(dataSource, metrics, report);

    // ═══ 生成报告 ═══
    const reportPath = await report.writeReport(scenario.id, metrics);
    console.log(`  ${GREEN}📄 详细报告: ${reportPath}${RESET}`);

    // ═══ 运行后清理 ═══
    if (!cliArgs.noCleanup) {
      const shouldClean = await interactive.askYesNo('\n  是否清理测试数据？', true);
      if (shouldClean) {
        await dbTools.truncateAll();
        console.log(`  ${GREEN}✅ 测试数据已清理${RESET}`);
      } else {
        console.log(`  ${YELLOW}保留测试数据，可手动检查数据库${RESET}`);
      }
    } else {
      console.log(`  ${YELLOW}--no-cleanup: 数据已保留${RESET}`);
    }

  } catch (err: any) {
    console.error(`\n${RED}${BOLD}❌ 测试执行失败: ${err.message}${RESET}`);
    if (err.stack) {
      console.error(err.stack);
    }

    // 尝试生成部分报告
    try {
      const reportPath = await report.writeReport(`${scenario.id}-failed`, metrics);
      console.log(`  ${YELLOW}📄 部分报告: ${reportPath}${RESET}`);
    } catch {
      // 忽略报告生成错误
    }

    process.exit(1);
  } finally {
    interactive.close();
    try {
      await app.close();
    } catch {
      // 忽略关闭错误
    }
  }
}

main().catch((err) => {
  console.error('\n致命错误:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
