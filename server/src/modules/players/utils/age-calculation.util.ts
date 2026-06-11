/**
 * 年龄与球龄计算工具函数
 *
 * 时区策略：使用服务器本地时区（要求配置为 UTC+8）。
 * birthDate 使用 DATE 类型（纯日期，无时区问题）。
 */

/**
 * 计算周岁年龄
 *
 * 规则：已过生日才算一岁。正确处理闰年2月29日（非闰年按2月28日处理）。
 *
 * @param birthDate 出生日期（YYYY-MM-DD 字符串或 Date 对象）
 * @param referenceDate 参考日期（默认当前日期）
 * @returns 周岁年龄（整数）
 */
export function calculateAge(
  birthDate: string | Date,
  referenceDate: Date = new Date(),
): number {
  const birth = typeof birthDate === 'string' ? new Date(birthDate + 'T00:00:00') : birthDate;
  const ref = referenceDate;

  let age = ref.getFullYear() - birth.getFullYear();

  // 调整：如果今年生日还没到，减一岁
  const birthMonth = birth.getMonth();
  const birthDay = birth.getDate();
  const refMonth = ref.getMonth();
  const refDay = ref.getDate();

  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    age--;
  }

  return Math.max(0, age);
}

/**
 * 计算球龄
 *
 * 规则：按月份差计算，满12个月算一年（向下取整）。
 * startPlayingDate 存储为 YYYY-MM 格式，日期固定为该月1号。
 *
 * @param startPlayingDate 开始打球年月（YYYY-MM 字符串或 Date 对象）
 * @param referenceDate 参考日期（默认当前日期）
 * @returns 球龄（整数，年）
 */
export function calculateBasketballAge(
  startPlayingDate: string | Date,
  referenceDate: Date = new Date(),
): number {
  const start =
    typeof startPlayingDate === 'string'
      ? startPlayingDate.length === 7
        ? new Date(startPlayingDate + '-01T00:00:00')
        : new Date(startPlayingDate + 'T00:00:00')
      : startPlayingDate;
  const ref = referenceDate;

  const monthsDiff =
    (ref.getFullYear() - start.getFullYear()) * 12 +
    (ref.getMonth() - start.getMonth());

  return Math.max(0, Math.floor(monthsDiff / 12));
}

/**
 * 将 YYYY-MM 字符串解析为 Date 对象
 * 日期固定为该月的第一天
 *
 * @param yearMonth YYYY-MM 格式字符串
 * @returns Date 对象
 */
export function parseYearMonth(yearMonth: string): Date {
  return new Date(yearMonth + '-01T00:00:00');
}

/**
 * 将 YYYY-MM-DD 字符串解析为 Date 对象
 *
 * @param dateStr YYYY-MM-DD 格式字符串
 * @returns Date 对象
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

/**
 * 验证日期字符串是否为有效的 YYYY-MM-DD 格式
 *
 * @param dateStr 日期字符串
 * @returns 是否有效
 */
export function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr + 'T00:00:00');
  return !isNaN(date.getTime());
}

/**
 * 验证年月字符串是否为有效的 YYYY-MM 格式
 *
 * @param yearMonth 年月字符串
 * @returns 是否有效
 */
export function isValidYearMonth(yearMonth: string): boolean {
  const regex = /^\d{4}-\d{2}$/;
  if (!regex.test(yearMonth)) return false;
  const date = new Date(yearMonth + '-01T00:00:00');
  return !isNaN(date.getTime());
}
