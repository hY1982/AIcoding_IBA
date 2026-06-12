/**
 * Phase 3: 球员档案更新 + 能力值验证
 */

import { ApiClient } from '../api-client';
import { BotContext } from '../helpers/bot-context';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { runBatch, safeBotRun } from '../helpers/safe-runner';
import { BATCH_SIZE_REGISTRATION, BATCH_DELAY_MS } from '../config';

export async function runPlayerProfilePhase(
  players: BotContext[],
  apiClient: ApiClient,
  metrics: MetricsCollector,
  report: ReportGenerator,
): Promise<void> {
  report.startPhase('Phase 3: 球员档案 + 能力值');

  // ─── 3.1 查询所有球员档案 ───
  report.printInfo('步骤 3.1', `查询 ${players.length} 个球员档案`);

  await runBatch(
    players,
    BATCH_SIZE_REGISTRATION,
    async (bot) => {
      if (!bot.accessToken) return;

      const api = apiClient.clone();
      api.setTokens(bot.accessToken!, bot.refreshToken!);

      const result = await safeBotRun(bot, '档案', `查询-${bot.nickname}`, async () => {
        const profile = await api.getPlayerProfile();
        if (profile) {
          bot.playerId = profile.id;
          bot.baseAbilityScore = profile.baseAbilityScore;
        }
        return profile;
      }, metrics);

      if (result.success && result.result) {
        const ability = result.result.baseAbilityScore;
        if (ability > 0) {
          report.addSuccess(`档案查询`, `${bot.nickname} ability=${ability}`, result.durationMs);
        } else {
          report.addFailure(`档案查询`, `${bot.nickname} ability=${ability} (应>0)`, result.durationMs);
        }
      }
    },
    BATCH_DELAY_MS,
  );

  // ─── 3.2 随机 50% 球员更新属性 ───
  const updateCount = Math.max(1, Math.floor(players.length * 0.5));
  const toUpdate = players.filter((b) => b.accessToken).slice(0, updateCount);
  report.printInfo('步骤 3.2', `更新 ${toUpdate.length} 个球员身体属性`);

  await runBatch(
    toUpdate,
    BATCH_SIZE_REGISTRATION,
    async (bot) => {
      const api = apiClient.clone();
      api.setTokens(bot.accessToken!, bot.refreshToken!);

      const oldAbility = bot.baseAbilityScore;

      const result = await safeBotRun(bot, '档案', `更新-${bot.nickname}`, async () => {
        const newWeight = (bot.weight || 75) + Math.floor(Math.random() * 10 - 5);
        const newWingspan = (bot.wingspan || bot.height! + 5) + Math.floor(Math.random() * 6 - 3);
        const profile = await api.updatePlayerProfile({
          weight: Math.max(50, newWeight),
          wingspan: Math.max(100, newWingspan),
        });
        if (profile) {
          bot.baseAbilityScore = profile.baseAbilityScore;
        }
        return profile;
      }, metrics);

      if (result.success) {
        const newAbility = bot.baseAbilityScore;
        const changed = oldAbility !== newAbility ? '重算✅' : '未变';
        report.addSuccess(`档案更新`, `${bot.nickname} ability: ${oldAbility}→${newAbility} (${changed})`, result.durationMs);
      }
    },
    BATCH_DELAY_MS,
  );

  const validAbilities = players.filter((b) => b.baseAbilityScore && b.baseAbilityScore > 0).length;
  report.printInfo('能力值汇总', `${validAbilities}/${players.length} 个球员有有效能力值`);

  report.endPhase();
}
