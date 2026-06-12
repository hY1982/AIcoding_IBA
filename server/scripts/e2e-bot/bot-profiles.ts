/**
 * E2E Bot 测试 — Bot 档案生成器
 *
 * 根据场景配置动态生成 bot 账户档案。
 * 注册 DTO 使用 birthDate (YYYY-MM-DD) 和 startPlayingDate (YYYY-MM)。
 */

import { BotContext, createEmptyBotContext, BotRole } from './helpers/bot-context';
import { PhoneGenerator } from './helpers/phone-generator';
import { BOT_PASSWORD, DEFAULT_REGION, HUMAN_PHONE, HUMAN_PASSWORD, HUMAN_NICKNAME } from './config';

// --- 名字素材 ---

const SURNAMES = [
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
];

const GIVEN_NAMES_MALE = [
  '伟', '强', '磊', '军', '勇', '杰', '涛', '明', '辉', '鹏',
  '浩', '志远', '文博', '天宇', '子轩', '俊杰', '嘉豪', '宇飞',
];

const GIVEN_NAMES_FEMALE = [
  '芳', '秀', '敏', '静', '丽', '燕', '霞', '玲', '萍', '婷',
  '梦琪', '雨萱', '思涵', '晓燕', '美玲', '佳慧', '雪莹',
];

const VENUE_PREFIXES = [
  '飞跃', '星光', '阳光', '热血', '冠军', '金球', '银河', '篮球之家',
  '飞人', '灌篮高手', '街头', '王者', '挑战者', '梦之队',
];

const CITY_NAMES = [
  '深圳福田', '深圳南山', '广州天河', '北京朝阳', '上海浦东',
  '杭州西湖', '成都锦江', '武汉武昌', '南京鼓楼', '重庆渝中',
];

const POSITIONS: Array<'PG' | 'SG' | 'SF' | 'PF' | 'C'> = ['PG', 'SG', 'SF', 'PF', 'C'];

// --- 工具函数 ---

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = randomInt(min, max);
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** 正态分布近似（Box-Muller） */
function normalRandom(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.round(mean + z * stddev);
}

/** 年龄 → birthDate (YYYY-MM-DD)，随机生成该年份内的日期 */
function ageToBirthDate(age: number): string {
  const year = new Date().getFullYear() - age;
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 球龄 + 年龄 → startPlayingDate (YYYY-MM) */
function basketballAgeToStartDate(basketballAge: number, age: number): string {
  const startAge = Math.max(5, age - basketballAge);
  const year = new Date().getFullYear() - startAge;
  const month = randomInt(1, 12);
  return `${year}-${String(month).padStart(2, '0')}`;
}

// --- 档案生成 ---

function generatePlayerAttributes(): {
  birthDate: string;
  startPlayingDate: string;
  gender: 'male' | 'female';
  height: number;
  weight: number;
  wingspan: number;
  standingReach: number;
  jumpingReach: number;
  positions: string[];
} {
  const age = Math.max(18, Math.min(45, normalRandom(26, 3)));
  const basketballAge = Math.max(1, Math.min(30, age - 12, normalRandom(6, 2)));
  // 统一性别为男性，避免不同性别百分位数据集差异导致能力值分散
  const gender: 'male' | 'female' = 'male';

  const heightBase = gender === 'male' ? 180 : 168;
  // 窄范围随机：确保能力值集中，匹配引擎能形成足够的候选集
  const height = randomInt(heightBase - 5, heightBase + 5);
  const weight = Math.round(height * (0.42 + Math.random() * 0.06));
  const wingspan = height + randomInt(5, 10);
  const standingReach = Math.round(height * 1.28) + randomInt(-2, 2);
  const jumpingReach = standingReach + randomInt(55, 75);

  return {
    birthDate: ageToBirthDate(age),
    startPlayingDate: basketballAgeToStartDate(basketballAge, age),
    gender,
    height,
    weight,
    wingspan,
    standingReach,
    jumpingReach,
    positions: randomSubset(POSITIONS, 1, 2),
  };
}

function generateVenueManagerAttributes(phoneGen: PhoneGenerator) {
  const city = randomElement(CITY_NAMES);
  const prefix = randomElement(VENUE_PREFIXES);
  return {
    companyName: `${prefix}篮球俱乐部`,
    contactName: `${randomElement(SURNAMES)}经理`,
    contactPhone: phoneGen.generate(),
    venueName: `${prefix}篮球馆-${city}店`,
  };
}

// --- 主函数 ---

export interface BotGenerationConfig {
  playerCount: number;
  venueManagerCount: number;
}

export function generateBots(config: BotGenerationConfig): {
  players: BotContext[];
  venueManagers: BotContext[];
  human: BotContext;
} {
  const phoneGen = new PhoneGenerator();
  phoneGen.reset();

  // 生成球员 bot
  const players: BotContext[] = [];
  for (let i = 0; i < config.playerCount; i++) {
    const attrs = generatePlayerAttributes();
    const surname = randomElement(SURNAMES);
    const givenName = attrs.gender === 'male'
      ? randomElement(GIVEN_NAMES_MALE)
      : randomElement(GIVEN_NAMES_FEMALE);
    const nickname = `${surname}${givenName}_P${String(i + 1).padStart(2, '0')}`;

    const bot = createEmptyBotContext(i + 1, 'player', phoneGen.generate(), BOT_PASSWORD, nickname);
    Object.assign(bot, attrs);
    players.push(bot);
  }

  // 生成场地经理 bot
  const venueManagers: BotContext[] = [];
  for (let i = 0; i < config.venueManagerCount; i++) {
    const attrs = generateVenueManagerAttributes(phoneGen);
    const nickname = `${attrs.companyName}_VM${String(i + 1).padStart(2, '0')}`;
    const bot = createEmptyBotContext(
      config.playerCount + i + 1,
      'venue_manager',
      phoneGen.generate(),
      BOT_PASSWORD,
      nickname,
    );
    bot.companyName = attrs.companyName;
    bot.contactName = attrs.contactName;
    bot.contactPhone = attrs.contactPhone;
    // 把 venueName 存在 nickname 里太长了，用独立字段存
    (bot as any)._venueName = attrs.venueName;
    venueManagers.push(bot);
  }

  // 真人预留
  const human = createEmptyBotContext(0, 'player', HUMAN_PHONE, HUMAN_PASSWORD, HUMAN_NICKNAME);
  human.birthDate = ageToBirthDate(27);
  human.startPlayingDate = basketballAgeToStartDate(8, 27);
  human.gender = 'male';
  human.height = 183;
  human.weight = 76;
  human.wingspan = 190;
  human.standingReach = 235;
  human.jumpingReach = 320;
  human.positions = ['SG', 'SF'];

  return { players, venueManagers, human };
}
