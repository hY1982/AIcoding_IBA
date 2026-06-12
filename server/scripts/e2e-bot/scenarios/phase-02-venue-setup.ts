/**
 * Phase 2: 场地创建 + 时段发布 + 边界测试
 */

import { ApiClient, CreateVenuePayload, CreateTimeSlotPayload } from '../api-client';
import { BotContext } from '../helpers/bot-context';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { safeBotRun } from '../helpers/safe-runner';
import { DEFAULT_REGION } from '../config';

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export async function runVenueSetupPhase(
  venueManagers: BotContext[],
  apiClient: ApiClient,
  metrics: MetricsCollector,
  report: ReportGenerator,
): Promise<void> {
  report.startPhase('Phase 2: 场地创建 + 时段发布');

  const tomorrow = getTomorrowDate();

  // ─── 2.1 每个场地经理创建 1 个场地 ───
  report.printInfo('步骤 2.1', `创建 ${venueManagers.length} 个场地`);

  for (const bot of venueManagers) {
    if (!bot.accessToken) {
      report.addSkip(`场地创建 VM-${bot.index}`, '未登录');
      continue;
    }

    const api = apiClient.clone();
    api.setTokens(bot.accessToken!, bot.refreshToken!);

    const venueName = (bot as any)._venueName || `${bot.nickname}球馆`;

    const result = await safeBotRun(bot, '场地', `创建-${venueName}`, async () => {
      const payload: CreateVenuePayload = {
        name: venueName,
        address: `${DEFAULT_REGION} 测试路${bot.index}号`,
        pricePerHour: 150 + Math.floor(Math.random() * 150),
        courtCount: 1 + Math.floor(Math.random() * 2),
        latitude: 22.5431 + (Math.random() - 0.5) * 0.1,
        longitude: 114.0579 + (Math.random() - 0.5) * 0.1,
        floorMaterial: 'wood',
        lighting: 'LED',
        courtType: 'indoor',
        ventilation: true,
        bigFan: true,
        airCondition: true,
        parking: true,
        restroom: true,
        shower: true,
        lockerRoom: true,
        regionCode: DEFAULT_REGION,
      };
      const venue = await api.createVenue(payload);
      bot.venueId = venue?.id;
      return venue;
    }, metrics);

    if (result.success) {
      report.addSuccess(`场地创建`, `${venueName} venueId=${bot.venueId}`, result.durationMs);
    }
  }

  // ─── 2.2 每个场地发布 3-4 个时段 ───
  report.printInfo('步骤 2.2', '发布可预订时段');

  const slotTemplates: CreateTimeSlotPayload[][] = [
    [
      { slotDate: tomorrow, startTime: '08:00', endTime: '10:00' },
      { slotDate: tomorrow, startTime: '10:00', endTime: '12:00' },
      { slotDate: tomorrow, startTime: '14:00', endTime: '16:00' },
      { slotDate: tomorrow, startTime: '18:00', endTime: '20:00' },
    ],
    [
      { slotDate: tomorrow, startTime: '09:00', endTime: '11:00' },
      { slotDate: tomorrow, startTime: '13:00', endTime: '15:00' },
      { slotDate: tomorrow, startTime: '15:00', endTime: '17:00' },
    ],
  ];

  for (const bot of venueManagers) {
    if (!bot.venueId || !bot.accessToken) continue;

    const api = apiClient.clone();
    api.setTokens(bot.accessToken!, bot.refreshToken!);

    const slots = slotTemplates[bot.index % slotTemplates.length];

    const result = await safeBotRun(bot, '时段', `发布-V${bot.venueId}`, async () => {
      const created = await api.createTimeSlots(bot.venueId!, slots);
      bot.timeSlotIds = Array.isArray(created) ? created.map((s: any) => s.id) : [];
      return created;
    }, metrics);

    if (result.success) {
      report.addSuccess(`时段发布`, `venueId=${bot.venueId} ${slots.length} 个时段`, result.durationMs);
    }
  }

  // ─── 2.3 边界: 时段重叠检测 ───
  report.printInfo('步骤 2.3', '边界: 时段重叠检测');

  const firstVm = venueManagers.find((b) => b.venueId && b.accessToken);
  if (firstVm) {
    const api = apiClient.clone();
    api.setTokens(firstVm.accessToken!, firstVm.refreshToken!);

    const overlapResult = await (async () => {
      try {
        await api.createTimeSlots(firstVm.venueId!, [
          { slotDate: tomorrow, startTime: '09:00', endTime: '11:00' }, // 与已有 08:00-10:00 或 09:00-11:00 重叠
        ]);
        return { caught: false, message: '未拦截' };
      } catch (err: any) {
        return { caught: true, message: err.message };
      }
    })();

    if (overlapResult.caught) {
      report.addSuccess('时段重叠拦截', overlapResult.message);
    } else {
      report.addFailure('时段重叠拦截', '系统未阻止时段重叠！');
    }
  }

  // ─── 2.4 边界: 非拥有者修改场地 ───
  report.printInfo('步骤 2.4', '边界: 非拥有者操作拦截');

  if (venueManagers.length >= 2 && venueManagers[0].venueId && venueManagers[1].accessToken) {
    const api = apiClient.clone();
    api.setTokens(venueManagers[1].accessToken!, venueManagers[1].refreshToken!);

    const authResult = await (async () => {
      try {
        await api.createTimeSlots(venueManagers[0].venueId!, [
          { slotDate: tomorrow, startTime: '20:00', endTime: '22:00' },
        ]);
        return { caught: false, message: '未拦截' };
      } catch (err: any) {
        return { caught: true, message: err.message };
      }
    })();

    if (authResult.caught) {
      report.addSuccess('非拥有者操作拦截', authResult.message);
    } else {
      report.addFailure('非拥有者操作拦截', '系统未阻止非拥有者操作！');
    }
  }

  // 汇总
  const venueCount = venueManagers.filter((b) => b.venueId).length;
  report.printInfo('场地汇总', `${venueCount} 个场地已创建`);

  report.endPhase();
}
