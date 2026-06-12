/**
 * Phase 6: 比赛确认 + 支付 + 真人暂停点
 */

import { ApiClient } from '../api-client';
import { BotContext } from '../helpers/bot-context';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { InteractivePrompt } from '../interactive';
import { DbTools } from '../helpers/db-tools';
import { API_BASE_URL } from '../config';

export async function runConfirmationPhase(
  players: BotContext[],
  human: BotContext,
  matchIds: number[],
  apiClient: ApiClient,
  metrics: MetricsCollector,
  report: ReportGenerator,
  interactive: InteractivePrompt,
  dbTools: DbTools,
): Promise<void> {
  report.startPhase('Phase 6: 比赛确认 + 支付');

  if (matchIds.length === 0) {
    report.printWarning('无比赛', '跳过确认阶段');
    report.endPhase();
    return;
  }

  // 构建 playerId → bot 映射（TypeORM bigint 列可能返回 string，统一转为 Number）
  const playerBotMap = new Map<number, BotContext>();
  for (const bot of players) {
    if (bot.playerId) playerBotMap.set(Number(bot.playerId), bot);
  }
  // 加入真人
  if (human.playerId) playerBotMap.set(Number(human.playerId), human);

  for (const matchId of matchIds) {
    report.printDivider();
    report.printInfo('比赛', `matchId=${matchId}`);

    // 获取参赛球员
    const matchPlayers = await dbTools.getMatchPlayers(matchId);
    report.printInfo('参赛球员', `${matchPlayers.length} 人`);

    // ─── 6.1 Bot 确认参赛 ───
    const botPlayers = matchPlayers
      .map((mp) => ({ mp, bot: playerBotMap.get(Number(mp.player_id)) }))
      .filter((x) => x.bot && x.bot.accessToken && x.mp.status === 'invited');

    report.printInfo('步骤 6.1', `${botPlayers.length} 个 bot 确认参赛`);

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

    // ─── 6.2 ⏸️ 真人确认（如果真人在这场比赛中）───
    const humanInMatch = matchPlayers.find((mp) => human.playerId && Number(mp.player_id) === human.playerId);
    if (humanInMatch && human.accessToken) {
      await interactive.pauseForHuman(`请确认比赛 matchId=${matchId}`, [
        {
          step: 1,
          description: '确认参赛',
          example: `POST ${API_BASE_URL}/matches/${matchId}/confirm\n     Headers: Authorization: Bearer <your_token>`,
        },
      ]);
    }

    // ─── 6.3 边界: 重复确认幂等 ───
    if (botPlayers.length > 0) {
      report.printInfo('步骤 6.3', '边界: 重复确认幂等性');

      const firstBot = botPlayers[0].bot!;
      const api = apiClient.clone();
      api.setTokens(firstBot.accessToken!, firstBot.refreshToken!);

      const idempotentResult = await (async () => {
        try {
          const result = await api.confirmMatch(matchId);
          return { success: true, message: result?.message || '返回成功（幂等）', alreadyConfirmed: result?.alreadyConfirmed };
        } catch (err: any) {
          return { success: false, message: err.message };
        }
      })();

      if (idempotentResult.success) {
        report.addSuccess('重复确认幂等', idempotentResult.message);
      } else {
        // 后端选择拒绝而非幂等返回也是合理的行为
        report.addSuccess('重复确认拦截', idempotentResult.message);
      }
    }

    // ─── 6.4 边界: 1 人拒绝参赛（如果有足够多的人） ───
    if (botPlayers.length > 2) {
      report.printInfo('步骤 6.4', '边界: 1 人拒绝参赛');

      const lastBot = botPlayers[botPlayers.length - 1].bot!;
      const api = apiClient.clone();
      api.setTokens(lastBot.accessToken!, lastBot.refreshToken!);

      const declineResult = await (async () => {
        try {
          await api.declineMatch(matchId);
          return { success: true, message: '拒绝成功' };
        } catch (err: any) {
          // 如果已经确认了就不能拒绝
          return { success: false, message: err.message };
        }
      })();

      // 注意: 已确认的球员拒绝可能失败，这是正确的行为
      report.addSuccess('拒绝参赛', declineResult.message);
    }
  }

  report.endPhase();
}
