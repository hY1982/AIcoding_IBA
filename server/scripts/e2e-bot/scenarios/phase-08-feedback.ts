/**
 * Phase 8: 赛后反馈 + 能力调节值（支持多比赛覆盖 + DB 验证）
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

  // 遍历所有可用比赛进行测试
  for (let matchIdx = 0; matchIdx < matchIds.length; matchIdx++) {
    const matchId = matchIds[matchIdx];
    report.printInfo(`比赛 ${matchIdx + 1}/${matchIds.length}`, `matchId=${matchId}`);

    // 手动推进比赛状态到 completed
    report.printInfo('步骤 8.0', '推进比赛状态 → completed');
    try {
      await dbTools.setMatchCompleted(matchId);
      report.addSuccess('状态推进', `matchId=${matchId} → completed`);
    } catch (err: any) {
      report.addFailure('状态推进', `matchId=${matchId} ${err.message}`);
      continue;
    }

    // 获取 confirmed 球员
    const matchPlayers = await dbTools.getMatchPlayers(matchId);
    const confirmedPlayers = matchPlayers.filter((mp) => mp.status === 'confirmed');
    report.printInfo('已确认球员', `${confirmedPlayers.length} 人`);

    if (confirmedPlayers.length === 0) {
      report.printWarning('无确认球员', `matchId=${matchId} 跳过反馈测试`);
      continue;
    }

    // 构建 playerId → bot 映射
    const playerBotMap = new Map<number, BotContext>();
    for (const bot of [...players, human]) {
      if (bot.playerId) playerBotMap.set(bot.playerId, bot);
    }

    const confirmedBots = confirmedPlayers
      .map((mp) => playerBotMap.get(Number(mp.player_id)))
      .filter((b): b is BotContext => !!b && !!b.accessToken);

    const confirmedPlayerIds = confirmedPlayers.map((mp) => Number(mp.player_id));

    // ─── 8.0a 记录反馈前能力值 ───
    report.printInfo('步骤 8.0a', '记录反馈前能力值');
    const abilityBefore = new Map<number, { base: number; adjust: number; total: number }>();
    for (const playerId of confirmedPlayerIds) {
      const ability = await dbTools.getPlayerAbilityScores(playerId);
      if (ability) {
        abilityBefore.set(playerId, {
          base: ability.baseAbilityScore,
          adjust: ability.matchAdjustValue,
          total: ability.totalAbilityScore,
        });
      }
    }
    report.addSuccess('能力值记录', `matchId=${matchId} 已记录 ${abilityBefore.size} 人反馈前能力值`);

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
          report.addSuccess(`提交反馈`, `${bot.nickname} (matchId=${matchId}) 评价了 ${otherPlayerIds.length} 人`, durationMs);
        } catch (err: any) {
          const durationMs = Math.round(performance.now() - start);
          metrics.record('提交反馈', 'error', durationMs, err.message);
          report.addFailure(`提交反馈`, `${bot.nickname} ${err.message}`, durationMs);
        }
      },
      BATCH_DELAY_MS,
    );

    // ─── 8.2 DB 验证：feedbacks 表记录 ───
    report.printInfo('步骤 8.2', '验证 feedbacks 表记录');
    const feedbackRecords = await dbTools.getFeedbackRecords(matchId);
    const expectedFeedbackCount = confirmedBots.length;
    if (feedbackRecords.length === expectedFeedbackCount) {
      report.addSuccess('反馈记录', `matchId=${matchId} feedbacks 表 ${feedbackRecords.length} 条记录（预期 ${expectedFeedbackCount}）`);
    } else {
      report.addFailure('反馈记录', `matchId=${matchId} feedbacks 表 ${feedbackRecords.length} 条记录（预期 ${expectedFeedbackCount}）`);
    }

    // ─── 8.3 DB 验证：feedback_player_ratings 关联记录 ───
    report.printInfo('步骤 8.3', '验证 feedback_player_ratings 关联记录');
    let totalRatings = 0;
    for (const feedback of feedbackRecords) {
      const ratings = await dbTools.getFeedbackPlayerRatings(feedback.id);
      totalRatings += ratings.length;
    }
    // 每个反馈评价其他 (confirmedPlayers - 1) 人
    const expectedRatings = confirmedBots.length * (confirmedPlayerIds.length - 1);
    if (totalRatings === expectedRatings) {
      report.addSuccess('评分关联', `matchId=${matchId} feedback_player_ratings ${totalRatings} 条记录（预期 ${expectedRatings}）`);
    } else {
      report.addFailure('评分关联', `matchId=${matchId} feedback_player_ratings ${totalRatings} 条记录（预期 ${expectedRatings}）`);
    }

    // ─── 8.4 DB 验证：能力值更新 ───
    report.printInfo('步骤 8.4', '验证能力值更新');
    let abilityUpdateCount = 0;
    let abilityUpdateErrors = 0;
    let adjustOutOfRange = 0;

    for (const playerId of confirmedPlayerIds) {
      const abilityAfter = await dbTools.getPlayerAbilityScores(playerId);
      const before = abilityBefore.get(playerId);

      if (!abilityAfter || !before) {
        abilityUpdateErrors++;
        continue;
      }

      // 验证 total = base + adjust
      const calculatedTotal = abilityAfter.baseAbilityScore + abilityAfter.matchAdjustValue;
      const totalMatch = Math.abs(calculatedTotal - abilityAfter.totalAbilityScore) < 0.01;

      // 验证 adjust 范围 [-50, 50]
      const adjustInRange = abilityAfter.matchAdjustValue >= -50 && abilityAfter.matchAdjustValue <= 50;
      if (!adjustInRange) adjustOutOfRange++;

      if (totalMatch && adjustInRange) {
        abilityUpdateCount++;
      } else {
        abilityUpdateErrors++;
        if (!totalMatch) {
          report.addFailure('能力值计算', `playerId=${playerId} total=${abilityAfter.totalAbilityScore} != base+adjust=${calculatedTotal}`);
        }
        if (!adjustInRange) {
          report.addFailure('能力值范围', `playerId=${playerId} adjust=${abilityAfter.matchAdjustValue} 超出 [-50, 50]`);
        }
      }
    }

    report.addSuccess('能力值更新', `matchId=${matchId} ${abilityUpdateCount}/${confirmedPlayerIds.length} 人验证通过, 错误 ${abilityUpdateErrors}, 范围越界 ${adjustOutOfRange}`);

    // ─── 8.5 数据隔离验证：未参与比赛球员能力值无变化 ───
    report.printInfo('步骤 8.5', '验证数据隔离');
    const allPlayerIds = players.map((b) => b.playerId).filter((id): id is number => !!id);
    const nonMatchPlayerIds = allPlayerIds.filter((id) => !confirmedPlayerIds.includes(id));
    let isolationPass = 0;
    let isolationFail = 0;

    for (const playerId of nonMatchPlayerIds.slice(0, 10)) { // 抽样检查前 10 个
      const ability = await dbTools.getPlayerAbilityScores(playerId);
      // 未参与比赛的球员 match_adjust_value 应该为 0（或不变）
      if (ability && ability.matchAdjustValue === 0) {
        isolationPass++;
      } else if (ability) {
        isolationFail++;
        report.addFailure('数据隔离', `playerId=${playerId} 未参与比赛但 adjust=${ability?.matchAdjustValue}`);
      }
    }
    report.addSuccess('数据隔离', `matchId=${matchId} 抽样 ${nonMatchPlayerIds.slice(0, 10).length} 人, 通过 ${isolationPass}, 失败 ${isolationFail}`);

    // ─── 8.6 ⏸️ 真人反馈（可选）───
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

    // ─── 8.7 边界: 重复提交 ───
    report.printInfo('步骤 8.7', '边界: 重复提交反馈');

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
        report.addSuccess('重复反馈拦截', `matchId=${matchId} ${dupResult.message}`);
      } else {
        report.addFailure('重复反馈拦截', `matchId=${matchId} 系统未阻止重复提交！`);
      }
    }
  }

  report.endPhase();
}
