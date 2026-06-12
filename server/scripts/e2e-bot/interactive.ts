/**
 * E2E Bot 测试 — 真人交互暂停/提示工具
 *
 * 在关键节点暂停脚本，输出操作指引，等待真人操作后继续。
 */

import * as readline from 'readline';

const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

export interface HumanStep {
  step: number;
  description: string;
  example?: string;
}

export class InteractivePrompt {
  private rl: readline.Interface;
  private autoMode: boolean;

  /**
   * @param autoMode 若为 true，所有暂停点自动跳过（用于 CI/自动化）
   */
  constructor(autoMode = false) {
    this.autoMode = autoMode;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * 暂停并显示操作指引，等待真人确认
   */
  async pauseForHuman(title: string, steps: HumanStep[]): Promise<void> {
    if (this.autoMode) {
      console.log(`${YELLOW}  [AUTO] 跳过真人交互: ${title}${RESET}`);
      return;
    }

    const line = '═'.repeat(55);
    console.log(`\n${CYAN}${BOLD}${line}${RESET}`);
    console.log(`${CYAN}${BOLD}  ⏸️  真人操作时间！${title}${RESET}`);
    console.log(`${CYAN}${BOLD}${line}${RESET}`);

    for (const s of steps) {
      console.log(`  ${BLUE}${s.step}.${RESET} ${s.description}`);
      if (s.example) {
        console.log(`     ${YELLOW}${s.example}${RESET}`);
      }
    }

    console.log(`\n  ${GREEN}完成后按 Enter 继续...${RESET}`);
    await this.waitForEnter();
  }

  /**
   * 显示提示信息（不暂停）
   */
  showInfo(title: string, content: string): void {
    console.log(`\n  ${BLUE}ℹ️  ${BOLD}${title}${RESET} | ${content}`);
  }

  /**
   * 显示真人操作步骤（含 Token 和示例 curl）
   */
  showHumanSteps(title: string, steps: HumanStep[]): void {
    const line = '─'.repeat(55);
    console.log(`\n  ${CYAN}${line}${RESET}`);
    console.log(`  ${CYAN}${BOLD}${title}${RESET}`);
    console.log(`  ${CYAN}${line}${RESET}`);
    for (const s of steps) {
      console.log(`  ${BLUE}${s.step}.${RESET} ${s.description}`);
      if (s.example) {
        console.log(`     ${YELLOW}${s.example}${RESET}`);
      }
    }
  }

  /**
   * 等待真人完成操作后轮询检查
   */
  async waitForCondition<T>(
    checkFn: () => Promise<T | null>,
    intervalMs = 3000,
    timeoutMs = 180_000,
    label = '条件',
  ): Promise<T | null> {
    if (this.autoMode) return null;

    const deadline = Date.now() + timeoutMs;
    console.log(`  ${YELLOW}等待 ${label}...（最长 ${timeoutMs / 1000}s）${RESET}`);

    while (Date.now() < deadline) {
      try {
        const result = await checkFn();
        if (result) {
          console.log(`  ${GREEN}✅ ${label} 已满足${RESET}`);
          return result;
        }
      } catch {
        // 继续等待
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    console.log(`  ${YELLOW}⏰ ${label} 超时，跳过${RESET}`);
    return null;
  }

  /**
   * 询问用户是/否问题
   */
  async askYesNo(question: string, defaultYes = true): Promise<boolean> {
    if (this.autoMode) return defaultYes;
    const hint = defaultYes ? '(Y/n)' : '(y/N)';
    const answer = await this.ask(`${question} ${hint}: `);
    if (!answer) return defaultYes;
    return answer.toLowerCase().startsWith('y');
  }

  /**
   * 关闭 readline
   */
  close(): void {
    this.rl.close();
  }

  // --- 内部方法 ---

  private waitForEnter(): Promise<void> {
    return new Promise((resolve) => {
      this.rl.once('line', () => resolve());
    });
  }

  private ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => resolve(answer.trim()));
    });
  }
}
