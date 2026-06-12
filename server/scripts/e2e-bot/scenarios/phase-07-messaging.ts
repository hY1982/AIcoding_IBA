/**
 * Phase 7: 群聊消息 + 边界测试
 */

import { ApiClient } from '../api-client';
import { BotContext } from '../helpers/bot-context';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { InteractivePrompt } from '../interactive';
import { DbTools } from '../helpers/db-tools';
import { runBatch } from '../helpers/safe-runner';
import { BATCH_SIZE_MESSAGE, BATCH_DELAY_MS, API_BASE_URL } from '../config';

export async function runMessagingPhase(
  players: BotContext[],
  human: BotContext,
  matchIds: number[],
  apiClient: ApiClient,
  metrics: MetricsCollector,
  report: ReportGenerator,
  interactive: InteractivePrompt,
  dbTools: DbTools,
): Promise<void> {
  report.startPhase('Phase 7: 群聊消息');

  if (matchIds.length === 0) {
    report.printWarning('无比赛', '跳过消息阶段');
    report.endPhase();
    return;
  }

  const matchId = matchIds[0];

  // 构建参赛 bot 列表
  const matchPlayerIds = (await dbTools.getMatchPlayers(matchId)).map((mp) => Number(mp.player_id));
  const playerBotMap = new Map<number, BotContext>();
  for (const bot of [...players, human]) {
    if (bot.playerId && matchPlayerIds.includes(bot.playerId) && bot.accessToken) {
      playerBotMap.set(bot.playerId, bot);
    }
  }

  const bots = Array.from(playerBotMap.values());
  report.printInfo('参赛 bot', `${bots.length} 人将发消息`);

  // ─── 7.1 Bot 发消息 ───
  await runBatch(
    bots,
    BATCH_SIZE_MESSAGE,
    async (bot) => {
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
    },
    BATCH_DELAY_MS,
  );

  // ─── 7.2 查询消息历史 ───
  report.printInfo('步骤 7.2', '查询消息历史');

  if (bots.length > 0) {
    const api = apiClient.clone();
    api.setTokens(bots[0].accessToken!, bots[0].refreshToken!);
    const start = performance.now();
    try {
      const history = await api.getMessageHistory(matchId, 1, 50);
      const durationMs = Math.round(performance.now() - start);
      const total = history?.total ?? history?.list?.length ?? 0;
      metrics.record('消息历史', 'success', durationMs);
      report.addSuccess('消息历史', `共 ${total} 条消息`, durationMs);
    } catch (err: any) {
      report.addFailure('消息历史', err.message);
    }
  }

  // ─── 7.3 ⏸️ 真人发消息（可选）───
  if (human.accessToken && playerBotMap.has(human.playerId!)) {
    await interactive.pauseForHuman('请发送一条群聊消息', [
      {
        step: 1,
        description: '发送消息',
        example: `POST ${API_BASE_URL}/matches/${matchId}/messages\n     Headers: Authorization: Bearer <your_token>\n     Body: { "content": "大家好！" }`,
      },
    ]);
  }

  // ─── 7.4 边界: 非参赛者发消息 ───
  report.printInfo('步骤 7.4', '边界: 非参赛者发消息');

  const nonParticipant = players.find(
    (b) => b.accessToken && b.playerId && !matchPlayerIds.includes(b.playerId),
  );
  if (nonParticipant) {
    const api = apiClient.clone();
    api.setTokens(nonParticipant.accessToken!, nonParticipant.refreshToken!);

    const authResult = await (async () => {
      try {
        await api.sendMessage(matchId, { content: '我不是参赛球员' });
        return { caught: false, message: '未拦截' };
      } catch (err: any) {
        return { caught: true, message: err.message };
      }
    })();

    if (authResult.caught) {
      report.addSuccess('非参赛者拦截', authResult.message);
    } else {
      report.addFailure('非参赛者拦截', '系统未阻止非参赛者发消息！');
    }
  }

  report.endPhase();
}
