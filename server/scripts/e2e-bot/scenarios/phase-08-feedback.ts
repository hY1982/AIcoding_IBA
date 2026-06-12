/**
 * Phase 8: 赛后反馈 + 能力调节值
 */

import { ApiClient, CreateFeedbackPayload } from '../api-client';
import { BotContext } from '../helpers/bot-context';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { InteractivePrompt } from '../interactive';
import { DbTools } from '../helpers/db-tools';
import { runBatch } from '../helpers/safe-runner';
import { BATCH_SIZE_FEEDBACK, BATCH_DELAY_MS, API_BASE_URL } from '../config';

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function runFeedbackPhase(
  players: BotContext[],
  human: BotContext,
  matchIds: number[],
  apiClient: ApiClient,
  metrics: MetricsCollector,
  report: ReportGenerator,
  interactive: InteractivePrompt,
  dbTools: DbTools,
): Promise<void> {
  report.startPhase('Phase 8: 赛后反馈');

  if (matchIds.length === 0) {
    report.printWarning('无比赛', '跳过反馈阶段');
    report.endPhase();
    return;
  }

  const matchId = matchIds[0];

  // 手动推进比赛状态到 completed
  report.printInfo('步骤 8.0', '推进比赛状态 → completed');
  try {
    await dbTools.setMatchCompleted(matchId);
    report.addSuccess('状态推进', `matchId=${matchId} → completed`);
  } catch (err: any) {
    report.addFailure('状态推进', err.message);
    report.endPhase();
    return;
  }

  // 获取 confirmed 球员
  const matchPlayers = await dbTools.getMatchPlayers(matchId);
  const confirmedPlayers = matchPlayers.filter((mp) => mp.status === 'confirmed');
  report.printInfo('已确认球员', `${confirmedPlayers.length} 人`);

  // 构建 playerId → bot 映射
  const playerBotMap = new Map<number, BotContext>();
  for (const bot of [...players, human]) {
    if (bot.playerId) playerBotMap.set(bot.playerId, bot);
  }

  const confirmedBots = confirmedPlayers
    .map((mp) => playerBotMap.get(Number(mp.player_id)))
    .filter((b): b is BotContext => !!b && !!b.accessToken);

  const confirmedPlayerIds = confirmedPlayers.map((mp) => Number(mp.player_id));

  // ─── 8.1 Bot 提交反馈 ───
  report.printInfo('步骤 8.1', `${confirmedBots.length} 个 bot 提交反馈`);

  await runBatch(
    confirmedBots,
    BATCH_SIZE_FEEDBACK,
    async (bot) => {
      const api = apiClient.clone();
      api.setTokens(bot.accessToken!, bot.refreshToken!);

      const otherPlayerIds = confirmedPlayerIds.filter((id) => id !== bot.playerId);
      if (otherPlayerIds.length === 0) return;

      const payload: CreateFeedbackPayload = {
        matchId,
        playerId: bot.playerId!,
        overallRating: 3 + Math.floor(Math.random() * 3), // 3-5
        overallReason: '精彩比赛！',
        playerRatings: otherPlayerIds.map((id) => ({
          ratedPlayerId: id,
          levelMatch: randomElement(['equal', 'higher', 'lower'] as const),
          sportsmanship: randomElement(['good', 'average'] as const),
          actionCleanliness: randomElement(['clean', 'average'] as const),
          isPunctual: Math.random() > 0.2,
        })),
      };

      const start = performance.now();
      try {
        await api.createFeedback(payload);
        const durationMs = Math.round(performance.now() - start);
        metrics.record('提交反馈', 'success', durationMs);
        bot.feedbackSubmitted = true;
        report.addSuccess(`提交反馈`, `${bot.nickname} 评价了 ${otherPlayerIds.length} 人`, durationMs);
      } catch (err: any) {
        const durationMs = Math.round(performance.now() - start);
        metrics.record('提交反馈', 'error', durationMs, err.message);
        report.addFailure(`提交反馈`, `${bot.nickname} ${err.message}`, durationMs);
      }
    },
    BATCH_DELAY_MS,
  );

  // ─── 8.2 ⏸️ 真人反馈（可选）───
  const humanInMatch = confirmedPlayers.find((mp) => human.playerId && Number(mp.player_id) === human.playerId);
  if (humanInMatch && human.accessToken) {
    const otherIds = confirmedPlayerIds.filter((id) => id !== human.playerId);
    await interactive.pauseForHuman('请提交赛后反馈', [
      {
        step: 1,
        description: '提交反馈',
        example: `POST ${API_BASE_URL}/feedbacks\n     Headers: Authorization: Bearer <your_token>\n     Body: {\n       "matchId": ${matchId}, "playerId": ${human.playerId},\n       "overallRating": 4, "overallReason": "好比赛",\n       "playerRatings": [${otherIds.slice(0, 2).map((id) => `{"ratedPlayerId":${id},"levelMatch":"equal","sportsmanship":"good"}`).join(',\n         ')}]\n     }`,
      },
    ]);
  }

  // ─── 8.3 边界: 重复提交 ───
  report.printInfo('步骤 8.3', '边界: 重复提交反馈');

  if (confirmedBots.length > 0) {
    const bot = confirmedBots[0];
    const api = apiClient.clone();
    api.setTokens(bot.accessToken!, bot.refreshToken!);

    const otherIds = confirmedPlayerIds.filter((id) => id !== bot.playerId);
    const dupResult = await (async () => {
      try {
        await api.createFeedback({
          matchId,
          playerId: bot.playerId!,
          overallRating: 5,
          playerRatings: otherIds.slice(0, 1).map((id) => ({
            ratedPlayerId: id,
            levelMatch: 'equal' as const,
          })),
        });
        return { caught: false, message: '未拦截' };
      } catch (err: any) {
        return { caught: true, message: err.message };
      }
    })();

    if (dupResult.caught) {
      report.addSuccess('重复反馈拦截', dupResult.message);
    } else {
      report.addFailure('重复反馈拦截', '系统未阻止重复提交！');
    }
  }

  report.endPhase();
}
