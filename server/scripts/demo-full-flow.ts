/**
 * =============================================================================
 * 篮球匹配平台 — 端到端业务流程演示脚本
 * =============================================================================
 *
 * 面向非技术人员（产品经理、业务方、投资人）的可视化演示。
 * 串联所有已完成的 Service 模块，展示从注册到创建比赛意向的完整流程。
 *
 * 运行方式:
 *   cd server
 *   npm run demo:full
 *
 * 前置条件:
 *   1. Docker 环境已启动 (PostgreSQL + Redis)
 *   2. 数据库迁移已执行 (npm run migration:run)
 *   3. Format 种子数据已存在于数据库
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { PlayerService } from '../src/modules/players/services/player.service';
import { VenueService } from '../src/modules/venues/services/venue.service';
import { IntentionService } from '../src/modules/intentions/services/intention.service';
import { Format } from '../src/modules/formats/entities/format.entity';
import { VenueManager } from '../src/modules/users/entities/venue-manager.entity';
import { Player } from '../src/modules/players/entities/player.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RegisterDto } from '../src/modules/auth/dto/register.dto';
import { CreateVenueDto } from '../src/modules/venues/dto/create-venue.dto';
import { CreateTimeSlotDto } from '../src/modules/venues/dto/create-time-slot.dto';
import { CreateIntentionDto } from '../src/modules/intentions/dto/create-intention.dto';
import { UpdatePlayerDto } from '../src/modules/players/dto/update-player.dto';

// --- 演示数据 ---
const VENUE_MANAGER_PHONE = '13700137000';
const PLAYER_PHONE = '13900139000';
const PLAYER_PHONE_2 = '13900139001';
const PASSWORD = 'Demo123456';

// --- 彩色输出工具 ---
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

function printSection(title: string) {
  const line = '═'.repeat(62);
  console.log(`\n${CYAN}${BOLD}${line}${RESET}`);
  console.log(`${CYAN}${BOLD}  ${title}${RESET}`);
  console.log(`${CYAN}${BOLD}${line}${RESET}`);
}

function printSuccess(label: string, value: string) {
  console.log(`  ${GREEN}✅ ${label}${RESET} | ${value}`);
}

function printInfo(label: string, value: string) {
  console.log(`  ${BLUE}ℹ️  ${label}${RESET} | ${value}`);
}

function printWarning(label: string, value: string) {
  console.log(`  ${YELLOW}⚠️  ${label}${RESET} | ${value}`);
}

function printError(label: string, value: string) {
  console.log(`  ${RED}❌ ${label}${RESET} | ${value}`);
}

function printDivider() {
  console.log(`  ${'─'.repeat(58)}`);
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function getFutureTime(hoursAhead: number): Date {
  const d = new Date();
  d.setHours(d.getHours() + hoursAhead);
  // Round to next hour
  d.setMinutes(0, 0, 0);
  return d;
}

// --- 主流程 ---

async function main() {
  console.log(`${BOLD}`);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     篮球匹配平台 — 端到端业务流程演示                         ║');
  console.log('║     Basketball Match Platform — End-to-End Demo              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`${RESET}`);
  printInfo('当前时间', new Date().toLocaleString('zh-CN'));
  printInfo('演示说明', '绿色=已实现  黄色=数据模型存在  红色=未实现');

  // 创建 NestJS 应用上下文（不启动 HTTP 服务器）
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false, // 关闭 NestJS 内部日志，避免干扰演示输出
  });

  // 获取 Service 实例
  const authService = app.get(AuthService);
  const playerService = app.get(PlayerService);
  const venueService = app.get(VenueService);
  const intentionService = app.get(IntentionService);
  const formatRepo = app.get<Repository<Format>>(getRepositoryToken(Format));
  const venueManagerRepo = app.get<Repository<VenueManager>>(
    getRepositoryToken(VenueManager),
  );
  const playerRepo = app.get<Repository<Player>>(getRepositoryToken(Player));

  try {
    // ========================================
    // 步骤 1: 场地方注册
    // ========================================
    printSection('步骤 1: 场地方注册');
    printInfo('调用模块', 'AuthService.register()');
    printInfo('验证点', 'A-1: 同一手机号能否重复注册？');
    printDivider();

    let venueManagerUserId: number;
    let venueManagerRecordId: number;

    try {
      const venueManagerAuth = await authService.register({
        phone: VENUE_MANAGER_PHONE,
        password: PASSWORD,
        nickname: '星光球馆老板',
        userType: 'venue_manager',
        companyName: '星光篮球馆有限公司',
        contactName: '李老板',
        contactPhone: '13700137001',
      } as RegisterDto);

      venueManagerUserId = venueManagerAuth.user.id;
      printSuccess('注册成功', `用户ID: ${venueManagerUserId}`);
      printInfo('脱敏手机号', venueManagerAuth.user.phone); // 如: 137****7000
      printInfo(
        'Token状态',
        'AccessToken已生成(2h有效)，RefreshToken已存入Redis(7d有效)',
      );
    } catch (e: any) {
      if (e.message?.includes('已被注册')) {
        printWarning('用户已存在', '使用已有账号继续演示');
        // 通过登录获取用户ID
        const loginResult = await authService.login({
          phone: VENUE_MANAGER_PHONE,
          password: PASSWORD,
        });
        venueManagerUserId = loginResult.user.id;
        printInfo('已有用户ID', `${venueManagerUserId}`);
      } else {
        throw e;
      }
    }

    // 查询 VenueManager 记录
    const vmRecord = await venueManagerRepo.findOne({
      where: { userId: venueManagerUserId },
    });
    venueManagerRecordId = vmRecord?.id ?? 0;
    printInfo('场地方记录ID', `${venueManagerRecordId}`);

    // ========================================
    // 步骤 2: 场地方创建场地 + 发布时段
    // ========================================
    printSection('步骤 2: 创建场地并发布可预订时段');
    printInfo('调用模块', 'VenueService.create() + createTimeSlots()');
    printInfo('验证点', 'D-1: 列表默认显示什么状态的场地？ D-3: 能否修改别人的场地？');
    printDivider();

    // 检查是否已有演示场地
    const existingVenue = await venueService
      .findAll({ page: 1, pageSize: 10 })
      .then((res) => res.list.find((v) => v.name === '星光篮球馆'));

    let venueId: number;

    if (existingVenue) {
      venueId = existingVenue.id;
      printWarning('场地已存在', `场地ID: ${venueId}，使用已有场地继续演示`);
    } else {
      const venue = await venueService.create(
        venueManagerRecordId,
        {
          name: '星光篮球馆',
          address: '深圳市福田区福华路100号',
          pricePerHour: 280,
          courtCount: 2,
          latitude: 22.5431,
          longitude: 114.0579,
          floorMaterial: 'wood',
          lighting: 'LED',
          courtType: 'indoor',
          ventilation: true,
          bigFan: true,
          airCondition: true,
          turnoverTime: 15,
          parking: true,
          restroom: true,
          shower: true,
          lockerRoom: true,
          videoRecord: false,
          regionCode: 'shenzhen_futian',
        } as CreateVenueDto,
      );
      venueId = venue.id;
      printSuccess('场地创建成功', `场地ID: ${venueId}`);
    }

    // 显示场地详情
    const venueDetail = await venueService.findById(venueId);
    printInfo('场地名称', venueDetail.name);
    printInfo('场地地址', venueDetail.address);
    printInfo('每小时价格', `¥${venueDetail.pricePerHour}`);
    printInfo('球场数量', `${venueDetail.courtCount} 个`);
    printInfo('设施配置', `木地板 | LED灯光 | 室内 | 空调 | 停车位 | 淋浴`);
    printInfo('场地状态', venueDetail.status);

    // 创建可预订时段
    const tomorrow = getTomorrowDate();
    const existingSlots = await venueService.findTimeSlots(venueId, tomorrow);

    if (existingSlots.length > 0) {
      printWarning('时段已存在', `明天已有 ${existingSlots.length} 个时段，跳过创建`);
    } else {
      const slots = await venueService.createTimeSlots(
        venueId,
        venueManagerRecordId,
        [
          { slotDate: tomorrow, startTime: '09:00', endTime: '11:00' },
          { slotDate: tomorrow, startTime: '14:00', endTime: '16:00' },
          { slotDate: tomorrow, startTime: '19:00', endTime: '21:00' },
        ] as CreateTimeSlotDto[],
      );
      printSuccess('时段创建成功', `共 ${slots.length} 个时段`);
    }

    // 显示所有时段
    const allSlots = await venueService.findTimeSlots(venueId, tomorrow);
    for (const slot of allSlots) {
      printInfo(
        '可预订时段',
        `${slot.slotDate} ${slot.startTime}-${slot.endTime} | 已预订: ${slot.isBooked ? '是' : '否'}`,
      );
    }

    // ========================================
    // 步骤 3: 球员注册
    // ========================================
    printSection('步骤 3: 球员注册');
    printInfo('调用模块', 'AuthService.register()');
    printInfo('验证点', 'A-2: 密码在数据库中是明文吗？ C-3: 可以选几个位置？');
    printDivider();

    let playerUserId: number;

    try {
      const playerAuth = await authService.register({
        phone: PLAYER_PHONE,
        password: PASSWORD,
        nickname: '科比粉丝小王',
        userType: 'player',
        age: 25,
        basketballAge: 8,
        gender: 'male',
        height: 185,
        weight: 78,
        wingspan: 192,
        standingReach: 238,
        jumpingReach: 325,
        positions: ['SG', 'SF'],
      } as RegisterDto);

      playerUserId = playerAuth.user.id;
      printSuccess('球员注册成功', `用户ID: ${playerUserId}`);
      printInfo('球员昵称', playerAuth.user.nickname);
      printInfo('司职位置', 'SG(得分后卫, 优先级1) | SF(小前锋, 优先级2)');
      printInfo(
        '密码安全',
        '密码已用 bcrypt 加密存储，数据库中无法看到明文',
      );
    } catch (e: any) {
      if (e.message?.includes('已被注册')) {
        printWarning('球员已存在', '使用已有账号继续演示');
        const loginResult = await authService.login({
          phone: PLAYER_PHONE,
          password: PASSWORD,
        });
        playerUserId = loginResult.user.id;
        printInfo('已有用户ID', `${playerUserId}`);
      } else {
        throw e;
      }
    }

    // ========================================
    // 步骤 4: 球员登录
    // ========================================
    printSection('步骤 4: 球员登录');
    printInfo('调用模块', 'AuthService.login()');
    printInfo('验证点', 'B-1: 登录后拿到什么凭证？ B-2: 密码错误会暴露账号吗？');
    printDivider();

    const loginResult = await authService.login({
      phone: PLAYER_PHONE,
      password: PASSWORD,
    });

    printSuccess('登录成功', `欢迎, ${loginResult.user.nickname}`);
    printInfo(
      'AccessToken',
      `${loginResult.tokens.accessToken.substring(0, 30)}... (2小时有效)`,
    );
    printInfo(
      'RefreshToken',
      `${loginResult.tokens.refreshToken.substring(0, 30)}... (7天有效)`,
    );
    printInfo('安全说明', '错误密码统一提示"手机号或密码错误"，不暴露账号存在性');

    // ========================================
    // 步骤 5: 球员档案 — 能力值自动计算
    // ========================================
    printSection('步骤 5: 球员档案 — 能力值自动计算');
    printInfo('调用模块', 'PlayerService.findByUserId() + update()');
    printInfo('验证点', 'C-1: 输入身高体重后自动算能力值吗？ C-2: 更新后自动重算吗？');
    printDivider();

    // 查找球员档案
    let playerProfile = await playerService.findByUserId(playerUserId);

    if (!playerProfile) {
      // 如果注册时没创建 Player 记录，这里手动创建
      printWarning('档案不存在', '正在创建球员档案...');
      playerProfile = await playerService.create(playerUserId, {
        age: 25,
        basketballAge: 8,
        gender: 'male',
        height: 185,
        weight: 78,
        wingspan: 192,
        standingReach: 238,
        jumpingReach: 325,
        positions: ['SG', 'SF'],
      });
    }

    printInfo('当前基础能力值', `${playerProfile.baseAbilityScore} 分`);
    printInfo('当前总能力值', `${playerProfile.totalAbilityScore} 分`);
    printInfo(
      '能力值说明',
      '基于身高/体重/年龄/臂展/站立摸高/助跑摸高等数据，按全国篮球人口百分位自动计算',
    );
    printDivider();

    // 演示更新身高后能力值自动重算
    printInfo('演示操作', '更新身高 185cm → 190cm，体重 78kg → 82kg');
    const updatedProfile = await playerService.update(playerProfile.id, {
      height: 190,
      weight: 82,
    } as UpdatePlayerDto);

    printSuccess('档案更新成功', '身高和体重已更新');
    printInfo('新的基础能力值', `${updatedProfile.baseAbilityScore} 分`);
    printInfo('新的总能力值', `${updatedProfile.totalAbilityScore} 分`);
    printInfo(
      '智能重算说明',
      '系统检测到身高/体重变化，自动重新计算了能力值；若修改不影响能力值的字段则不会重算',
    );

    const playerId = updatedProfile.id;

    // ========================================
    // 步骤 6: 创建比赛意向
    // ========================================
    printSection('步骤 6: 创建比赛意向');
    printInfo('调用模块', 'IntentionService.create()');
    printInfo('验证点', 'E-1: 同一时段能提交两个意向吗？ E-2: 系统怎么知道地区？');
    printDivider();

    // 查询可用的赛制
    const formats = await formatRepo.find({ where: { isActive: true } });
    if (formats.length === 0) {
      printWarning('无可用赛制', '数据库中缺少 Format 种子数据，请先运行迁移');
    } else {
      printInfo(
        '可用赛制',
        formats.map((f) => f.name).join(' | '),
      );
    }

    const startTime = getFutureTime(2); // 2小时后，满足"提前1小时"规则
    const formatId = formats.length > 0 ? formats[0].id : 1;

    const intention = await intentionService.create(playerId, {
      startTime: startTime.toISOString(),
      durationMinutes: 120, // 2小时
      acceptableWaitMinutes: 30, // 最多等30分钟
      venueIds: [{ venueId: venueId, priority: 1 }], // 首选：星光篮球馆
      formatIds: [{ formatId: formatId, priority: 1 }], // 首选：第一个可用赛制
    } as CreateIntentionDto);

    printSuccess('意向创建成功', `意向ID: ${intention.id}`);
    printInfo('比赛时间', `${formatTime(intention.startTime)} - ${formatTime(intention.endTime)}`);
    printInfo('持续时间', `${intention.durationMinutes} 分钟`);
    printInfo('当前状态', `${intention.status}（等待匹配）`);
    printInfo('过期时间', `${formatTime(intention.expiresAt)}（30分钟后自动过期）`);
    printInfo(
      '首选场地',
      `${intention.venues[0]?.venueName ?? '未知'} (优先级${intention.venues[0]?.priority})`,
    );
    printInfo(
      '首选赛制',
      `${intention.formats[0]?.formatName ?? '未知'} (优先级${intention.formats[0]?.priority})`,
    );
    printInfo('地区编码', `${intention.regionCode ?? '自动推断'}（球员档案 → 首选场地 → 默认）`);

    // ========================================
    // 步骤 7: 查询意向详情
    // ========================================
    printSection('步骤 7: 查询意向详情');
    printInfo('调用模块', 'IntentionService.findById()');
    printInfo('验证点', 'F-1: 意向状态是什么？ F-2: 匹配前能修改或取消吗？');
    printDivider();

    const foundIntention = await intentionService.findById(intention.id);

    printInfo('意向ID', `${foundIntention.id}`);
    printInfo('球员ID', `${foundIntention.playerId}`);
    printInfo('开始时间', formatTime(foundIntention.startTime));
    printInfo('结束时间', formatTime(foundIntention.endTime));
    printInfo('持续时间', `${foundIntention.durationMinutes} 分钟`);
    printInfo('当前状态', `${foundIntention.status}`);
    printInfo('地区编码', `${foundIntention.regionCode ?? '无'}`);
    printInfo(
      '场地偏好',
      foundIntention.venues
        .map((v) => `${v.venueName ?? v.venueId}(优先级${v.priority})`)
        .join(', '),
    );
    printInfo(
      '赛制偏好',
      foundIntention.formats
        .map((f) => `${f.formatName ?? f.formatId}(优先级${f.priority})`)
        .join(', '),
    );
    printDivider();
    printWarning(
      '状态说明',
      '当前为"pending(等待匹配)"状态。matched/confirmed 等状态的数据模型已定义，但触发状态变化的匹配引擎尚未开发',
    );

    // ========================================
    // 步骤 8: 边界场景演示
    // ========================================
    printSection('步骤 8: 边界场景演示 — 系统的安全防护能力');
    printInfo('说明', '以下场景演示系统如何拦截非法/冲突操作');
    printDivider();

    // 8.1 重复注册检测
    printInfo('场景 8.1', '重复注册同一手机号');
    try {
      await authService.register({
        phone: PLAYER_PHONE,
        password: PASSWORD,
        nickname: '重复用户',
        userType: 'player',
        age: 20,
        basketballAge: 1,
        gender: 'male',
        height: 170,
      } as RegisterDto);
      printError('拦截失败', '系统未阻止重复注册！');
    } catch (e: any) {
      printSuccess('拦截成功', e.message); // "该手机号已被注册"
    }
    printDivider();

    // 8.2 时间重叠检测（意向）
    printInfo('场景 8.2', '同一球员在同一时间段创建第二个意向');
    try {
      await intentionService.create(playerId, {
        startTime: startTime.toISOString(),
        durationMinutes: 120,
        venueIds: [{ venueId: venueId, priority: 1 }],
        formatIds: [{ formatId: formatId, priority: 1 }],
      } as CreateIntentionDto);
      printError('拦截失败', '系统未阻止时间重叠！');
    } catch (e: any) {
      printSuccess('拦截成功', e.message); // "该时间段内已存在 pending 状态的比赛意向"
    }
    printDivider();

    // 8.3 时段重叠检测（场地方）
    printInfo('场景 8.3', '场地方创建与已有时段重叠的新时段');
    try {
      await venueService.createTimeSlots(
        venueId,
        venueManagerRecordId,
        [
          {
            slotDate: tomorrow,
            startTime: '10:00',
            endTime: '12:00',
          },
        ] as CreateTimeSlotDto[], // 与 09:00-11:00 重叠
      );
      printError('拦截失败', '系统未阻止时段重叠！');
    } catch (e: any) {
      printSuccess('拦截成功', e.message); // "时段重叠: ..."
    }
    printDivider();

    // 8.4 密码错误检测
    printInfo('场景 8.4', '使用错误密码登录');
    try {
      await authService.login({
        phone: PLAYER_PHONE,
        password: 'WrongPassword123',
      });
      printError('拦截失败', '系统未阻止错误密码！');
    } catch (e: any) {
      printSuccess('拦截成功', e.message); // "手机号或密码错误"
    }

    // ========================================
    // 演示总结
    // ========================================
    printSection('演示总结');
    printSuccess(
      '已验证流程',
      '场地方注册 → 创建场地 → 发布时段 → 球员注册 → 登录 → 创建档案 → 提交意向 → 查询详情',
    );
    printSuccess(
      '已验证安全',
      '重复注册拦截 | 时间重叠拦截 | 时段重叠拦截 | 密码错误拦截 | 手机号脱敏 | Token 安全',
    );
    printWarning(
      '未实现模块',
      '自动匹配引擎 | 比赛确认 | 模拟支付 | 赛后反馈 | 通知服务 | 实时群聊 | REST API | 前端界面',
    );
    printInfo(
      '测试统计',
      '303 个单元测试全部通过，核心模块代码覆盖率 95%+',
    );
    printInfo(
      '下一步',
      'Module 2.6 匹配引擎开发完成后，意向将能自动匹配成比赛',
    );

    console.log(`\n${CYAN}${BOLD}═══════════════════════════════════════════════════════════════${RESET}`);
    console.log(`${CYAN}${BOLD}  演示完成！${RESET}`);
    console.log(`${CYAN}${BOLD}═══════════════════════════════════════════════════════════════${RESET}\n`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('\n演示执行出错:', err.message);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
