/**
 * Phase 10: 压力测试（仅 fullStress 场景）
 *
 * A. 10 并发注册
 * B. 20 并发意向提交
 * C. 50 条连续消息
 * 收集 p50/p95/p99 延迟
 */

import { ApiClient, PlayerRegisterPayload } from '../api-client';
import { BotContext } from '../helpers/bot-context';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { PhoneGenerator } from '../helpers/phone-generator';
import { withTimeout } from '../helpers/safe-runner';
import {
  DEFAULT_REGION,
  STRESS_TIMEOUT_MS,
} from '../config';

export async function runStressPhase(
  players: BotContext[],
  matchIds: number[],
  apiClient: ApiClient,
  metrics: MetricsCollector,
  report: ReportGenerator,
): Promise<void> {
  report.startPhase('Phase 10: 压力测试');

  // ─── 10.A  10 并发注册 ───
  report.printInfo('步骤 10.A', '10 并发注册');

  const stressPhoneGen = new PhoneGenerator();
  stressPhoneGen.reset();

  const stressBots: BotContext[] = [];
  for (let i = 0; i < 10; i++) {
    stressBots.push({
      index: 9000 + i,
      role: 'player',
      phone: stressPhoneGen.generate(),
      password: 'StressTest123!',
      nickname: `压力测试_${i + 1}`,
      birthDate: '1998-06-15',
      startPlayingDate: '2015-03',
      gender: 'male',
      height: 180,
      weight: 75,
      wingspan: 188,
      standingReach: 232,
      jumpingReach: 315,
      positions: ['PG'],
      timings: {},
      errors: [],
    });
  }

  const stressStartA = performance.now();
  let successA = 0;
  let failA = 0;

  try {
    await withTimeout(
      Promise.all(
        stressBots.map(async (bot) => {
          const api = apiClient.clone();
          const payload: PlayerRegisterPayload = {
            phone: bot.phone,
            password: bot.password,
            nickname: bot.nickname,
            userType: 'player',
            birthDate: bot.birthDate!,
            startPlayingDate: bot.startPlayingDate!,
            gender: bot.gender!,
            height: bot.height!,
            regionCode: DEFAULT_REGION,
          };

          const start = performance.now();
          try {
            await api.register(payload);
            const durationMs = Math.round(performance.now() - start);
            metrics.record('压力-注册', 'success', durationMs);
            successA++;
          } catch (err: any) {
            const durationMs = Math.round(performance.now() - start);
            metrics.record('压力-注册', 'error', durationMs, err.message);
            failA++;
          }
        }),
      ),
      STRESS_TIMEOUT_MS,
      '压力注册',
    );
  } catch (err: any) {
    report.addFailure('压力-注册超时', err.message);
  }

  const durationA = Math.round(performance.now() - stressStartA);
  report.addResult(
    '10 并发注册',
    successA >= 8 ? 'PASS' : 'FAIL',
    durationA,
    `成功=${successA} 失败=${failA} 总耗时=${durationA}ms`,
  );

  // ─── 10.B  20 并发意向提交 ───
  report.printInfo('步骤 10.B', '20 并发意向提交');

  // 使用已有 playerId 的球员
  const eligiblePlayers = players.filter((b) => b.playerId && b.accessToken);
  const intentionBots = eligiblePlayers.slice(0, Math.min(20, eligiblePlayers.length));

  if (intentionBots.length === 0) {
    report.addSkip('压力-意向', '无可用球员');
  } else {
    const futureTime = new Date();
    futureTime.setHours(futureTime.getHours() + 8); // 足够远的未来
    futureTime.setMinutes(0, 0, 0);

    const stressStartB = performance.now();
    let successB = 0;
    let failB = 0;

    try {
      await withTimeout(
        Promise.all(
          intentionBots.map(async (bot, i) => {
            const api = apiClient.clone();
            api.setTokens(bot.accessToken!, bot.refreshToken!);

            // 每个 bot 使用不同的未来时间避免重叠
            const botTime = new Date(futureTime);
            botTime.setHours(botTime.getHours() + i);

            const start = performance.now();
            try {
              await api.createIntention({
                startTime: botTime.toISOString(),
                durationMinutes: 120,
                acceptableWaitMinutes: 30,
                venueIds: [{ venueId: 1, priority: 1 }],
                formatIds: [{ formatId: 1, priority: 1 }],
              });
              const durationMs = Math.round(performance.now() - start);
              metrics.record('压力-意向', 'success', durationMs);
              successB++;
            } catch (err: any) {
              const durationMs = Math.round(performance.now() - start);
              metrics.record('压力-意向', 'error', durationMs, err.message);
              failB++;
            }
          }),
        ),
        STRESS_TIMEOUT_MS,
        '压力意向',
      );
    } catch (err: any) {
      report.addFailure('压力-意向超时', err.message);
    }

    const durationB = Math.round(performance.now() - stressStartB);
    report.addResult(
      `${intentionBots.length} 并发意向`,
      successB >= Math.floor(intentionBots.length * 0.6) ? 'PASS' : 'FAIL',
      durationB,
      `成功=${successB} 失败=${failB} 总耗时=${durationB}ms`,
    );
  }

  // ─── 10.C  50 条连续消息 ───
  report.printInfo('步骤 10.C', '50 条连续消息');

  if (matchIds.length === 0) {
    report.addSkip('压力-消息', '无比赛可发消息');
  } else {
    const matchId = matchIds[0];
    const msgSenders = eligiblePlayers.filter((b) => b.playerId).slice(0, 5);

    if (msgSenders.length === 0) {
      report.addSkip('压力-消息', '无可用球员');
    } else {
      const stressStartC = performance.now();
      let successC = 0;
      let failC = 0;

      try {
        await withTimeout(
          (async () => {
            for (let batch = 0; batch < 10; batch++) {
              await Promise.all(
                msgSenders.map(async (bot) => {
                  const api = apiClient.clone();
                  api.setTokens(bot.accessToken!, bot.refreshToken!);

                  const start = performance.now();
                  try {
                    await api.sendMessage(matchId, {
                      content: `[压力测试] 消息 #${batch * 5 + msgSenders.indexOf(bot) + 1}`,
                      messageType: 'text',
                    });
                    const durationMs = Math.round(performance.now() - start);
                    metrics.record('压力-消息', 'success', durationMs);
                    successC++;
                  } catch (err: any) {
                    const durationMs = Math.round(performance.now() - start);
                    metrics.record('压力-消息', 'error', durationMs, err.message);
                    failC++;
                  }
                }),
              );
              await new Promise((r) => setTimeout(r, 50)); // 批次间 50ms
            }
          })(),
          STRESS_TIMEOUT_MS,
          '压力消息',
        );
      } catch (err: any) {
        report.addFailure('压力-消息超时', err.message);
      }

      const durationC = Math.round(performance.now() - stressStartC);
      report.addResult(
        '50 条连续消息',
        successC >= 40 ? 'PASS' : 'FAIL',
        durationC,
        `成功=${successC} 失败=${failC} 总耗时=${durationC}ms`,
      );
    }
  }

  // ─── 压力测试指标汇总 ───
  report.printDivider();
  report.printInfo('压力测试指标', '查看 metrics p50/p95/p99');

  const summary = metrics.getSummary();
  for (const label of ['压力-注册', '压力-意向', '压力-消息']) {
    const s = summary.scenarios[label];
    if (s) {
      report.addSuccess(
        `${label} 指标`,
        `avg=${s.timing.avg}ms p50=${s.timing.p50}ms p95=${s.timing.p95}ms p99=${s.timing.p99}ms (${s.success}/${s.total} 成功)`,
      );
    }
  }

  report.endPhase();
}
