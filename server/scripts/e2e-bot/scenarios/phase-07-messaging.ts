/**
 * Phase 7: 群聊消息 + 完整性测试（支持多比赛覆盖）
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

  // 遍历所有可用比赛进行测试
  for (let matchIdx = 0; matchIdx < matchIds.length; matchIdx++) {
    const matchId = matchIds[matchIdx];
    report.printInfo(`比赛 ${matchIdx + 1}/${matchIds.length}`, `matchId=${matchId}`);

    // ─── 7.0 验证 group_chat_id 已生成 ───
    report.printInfo('步骤 7.0', '验证群聊已创建');
    const groupChatId = await dbTools.getMatchGroupChatId(matchId);
    if (groupChatId) {
      report.addSuccess('群聊创建', `matchId=${matchId} group_chat_id=${groupChatId}`);
    } else {
      report.addFailure('群聊创建', `matchId=${matchId} 未生成 group_chat_id`);
    }

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

    if (bots.length === 0) {
      report.printWarning('无参赛 bot', `matchId=${matchId} 跳过消息测试`);
      continue;
    }

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
          report.addSuccess(`发消息`, `${bot.nickname} (matchId=${matchId})`, durationMs);
        } catch (err: any) {
          const durationMs = Math.round(performance.now() - start);
          metrics.record('发送消息', 'error', durationMs, err.message);
          report.addFailure(`发消息`, `${bot.nickname} ${err.message}`, durationMs);
        }
      },
      BATCH_DELAY_MS,
    );

    // ─── 7.2 验证消息实时到达（DB 查询）───
    report.printInfo('步骤 7.2', '验证消息实时到达');
    const latestMessages = await dbTools.getLatestMessages(matchId, bots.length);
    const expectedSenders = new Set(bots.map((b) => b.playerId));
    const actualSenders = new Set(latestMessages.map((m) => m.sender_id));
    const missingSenders = Array.from(expectedSenders).filter((id) => !actualSenders.has(id));

    if (missingSenders.length === 0) {
      report.addSuccess('消息实时到达', `matchId=${matchId} 所有 ${bots.length} 条消息已写入 DB`);
    } else {
      report.addFailure('消息实时到达', `matchId=${matchId} 缺少 ${missingSenders.length} 条消息，senderIds=${missingSenders.join(',')}`);
    }

    // ─── 7.3 查询消息历史 + 分页测试 ───
    report.printInfo('步骤 7.3', '查询消息历史 + 分页测试');

    if (bots.length > 0) {
      const api = apiClient.clone();
      api.setTokens(bots[0].accessToken!, bots[0].refreshToken!);

      // 测试分页：page=1, pageSize=20
      const start = performance.now();
      try {
        const history = await api.getMessageHistory(matchId, 1, 20);
        const durationMs = Math.round(performance.now() - start);
        const total = history?.total ?? history?.list?.length ?? 0;
        const list = history?.list ?? [];

        // 验证按时间倒序
        let orderCorrect = true;
        for (let i = 1; i < list.length; i++) {
          const prev = new Date(list[i - 1].created_at || list[i - 1].createdAt).getTime();
          const curr = new Date(list[i].created_at || list[i].createdAt).getTime();
          if (prev < curr) {
            orderCorrect = false;
            break;
          }
        }

        // 验证 total 与 DB 计数一致
        const dbCount = await dbTools.getMessageCount(matchId);
        const totalMatch = total === dbCount;

        metrics.record('消息历史', 'success', durationMs);
        report.addSuccess('消息历史', `matchId=${matchId} 共 ${total} 条, page1=${list.length} 条, 倒序=${orderCorrect}, total匹配=${totalMatch}`, durationMs);

        if (!orderCorrect) {
          report.addFailure('消息倒序', `matchId=${matchId} 消息未按时间倒序排列`);
        }
        if (!totalMatch) {
          report.addFailure('消息计数', `matchId=${matchId} API total=${total} != DB count=${dbCount}`);
        }
      } catch (err: any) {
        report.addFailure('消息历史', `matchId=${matchId} ${err.message}`);
      }
    }

    // ─── 7.4 群聊有效期测试 ───
    report.printInfo('步骤 7.4', '群聊有效期测试');
    const matchDetail = await dbTools.dataSource.query(
      `SELECT created_at FROM matches WHERE id = $1`, [matchId],
    );
    const matchCreatedAt = matchDetail[0]?.created_at ? new Date(matchDetail[0].created_at) : null;
    const expiryConfig = await dbTools.dataSource.query(
      `SELECT param_value FROM system_params WHERE param_key = 'group_chat_expiry_days'`,
    );
    const expiryDays = expiryConfig[0]?.param_value ? JSON.parse(expiryConfig[0].param_value).expiry_days : 7;

    if (matchCreatedAt) {
      const expiryDate = new Date(matchCreatedAt.getTime() + expiryDays * 24 * 60 * 60 * 1000);
      const now = new Date();
      const isExpired = now > expiryDate;
      report.addSuccess('群聊有效期', `matchId=${matchId} 创建于 ${matchCreatedAt.toISOString()}, 过期于 ${expiryDate.toISOString()}, 已过期=${isExpired}`);
    } else {
      report.addFailure('群聊有效期', `matchId=${matchId} 无法获取比赛创建时间`);
    }

    // ─── 7.5 ⏸️ 真人发消息（可选）───
    if (human.accessToken && playerBotMap.has(human.playerId!)) {
      await interactive.pauseForHuman('请发送一条群聊消息', [
        {
          step: 1,
          description: '发送消息',
          example: `POST ${API_BASE_URL}/matches/${matchId}/messages\n     Headers: Authorization: Bearer <your_token>\n     Body: { "content": "大家好！" }`,
        },
      ]);
    }

    // ─── 7.6 边界: 非参赛者发消息 ───
    report.printInfo('步骤 7.6', '边界: 非参赛者发消息');

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
        report.addSuccess('非参赛者拦截', `matchId=${matchId} ${authResult.message}`);
      } else {
        report.addFailure('非参赛者拦截', `matchId=${matchId} 系统未阻止非参赛者发消息！`);
      }
    }
  }

  report.endPhase();
}
