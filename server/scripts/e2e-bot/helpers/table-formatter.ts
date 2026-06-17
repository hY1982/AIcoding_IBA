/**
 * E2E Bot 测试 — ASCII 表格格式化器
 *
 * PowerShell 兼容的终端表格输出，支持 ANSI 颜色。
 * 使用 ASCII 边框 (+, -, |) 替代 Unicode box-drawing 字符。
 */

const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

export interface TableOptions {
  title?: string;
  maxRows?: number;
  colorFn?: (row: Record<string, string | number>, colKey: string, rowIndex: number) => string;
}

/**
 * 去除 ANSI 转义码，计算真实文本宽度
 */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * 单元格对齐填充
 */
function padCell(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const stripped = stripAnsi(text);
  const padding = Math.max(0, width - stripped.length);

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + text;
    case 'center': {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return ' '.repeat(left) + text + ' '.repeat(right);
    }
    default: // left
      return text + ' '.repeat(padding);
  }
}

/**
 * 生成分隔行
 */
function buildDivider(widths: number[], leftChar = '+', midChar = '-', crossChar = '+'): string {
  return leftChar + widths.map((w) => midChar.repeat(w + 2)).join(crossChar) + crossChar;
}

/**
 * 生成数据行
 */
function buildRow(cells: string[], widths: number[], aligns: Array<'left' | 'right' | 'center'>): string {
  const padded = cells.map((cell, i) => padCell(cell, widths[i], aligns[i]));
  return '| ' + padded.join(' | ') + ' |';
}

/**
 * 格式化 ASCII 表格
 *
 * @param columns  列定义
 * @param rows     数据行
 * @param options  表格选项
 * @returns        格式化后的表格字符串
 */
export function formatTable(
  columns: TableColumn[],
  rows: Array<Record<string, string | number>>,
  options?: TableOptions,
): string {
  const maxRows = options?.maxRows ?? 50;
  const colorFn = options?.colorFn;

  // 计算每列宽度
  const widths = columns.map((col) => {
    if (col.width) return col.width;
    const headerLen = col.header.length;
    const maxCellLen = rows.reduce((max, row) => {
      const val = String(row[col.key] ?? '');
      const stripped = stripAnsi(val);
      return Math.max(max, stripped.length);
    }, 0);
    return Math.max(headerLen, Math.min(maxCellLen, 40)); // cap at 40 chars
  });

  const aligns = columns.map((col) => col.align ?? 'left');

  const lines: string[] = [];

  // 标题行
  if (options?.title) {
    const totalWidth = widths.reduce((sum, w) => sum + w + 3, 1); // +3 for " | " per column, +1 for leading "|"
    const title = options.title;
    const titleStripped = stripAnsi(title);
    const padding = Math.max(0, totalWidth - titleStripped.length - 2);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    lines.push(`${CYAN}${BOLD}${'='.repeat(leftPad)} ${title} ${'='.repeat(rightPad)}${RESET}`);
  }

  // 表头
  lines.push(buildDivider(widths));
  const headerCells = columns.map((col, i) => {
    const text = `${BOLD}${col.header}${RESET}`;
    return padCell(text, widths[i] + (text.length - col.header.length), aligns[i]);
  });
  lines.push('| ' + headerCells.join(' | ') + ' |');
  lines.push(buildDivider(widths));

  // 数据行
  const displayRows = rows.slice(0, maxRows);
  for (let r = 0; r < displayRows.length; r++) {
    const row = displayRows[r];
    const cells = columns.map((col) => {
      const rawVal = String(row[col.key] ?? '');
      if (colorFn) {
        const color = colorFn(row, col.key, r);
        return color ? `${color}${rawVal}${RESET}` : rawVal;
      }
      return rawVal;
    });
    lines.push(buildRow(cells, widths, aligns));
  }

  // 溢出提示
  if (rows.length > maxRows) {
    const totalWidth = widths.reduce((sum, w) => sum + w + 3, 1);
    const overflowMsg = `... +${rows.length - maxRows} more rows`;
    const padding = totalWidth - overflowMsg.length - 2;
    lines.push(`| ${overflowMsg}${' '.repeat(Math.max(0, padding))} |`);
  }

  // 底部分隔行
  lines.push(buildDivider(widths));

  return lines.join('\n');
}

/**
 * 快速打印表格到控制台
 */
export function printTable(
  columns: TableColumn[],
  rows: Array<Record<string, string | number>>,
  options?: TableOptions,
): void {
  console.log(formatTable(columns, rows, options));
}
