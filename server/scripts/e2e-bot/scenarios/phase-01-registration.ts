/**
 * Phase 1: 批量注册 + 边界测试
 */

import { ApiClient, PlayerRegisterPayload, VenueManagerRegisterPayload } from '../api-client';
import { BotContext } from '../helpers/bot-context';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { DbTools } from '../helpers/db-tools';
import { runBatch, safeBotRun } from '../helpers/safe-runner';
import { BATCH_SIZE_REGISTRATION, BATCH_DELAY_MS, DEFAULT_REGION } from '../config';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

export async function runRegistrationPhase(
  players: BotContext[],
  venueManagers: BotContext[],
  human: BotContext,
  apiClient: ApiClient,
  metrics: MetricsCollector,
  report: ReportGenerator,
  dbTools: DbTools,
): Promise<void> {
  report.startPhase('Phase 1: 批量注册');

  // ─── 1.1 场地经理注册 ───
  report.printInfo('步骤 1.1', `注册 ${venueManagers.length} 个场地经理 bot`);

  await runBatch(
    venueManagers,
    BATCH_SIZE_REGISTRATION,
    async (bot) => {
      const payload: VenueManagerRegisterPayload = {
        phone: bot.phone,
        password: bot.password,
        nickname: bot.nickname,
        userType: 'venue_manager',
        companyName: bot.companyName!,
        contactName: bot.contactName!,
        contactPhone: bot.contactPhone!,
        regionCode: DEFAULT_REGION,
      };

      const result = await safeBotRun(bot, '注册', `VM-${bot.nickname}`, async () => {
        const resp = await apiClient.clone().register(payload);
        return resp;
      }, metrics);

      if (result.success && result.result) {
        const data = result.result;
        const api = apiClient.clone();
        // 登录获取 token
        const loginResp = await api.login({ phone: bot.phone, password: bot.password });
        bot.accessToken = api.getAccessToken();
        bot.refreshToken = api.getRefreshToken();
        bot.userId = Number(loginResp?.user?.id ?? data?.user?.id);
        // 获取 venueManagerId
        const profile = await api.getVenueManagerProfile();
        bot.venueManagerId = Number(profile?.id);
        report.addSuccess(`VM 注册`, `${bot.nickname} userId=${bot.userId} vmId=${bot.venueManagerId}`, result.durationMs);
      }
    },
    BATCH_DELAY_MS,
  );

  // ─── 1.2 球员注册 ───
  report.printInfo('步骤 1.2', `注册 ${players.length} 个球员 bot`);

  await runBatch(
    players,
    BATCH_SIZE_REGISTRATION,
    async (bot) => {
      const payload: PlayerRegisterPayload = {
        phone: bot.phone,
        password: bot.password,
        nickname: bot.nickname,
        userType: 'player',
        birthDate: bot.birthDate!,
        startPlayingDate: bot.startPlayingDate!,
        gender: bot.gender!,
        height: bot.height!,
        weight: bot.weight,
        wingspan: bot.wingspan,
        standingReach: bot.standingReach,
        jumpingReach: bot.jumpingReach,
        positions: bot.positions as any,
        regionCode: DEFAULT_REGION,
      };

      const result = await safeBotRun(bot, '注册', `P-${bot.nickname}`, async () => {
        const api = apiClient.clone();
        await api.register(payload);
        // 登录获取 token
        await api.login({ phone: bot.phone, password: bot.password });
        bot.accessToken = api.getAccessToken();
        bot.refreshToken = api.getRefreshToken();
        // 获取球员档案
        const profile = await api.getPlayerProfile();
        bot.userId = Number(profile?.userId ?? profile?.id);
        bot.playerId = Number(profile?.id);
        bot.baseAbilityScore = profile?.baseAbilityScore;
        return profile;
      }, metrics);

      if (result.success) {
        report.addSuccess(`球员注册`, `${bot.nickname} playerId=${bot.playerId} ability=${bot.baseAbilityScore}`, result.durationMs);
      }
    },
    BATCH_DELAY_MS,
  );

  // ─── 1.3 真人注册 ───
  report.printInfo('步骤 1.3', '注册真人账户');

  const humanResult = await safeBotRun(human, '注册', '真人', async () => {
    const api = apiClient.clone();
    const payload: PlayerRegisterPayload = {
      phone: human.phone,
      password: human.password,
      nickname: human.nickname,
      userType: 'player',
      birthDate: human.birthDate!,
      startPlayingDate: human.startPlayingDate!,
      gender: human.gender!,
      height: human.height!,
      weight: human.weight,
      wingspan: human.wingspan,
      standingReach: human.standingReach,
      jumpingReach: human.jumpingReach,
      positions: human.positions as any,
      regionCode: DEFAULT_REGION,
    };
    await api.register(payload);
    await api.login({ phone: human.phone, password: human.password });
    human.accessToken = api.getAccessToken();
    human.refreshToken = api.getRefreshToken();
    const profile = await api.getPlayerProfile();
    human.userId = Number(profile?.userId ?? profile?.id);
    human.playerId = Number(profile?.id);
    human.baseAbilityScore = profile?.baseAbilityScore;
    return profile;
  }, metrics);

  if (humanResult.success) {
    report.addSuccess('真人注册', `userId=${human.userId} playerId=${human.playerId}`);
  } else {
    // 注册失败（可能因之前运行残留导致手机号已存在），尝试直接登录
    const errMsg = humanResult.error?.message || '未知错误';
    console.log(`  ${YELLOW}⚠️  真人注册失败: ${errMsg}，尝试直接登录...${RESET}`);

    const loginResult = await safeBotRun(human, '注册', '真人-login-fallback', async () => {
      const api = apiClient.clone();
      await api.login({ phone: human.phone, password: human.password });
      human.accessToken = api.getAccessToken();
      human.refreshToken = api.getRefreshToken();
      const profile = await api.getPlayerProfile();
      human.userId = Number(profile?.userId ?? profile?.id);
      human.playerId = Number(profile?.id);
      human.baseAbilityScore = profile?.baseAbilityScore;
      return profile;
    }, metrics);

    if (loginResult.success) {
      report.addSuccess('真人登录(fallback)', `userId=${human.userId} playerId=${human.playerId}`);
    } else {
      const loginErr = loginResult.error?.message || '未知错误';
      console.log(`  ${RED}❌ 真人登录回退也失败: ${loginErr}${RESET}`);
      report.addFailure('真人注册', `注册失败: ${errMsg}; 登录回退也失败: ${loginErr}`);
    }
  }

  // ─── 1.4 边界: 重复注册 ───
  report.printInfo('步骤 1.4', '边界: 重复注册检测');

  const dupResult = await (async () => {
    try {
      const api = apiClient.clone();
      await api.register({
        phone: players[0].phone,
        password: players[0].password,
        nickname: '重复用户',
        userType: 'player',
        birthDate: players[0].birthDate!,
        startPlayingDate: players[0].startPlayingDate!,
        gender: players[0].gender!,
        height: players[0].height!,
        regionCode: DEFAULT_REGION,
      });
      return { caught: false, message: '未拦截' };
    } catch (err: any) {
      return { caught: true, message: err.message };
    }
  })();

  if (dupResult.caught) {
    report.addSuccess('重复注册拦截', dupResult.message);
  } else {
    report.addFailure('重复注册拦截', '系统未阻止重复注册！');
  }

  // ─── 1.5 边界: 错误密码 ───
  report.printInfo('步骤 1.5', '边界: 错误密码登录');

  const wrongPwResult = await (async () => {
    try {
      const api = apiClient.clone();
      await api.login({ phone: players[0].phone, password: 'WrongPassword123!' });
      return { caught: false, message: '未拦截' };
    } catch (err: any) {
      return { caught: true, message: err.message };
    }
  })();

  if (wrongPwResult.caught) {
    report.addSuccess('错误密码拦截', wrongPwResult.message);
  } else {
    report.addFailure('错误密码拦截', '系统未阻止错误密码！');
  }

  // ─── 汇总 ───
  const vmSuccess = venueManagers.filter((b) => b.userId).length;
  const pSuccess = players.filter((b) => b.playerId).length;
  report.printInfo('注册汇总', `场地经理: ${vmSuccess}/${venueManagers.length}, 球员: ${pSuccess}/${players.length}, 真人: ${human.userId ? '✅' : '❌'}`);

  report.endPhase();
}
