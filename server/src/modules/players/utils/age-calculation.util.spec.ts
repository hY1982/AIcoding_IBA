import {
  calculateAge,
  calculateBasketballAge,
  parseYearMonth,
  parseDate,
  isValidDate,
  isValidYearMonth,
} from './age-calculation.util';

describe('calculateAge', () => {
  it('应正确计算周岁年龄', () => {
    const refDate = new Date('2026-06-10');
    expect(calculateAge('1995-06-09', refDate)).toBe(31);
    expect(calculateAge('1995-06-10', refDate)).toBe(31);
    expect(calculateAge('1995-06-11', refDate)).toBe(30);
  });

  it('应正确处理跨年边界', () => {
    const refDate = new Date('2026-01-01');
    expect(calculateAge('2025-01-01', refDate)).toBe(1);
    expect(calculateAge('2025-12-31', refDate)).toBe(0);
  });

  it('应正确处理闰年2月29日出生', () => {
    const refDate = new Date('2025-02-28');
    // 非闰年，2月29日按2月28日处理（JavaScript Date 自动处理）
    expect(calculateAge('2020-02-29', refDate)).toBe(4);

    const refDate2 = new Date('2024-02-29');
    expect(calculateAge('2020-02-29', refDate2)).toBe(4);
  });

  it('应返回非负数', () => {
    const refDate = new Date('2026-06-10');
    expect(calculateAge('2030-01-01', refDate)).toBe(0);
  });

  it('应支持 Date 对象输入', () => {
    const refDate = new Date('2026-06-10');
    expect(calculateAge(new Date('1995-06-10'), refDate)).toBe(31);
  });
});

describe('calculateBasketballAge', () => {
  it('应正确计算球龄（满12个月算一年）', () => {
    const refDate = new Date('2026-06-10');
    expect(calculateBasketballAge('2018-03-01', refDate)).toBe(8);
    expect(calculateBasketballAge('2025-07-01', refDate)).toBe(0);
    expect(calculateBasketballAge('2025-06-01', refDate)).toBe(1);
  });

  it('应正确处理 YYYY-MM 字符串输入', () => {
    const refDate = new Date('2026-06-10');
    expect(calculateBasketballAge('2018-03', refDate)).toBe(8);
  });

  it('应返回非负数', () => {
    const refDate = new Date('2026-06-10');
    expect(calculateBasketballAge('2030-01', refDate)).toBe(0);
  });
});

describe('parseYearMonth', () => {
  it('应将 YYYY-MM 解析为该月1号的 Date', () => {
    const date = parseYearMonth('2018-03');
    expect(date.getFullYear()).toBe(2018);
    expect(date.getMonth()).toBe(2); // 3月 = index 2
    expect(date.getDate()).toBe(1);
  });
});

describe('parseDate', () => {
  it('应将 YYYY-MM-DD 解析为 Date', () => {
    const date = parseDate('1995-06-15');
    expect(date.getFullYear()).toBe(1995);
    expect(date.getMonth()).toBe(5); // 6月 = index 5
    expect(date.getDate()).toBe(15);
  });
});

describe('isValidDate', () => {
  it('应验证有效的 YYYY-MM-DD', () => {
    expect(isValidDate('1995-06-15')).toBe(true);
    expect(isValidDate('2020-02-29')).toBe(true);
  });

  it('应拒绝无效的日期', () => {
    expect(isValidDate('1995-13-01')).toBe(false);
    expect(isValidDate('1995-06-32')).toBe(false);
    expect(isValidDate('06-15-1995')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

describe('isValidYearMonth', () => {
  it('应验证有效的 YYYY-MM', () => {
    expect(isValidYearMonth('2018-03')).toBe(true);
    expect(isValidYearMonth('2020-12')).toBe(true);
  });

  it('应拒绝无效的年月', () => {
    expect(isValidYearMonth('2018-13')).toBe(false);
    expect(isValidYearMonth('03-2018')).toBe(false);
    expect(isValidYearMonth('')).toBe(false);
  });
});
