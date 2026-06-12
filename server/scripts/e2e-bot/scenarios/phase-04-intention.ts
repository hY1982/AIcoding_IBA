/**
 * Phase 4: 意向提交 + 真人暂停点
 */

import { ApiClient, CreateIntentionPayload } from '../api-client';
import { BotContext } from '../helpers/bot-context';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { InteractivePrompt } from '../interactive';
import { DbTools } from '../helpers/db-tools';
import { ScenarioDefinition } from './scenario-definitions';
import { runBatch, safeBotRun } from '../helpers/safe-runner';
import { BATCH_SIZE_INTENTION, BATCH_DELAY_MS, API_BASE_URL } from '../config';

function getFutureTime(hoursAhead: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hoursAhead);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

export async function runIntentionPhase(
  players: BotContext[],
  venueManagers: BotContext[],
  human: BotContext,
  apiClient: ApiClient,
  metrics: MetricsCollector,
  report: ReportGenerator,
  interactive: InteractivePrompt,
  dbTools: DbTools,
  scenario: ScenarioDefinition,
): Promise<{ venueId: number; formatId: number; startTime: string }> {
  report.startPhase('Phase 4: 意向提交');

  // 获取可用场地和赛制
  const venues = venueManagers.filter((vm) => vm.venueId);
  const primaryVenueId = venues[0]?.venueId || 1;
  const formats = await dbTools.getFormats();
  const formatId = formats.length > 0 ? formats[0].id : 1;
  const startTime = getFutureTime(scenario.startTimeHoursAhead);

  report.printInfo('主力场地', `venueId=${primaryVenueId}`);
  report.printInfo('赛制', `formatId=${formatId} (${formats[0]?.name || 'unknown'})`);
  report.printInfo('比赛时间', `${startTime} (${scenario.durationMinutes}分钟)`);

  // ─── 4.1 Bot 球员提交意向 ───
  const eligiblePlayers = players.filter((b) => b.playerId && b.accessToken);
  report.printInfo('步骤 4.1', `${eligiblePlayers.length} 个球员提交意向`);

  await runBatch(
    eligiblePlayers,
    BATCH_SIZE_INTENTION,
    async (bot) => {
      const api = apiClient.clone();
      api.setTokens(bot.accessToken!, bot.refreshToken!);

      // 每个球员用稍微不同的时间避免"同天只能1个pending"限制
      // 所有球员使用相同的起始时间，确保匹配引擎能将他们分到同一组
      const botStartTime = getFutureTime(scenario.startTimeHoursAhead);

      const payload: CreateIntentionPayload = {
        startTime: botStartTime,
        durationMinutes: scenario.durationMinutes,
        acceptableWaitMinutes: 30,
        venueIds: [{ venueId: primaryVenueId, priority: 1 }],
        formatIds: [{ formatId, priority: 1 }],
      };

      const result = await safeBotRun(bot, '意向', `提交-${bot.nickname}`, async () => {
        const intention = await api.createIntention(payload);
        bot.intentionId = intention?.id;
        bot.intentionStartTime = botStartTime;
        return intention;
      }, metrics);

      if (result.success) {
        report.addSuccess(`意向提交`, `${bot.nickname} intentionId=${bot.intentionId}`, result.durationMs);
      }
    },
    BATCH_DELAY_MS,
  );

  // ─── 4.2 边界: 时间重叠 ───
  report.printInfo('步骤 4.2', '边界: 意向时间重叠');

  const firstPlayer = eligiblePlayers[0];
  if (firstPlayer?.accessToken) {
    const api = apiClient.clone();
    api.setTokens(firstPlayer.accessToken!, firstPlayer.refreshToken!);

    const overlapResult = await (async () => {
      try {
        await api.createIntention({
          startTime, // 与刚才提交的意向同时间
          durationMinutes: scenario.durationMinutes,
          acceptableWaitMinutes: 30,
          venueIds: [{ venueId: primaryVenueId, priority: 1 }],
          formatIds: [{ formatId, priority: 1 }],
        });
        return { caught: false, message: '未拦截' };
      } catch (err: any) {
        return { caught: true, message: err.message };
      }
    })();

    if (overlapResult.caught) {
      report.addSuccess('时间重叠拦截', overlapResult.message);
    } else {
      report.addFailure('时间重叠拦截', '系统未阻止时间重叠！');
    }
  }

  // ─── 4.3 边界: 过早开赛 ───
  report.printInfo('步骤 4.3', '边界: 过早开赛检测');

  const earlyPlayer = eligiblePlayers[1] || eligiblePlayers[0];
  if (earlyPlayer?.accessToken) {
    const api = apiClient.clone();
    api.setTokens(earlyPlayer.accessToken!, earlyPlayer.refreshToken!);

    const earlyResult = await (async () => {
      try {
        const earlyTime = new Date(Date.now() + 30 * 60 * 1000); // 30分钟后
        await api.createIntention({
          startTime: earlyTime.toISOString(),
          durationMinutes: 120,
          venueIds: [{ venueId: primaryVenueId, priority: 1 }],
          formatIds: [{ formatId, priority: 1 }],
        });
        return { caught: false, message: '未拦截' };
      } catch (err: any) {
        return { caught: true, message: err.message };
      }
    })();

    if (earlyResult.caught) {
      report.addSuccess('过早开赛拦截', earlyResult.message);
    } else {
      report.addFailure('过早开赛拦截', '系统未阻止过早开赛！');
    }
  }

  // ─── 4.4 ⏸️ 真人操作 ───
  const humanToken = human.accessToken || '(请先登录获取)';
  const intentionCount = players.filter((p) => p.intentionId).length;

  await interactive.pauseForHuman('请提交你的比赛意向', [
    { step: 1, description: '打开 Postman / curl / 前端 App' },
    {
      step: 2,
      description: '登录获取 Token',
      example: `POST ${API_BASE_URL}/auth/login\n     Body: { "phone": "${human.phone}", "password": "${human.password}" }`,
    },
    {
      step: 3,
      description: '提交意向（与 bot 相同的场地和时间段）',
      example: `POST ${API_BASE_URL}/intentions\n     Headers: Authorization: Bearer <your_token>\n     Body: {\n       "startTime": "${startTime}",\n       "durationMinutes": ${scenario.durationMinutes},\n       "acceptableWaitMinutes": 30,\n       "venueIds": [{"venueId": ${primaryVenueId}, "priority": 1}],\n       "formatIds": [{"formatId": ${formatId}, "priority": 1}]\n     }`,
    },
    { step: 4, description: `当前已有 ${intentionCount} 个 bot 提交了意向` },
  ]);

  // 汇总
  report.printInfo('意向汇总', `${intentionCount} 个 bot 已提交意向，准备触发匹配`);

  report.endPhase();

  return { venueId: primaryVenueId, formatId, startTime };
}
