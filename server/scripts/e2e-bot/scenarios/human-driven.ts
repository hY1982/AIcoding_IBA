/**
 * =============================================================================
 * Human-Driven E2E 测试场景
 * =============================================================================
 *
 * 真人驱动、Bot 配合的端到端测试流程。
 * Bot 在后台注册并创建意向，真人通过 Mobile App（Expo）操作。
 *
 * 前置条件:
 *   1. 后端 server 运行在 localhost:3000
 *   2. Mobile App 已启动 (cd apps/mobile && npx expo start)
 *   3. 数据库已迁移
 *
 * 用法:
 *   npm run e2e:bot -- --scenario=humanDriven
 */

import { DataSource } from 'typeorm';
import { ApiClient } from '../api-client';
import { BotContext, createEmptyBotContext } from '../helpers/bot-context';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { InteractivePrompt } from '../interactive';
import { DbTools } from '../helpers/db-tools';
import { ScenarioDefinition } from './scenario-definitions';
import { runRegistrationPhase } from './phase-01-registration';
import { runVenueSetupPhase } from './phase-02-venue-setup';
import { runPlayerProfilePhase } from './phase-03-player-profile';
import { runIntentionPhase } from './phase-04-intention';
import { runMatchingPhase } from './phase-05-matching';
import { runConfirmationPhase } from './phase-06-confirmation';
import { runMessagingPhase } from './phase-07-messaging';
import { runFeedbackPhase } from './phase-08-feedback';
import { runNotificationPhase } from './phase-09-notification';
import { runIntegrityPhase } from './phase-11-integrity';
import { generateBots } from '../bot-profiles';

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

export async function runHumanDrivenScenario(
  appContext: any,
  dataSource: DataSource,
  scenario: ScenarioDefinition,
): Promise<void> {
  const metrics = new MetricsCollector();
  const report = new ReportGenerator();
  const interactive = new InteractivePrompt(false); // 始终交互模式
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

    report.printInfo('步骤 0.2', '清理历史数据');
    const dbInfo0 = await dataSource.query(`SELECT current_database() as db`);
    console.log(`    ${DIM}DB: ${dbInfo0[0]?.db}, host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}${RESET}`);
    await dbTools.truncateAll();
    report.addSuccess('数据清理', '全部业务表已清空');

    report.printInfo('步骤 0.3', '写入种子数据');
    await dbTools.seedSystemParams();
    await dbTools.seedFormats();
    const formats = await dbTools.getFormats();
    report.addSuccess('种子数据', `${formats.length} 个赛制已写入`);
    // 验证种子数据确实可见
    const seedCount = await dataSource.query(`SELECT COUNT(*) as cnt FROM formats WHERE is_active = true`);
    console.log(`    ${DIM}验证: formats表可读=${seedCount[0]?.cnt} 条${RESET}`);

    report.printInfo('步骤 0.4', '生成 Bot 档案');
    const { players, venueManagers, human } = generateBots(scenario.bots);
    report.addSuccess('Bot 档案', `${players.length} 球员 + ${venueManagers.length} 场地方`);

    report.endPhase();

    // ═══════════════════════════════════════════════════════════
    // Phase 1: Bot 批量注册
    // ═══════════════════════════════════════════════════════════
    await runRegistrationPhase(players, venueManagers, human, apiClient, metrics, report, dbTools);

    // ═══════════════════════════════════════════════════════════
    // Phase 2: 场地创建 + 时段发布
    // ═══════════════════════════════════════════════════════════
    await runVenueSetupPhase(venueManagers, apiClient, metrics, report);

    // ═══════════════════════════════════════════════════════════
    // Phase 3: 球员档案 + 能力值
    // ═══════════════════════════════════════════════════════════
    await runPlayerProfilePhase(players, apiClient, metrics, report);

    // ═══════════════════════════════════════════════════════════
    // Phase 4: Bot 提交意向（后台静默）
    // ═══════════════════════════════════════════════════════════
    const intentionResult = await runIntentionPhase(
      players, venueManagers, human, apiClient, metrics, report, interactive, dbTools, scenario,
      { skipHumanPause: true },
    );

    // ═══════════════════════════════════════════════════════════
    // ⏸️  真人操作时间：注册 + 录入意向
    // ═══════════════════════════════════════════════════════════
    const startTime2h = new Date(intentionResult.startTime);
    // 强制使用 Asia/Shanghai 时区显示（Docker 容器默认 UTC，会导致时间显示错误）
    const TZ_OPTS = { timeZone: 'Asia/Shanghai' };
    const localDate = startTime2h.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', ...TZ_OPTS });
    const localTime = startTime2h.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, ...TZ_OPTS });

    const venueInfo = venueManagers.filter((vm) => vm.venueId);
    const venueName = (venueInfo[0] as any)?._venueName || '场地';
    const formatName = formats[0]?.name || '3v3 标准';

    // 打印 Bot 意向详情，帮助真人输入匹配参数
    const successBots = players.filter((p) => p.intentionId);
    console.log(`\n${CYAN}${BOLD}  📝 Bot 意向详情（共 ${successBots.length} 个 Bot 已提交）${RESET}`);
    console.log(`${DIM}  ${'─'.repeat(60)}${RESET}`);
    console.log(`  ${BLUE}日期:${RESET}     ${BOLD}${localDate}${RESET}`);
    console.log(`  ${BLUE}时间:${RESET}     ${BOLD}${localTime}${RESET}  (时长 ${scenario.durationMinutes} 分钟)`);
    console.log(`  ${BLUE}赛制:${RESET}     ${BOLD}${formatName}${RESET}  (formatId=${intentionResult.formatId})`);
    console.log(`  ${BLUE}场地:${RESET}     ${BOLD}${venueName}${RESET}  (venueId=${intentionResult.venueId})`);
    console.log(`${DIM}  ${'─'.repeat(60)}${RESET}`);
    console.log(`  ${DIM}Bot 列表:${RESET}`);
    for (const bot of successBots) {
      console.log(`    ${GREEN}✓${RESET} ${bot.nickname}  (playerId=${bot.playerId}, 能力值=${bot.baseAbilityScore?.toFixed(1) || '?'}, intentionId=${bot.intentionId})`);
    }
    console.log(`${DIM}  ${'─'.repeat(60)}${RESET}`);
    console.log(`  ${YELLOW}💡 真人需要输入完全相同的日期、时间、赛制和场地，才能被匹配引擎匹配${RESET}\n`);

    await interactive.pauseForHuman(' 注册 + 录入意向（Mobile App）', [
      {
        step: 1,
        description: '启动 Mobile App（如未启动）',
        example: 'cd apps/mobile && npx expo start（Web: npx expo start --web）',
      },
      {
        step: 2,
        description: '选择 "我是球员" → 注册一个球员账号',
        example: '手机号随意（如 13800000001），密码随意（至少6位）',
      },
      {
        step: 3,
        description: '注册成功后进入首页，点击 "提交意向"',
        example: '首页 → 提交意向',
      },
      {
        step: 4,
        description: `选择日期: ${BOLD}${localDate}${RESET}`,
        example: `必须与 Bot 的日期完全一致`,
      },
      {
        step: 5,
        description: `选择时间: ${BOLD}${localTime}${RESET}，时长: ${scenario.durationMinutes} 分钟`,
        example: `必须与 Bot 完全一致才能匹配`,
      },
      {
        step: 6,
        description: `选择赛制: ${BOLD}${formatName}${RESET}`,
        example: `formatId=${intentionResult.formatId}，确保与 Bot 选择相同赛制`,
      },
      {
        step: 7,
        description: `选择场地: ${BOLD}${venueName}${RESET}`,
        example: `venueId=${intentionResult.venueId}，选择该场地并提交`,
      },
    ]);

    // ═══════════════════════════════════════════════════════════
    // 匹配前诊断：检查 DB 中的意向状态
    // ═══════════════════════════════════════════════════════════
    const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);

    // 查询所有意向（不限状态）
    const allIntentions = await dataSource.query(
      `SELECT i.id, i.player_id, i.start_time, i.region_code, i.status,
              u.nickname
       FROM intentions i
       LEFT JOIN players p ON p.id = i.player_id
       LEFT JOIN users u ON u.id = p.user_id
       ORDER BY i.id`,
    );

    // 基本表计数（验证 DataSource 连接正确）
    const dbInfo = await dataSource.query(`SELECT current_database() as db, current_schema() as schema`);
    const userCount = await dataSource.query(`SELECT COUNT(*) as cnt FROM users`);
    const playerCount = await dataSource.query(`SELECT COUNT(*) as cnt FROM players`);
    const intentionCount = await dataSource.query(`SELECT COUNT(*) as cnt FROM intentions`);

    console.log(`\n${CYAN}${BOLD}  🔎 匹配前诊断${RESET}`);
    console.log(`${DIM}  ${'─'.repeat(60)}${RESET}`);
    console.log(`  ${BLUE}当前时间:${RESET}        ${new Date().toLocaleString('zh-CN', TZ_OPTS)}`);
    console.log(`  ${BLUE}匹配引擎截止线:${RESET}  ${oneHourLater.toLocaleString('zh-CN', TZ_OPTS)} (start_time 必须 > 此值)`);
    console.log(`  ${BLUE}Bot 意向时间:${RESET}    ${startTime2h.toLocaleString('zh-CN', TZ_OPTS)}`);
    console.log(`  ${BLUE}时间余量:${RESET}        ${Math.round((startTime2h.getTime() - oneHourLater.getTime()) / 60000)} 分钟`);
    console.log(`${DIM}  ${'─'.repeat(60)}${RESET}`);
    console.log(`  ${BLUE}DB 连接:${RESET}      ${dbInfo[0]?.db} / schema=${dbInfo[0]?.schema} / host=${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
    console.log(`  ${BLUE}DB 表计数:${RESET}  users=${userCount[0]?.cnt}, players=${playerCount[0]?.cnt}, intentions=${intentionCount[0]?.cnt}`);
    console.log(`${DIM}  ${'─'.repeat(60)}${RESET}`);

    if (allIntentions.length === 0) {
      console.log(`  ${YELLOW}⚠️  数据库中无任何意向记录！${RESET}`);
      console.log(`  ${YELLOW}   Bot 意向可能未实际写入 DB，请检查后端日志${RESET}`);
    } else {
      const pending = allIntentions.filter((i: any) => i.status === 'pending');
      const passFilter = allIntentions.filter((i: any) => i.status === 'pending' && new Date(i.start_time) > oneHourLater);
      // 状态分布统计
      const statusCounts: Record<string, number> = {};
      allIntentions.forEach((i: any) => { statusCounts[i.status] = (statusCounts[i.status] || 0) + 1; });
      const statusStr = Object.entries(statusCounts).map(([s, c]) => `${s}=${c}`).join(', ');
      console.log(`  ${BLUE}意向总数:${RESET}        ${allIntentions.length} 个 (${statusStr})`);
      console.log(`  ${BLUE}pending 状态:${RESET}    ${pending.length} 个`);
      console.log(`  ${BLUE}能通过时间过滤:${RESET}  ${passFilter.length} 个 (pending 且 start_time > 截止线)`);
      console.log(`${DIM}  ${'─'.repeat(60)}${RESET}`);
      for (const i of allIntentions) {
        const isPending = i.status === 'pending';
        const passesFilter = isPending && new Date(i.start_time) > oneHourLater;
        const icon = passesFilter ? `${GREEN}✓${RESET}` : isPending ? `${YELLOW}~${RESET}` : `${RED}✗${RESET}`;
        const st = new Date(i.start_time).toLocaleString('zh-CN', TZ_OPTS);
        console.log(`    ${icon} id=${i.id} ${i.nickname || 'player_' + i.player_id}  status=${i.status}  time=${st}  region=${i.region_code || 'null'}`);
      }
      if (passFilter.length < 6) {
        console.log(`\n  ${YELLOW}⚠️  能通过过滤的意向 < 6 个（3v3 需要 6 人），可能无法创建比赛${RESET}`);
      }
    }
    console.log(`${DIM}  ${'─'.repeat(60)}${RESET}\n`);

    // ═══════════════════════════════════════════════════════════
    // Phase 5: 触发匹配引擎
    // ═══════════════════════════════════════════════════════════
    console.log(`\n${CYAN}${BOLD}  🔄 正在触发匹配引擎...${RESET}`);
    const matchingResult = await runMatchingPhase(appContext, dbTools, metrics, report);

    if (matchingResult.matchesCreated === 0) {
      console.log(`\n${YELLOW}  ⚠️  匹配引擎未创建比赛。可能原因：${RESET}`);
      console.log(`     - 真人的意向时间/赛制与 Bot 不一致`);
      console.log(`     - 真人未成功创建意向`);
      console.log(`     请检查 Mobile App "我的意向" 页面确认意向状态\n`);

      const shouldContinue = await interactive.askYesNo('是否继续（跳过确认/消息/反馈阶段）？', true);
      if (!shouldContinue) {
        throw new Error('用户中止测试');
      }
    }

    // ═══════════════════════════════════════════════════════════
    // ⏸️  真人操作时间：确认比赛
    // ═══════════════════════════════════════════════════════════
    if (matchingResult.matchesCreated > 0) {
      console.log(`\n${GREEN}  ✅ 匹配成功！创建了 ${matchingResult.matchesCreated} 场比赛${RESET}`);
      console.log(`  比赛 ID: ${matchingResult.matchIds.join(', ')}\n`);

      await interactive.pauseForHuman(' 确认比赛（Mobile App）', [
        {
          step: 1,
          description: '在 Mobile App 首页，点击 "我的比赛"',
          example: '首页 → 我的比赛',
        },
        {
          step: 2,
          description: '点击比赛查看详情',
          example: `比赛 ID: ${matchingResult.matchIds.join(', ')}`,
        },
        {
          step: 3,
          description: '点击 "确认参赛" 按钮',
          example: '确认后会显示订单号和保证金信息',
        },
        {
          step: 4,
          description: '也可以查看群聊消息',
          example: '比赛详情页 → 群聊',
        },
      ]);

      // ═══════════════════════════════════════════════════════════
      // Phase 6: Bot 确认比赛
      // ═══════════════════════════════════════════════════════════
      await runConfirmationPhase(
        players, human, matchingResult.matchIds, apiClient, metrics, report, interactive, dbTools,
      );

      // ═══════════════════════════════════════════════════════════
      // 筛选成功预定场地的比赛（仅对 confirmed/in_progress/completed 执行后续测试）
      // ═══════════════════════════════════════════════════════════
      const confirmedMatchIds: number[] = [];
      for (const matchId of matchingResult.matchIds) {
        const status = await dbTools.getMatchStatus(matchId);
        if (['confirmed', 'in_progress', 'completed'].includes(status)) {
          confirmedMatchIds.push(matchId);
        }
      }
      report.printInfo('可用比赛', `${confirmedMatchIds.length}/${matchingResult.matchIds.length} 场已确认场地`);

      if (confirmedMatchIds.length === 0) {
        report.printWarning('无可用比赛', '所有比赛场地预订失败，跳过群聊/反馈/通知测试');
      } else {
        // ═══════════════════════════════════════════════════════════
        // Phase 7: 群聊消息（仅对可用比赛）
        // ═══════════════════════════════════════════════════════════
        await runMessagingPhase(
          players, human, confirmedMatchIds, apiClient, metrics, report, interactive, dbTools,
        );

        // ═══════════════════════════════════════════════════════════
        // ⏸️  真人操作时间：提交反馈
        // ═══════════════════════════════════════════════════════════
        // 先将可用比赛推进到 completed 状态
        for (const matchId of confirmedMatchIds) {
          await dbTools.setMatchCompleted(matchId);
        }

        await interactive.pauseForHuman(' 提交赛后反馈（Mobile App）', [
          {
            step: 1,
            description: '比赛已结束，在 Mobile App 查看比赛详情',
            example: '首页 → 我的比赛 → 详情',
          },
          {
            step: 2,
            description: '（可选）在群聊中发送消息',
            example: '比赛详情页 → 群聊',
          },
          {
            step: 3,
            description: '查看是否收到比赛相关通知',
            example: '通知中心',
          },
        ]);

        // ═══════════════════════════════════════════════════════════
        // Phase 8: Bot 提交反馈（仅对可用比赛）
        // ═══════════════════════════════════════════════════════════
        await runFeedbackPhase(
          players, human, confirmedMatchIds, apiClient, metrics, report, interactive, dbTools,
        );

        // ═══════════════════════════════════════════════════════════
        // Phase 9: 通知验证（仅对可用比赛）
        // ═══════════════════════════════════════════════════════════
        await runNotificationPhase(
          players, human, confirmedMatchIds, dataSource, metrics, report,
        );

        // ═══════════════════════════════════════════════════════════
        // Phase 10: 能力值专项验证（仅对可用比赛）
        // ═══════════════════════════════════════════════════════════
        const { runAbilityVerificationPhase } = await import('./phase-10-ability-verification');
        await runAbilityVerificationPhase(
          confirmedMatchIds, dataSource, metrics, report, dbTools,
        );
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Phase 11: SQL 完整性校验
    // ═══════════════════════════════════════════════════════════
    await runIntegrityPhase(dataSource, metrics, report);

    // ═══════════════════════════════════════════════════════════
    // 生成报告
    // ═══════════════════════════════════════════════════════════
    const reportPath = await report.writeReport('humanDriven', metrics);
    console.log(`\n${GREEN}${BOLD}  📄 测试报告: ${reportPath}${RESET}`);

    // 清理选项
    const shouldClean = await interactive.askYesNo('\n  是否清理测试数据？', false);
    if (shouldClean) {
      await dbTools.truncateAll();
      console.log(`  ${GREEN}✅ 测试数据已清理${RESET}`);
    } else {
      console.log(`  ${YELLOW}数据已保留，可在 Mobile App 继续浏览查看${RESET}`);
    }

  } catch (err: any) {
    console.error(`\n${YELLOW}❌ 测试执行失败: ${err.message}${RESET}`);
    if (err.stack) console.error(err.stack);
    try {
      const reportPath = await report.writeReport('humanDriven-failed', metrics);
      console.log(`  ${YELLOW}📄 部分报告: ${reportPath}${RESET}`);
    } catch { /* ignore */ }
  } finally {
    interactive.close();
  }
}
