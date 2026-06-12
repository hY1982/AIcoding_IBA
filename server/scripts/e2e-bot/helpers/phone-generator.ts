/**
 * E2E Bot 测试 — 唯一手机号生成器
 */

export class PhoneGenerator {
  private counter = 0;

  /**
   * 生成唯一 11 位手机号
   * 格式: 138 + 5位自增序号 + 4位随机数 → 取前 11 位
   */
  generate(): string {
    this.counter++;
    const seq = String(this.counter).padStart(5, '0');
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const raw = `138${seq}${rand}`;
    return raw.slice(0, 11);
  }

  /** 生成一批唯一手机号 */
  generateBatch(count: number): string[] {
    const phones: string[] = [];
    for (let i = 0; i < count; i++) {
      phones.push(this.generate());
    }
    return phones;
  }

  /** 重置计数器（新一批测试时使用） */
  reset(): void {
    this.counter = 0;
  }
}
