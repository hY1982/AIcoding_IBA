const fs = require('fs');
const data = JSON.parse(fs.readFileSync('d:/AI_coding_projects/AIcoding_IBA/server/scripts/e2e-bot-report-humanDrivenStress-2026-06-30T01-47-03-906Z.json', 'utf8'));

// ==================== 1. 各阶段通过/失败统计 ====================
console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
console.log('║           E2E 测试报告分析 - humanDrivenStress (2026-06-30)                 ║');
console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('【1. 各阶段通过/失败统计】');
console.log('┌──────┬──────────────────────────┬────────┬────────┬────────┬─────────────┐');
console.log('│ 阶段 │ 名称                     │ 通过   │ 失败   │ 跳过   │ 耗时(ms)    │');
console.log('├──────┼──────────────────────────┼────────┼────────┼────────┼─────────────┤');
let totalPassed = 0, totalFailed = 0, totalSkipped = 0;
data.phases.forEach((p, i) => {
  totalPassed += p.passed;
  totalFailed += p.failed;
  totalSkipped += p.skipped;
  const name = p.name.padEnd(24).substring(0, 24);
  console.log(`│ ${i.toString().padStart(2)}   │ ${name} │ ${p.passed.toString().padStart(6)} │ ${p.failed.toString().padStart(6)} │ ${p.skipped.toString().padStart(6)} │ ${p.totalDurationMs.toString().padStart(11)} │`);
});
console.log('├──────┼──────────────────────────┼────────┼────────┼────────┼─────────────┤');
console.log(`│ 合计 │                          │ ${totalPassed.toString().padStart(6)} │ ${totalFailed.toString().padStart(6)} │ ${totalSkipped.toString().padStart(6)} │ ${data.summary.totalDurationMs.toString().padStart(11)} │`);
console.log('└──────┴──────────────────────────┴────────┴────────┴────────┴─────────────┘');
console.log(`  通过率: ${data.summary.passRate}  (通过 ${data.summary.passed} / 总计 ${data.summary.totalTests})`);

// ==================== 2. 球员注册数量和能力值分布 ====================
console.log('');
console.log('【2. 球员注册数量和能力值分布】');
const playerRegs = data.phases[1].results.filter(r => r.label === '球员注册');
console.log(`  注册球员总数: ${playerRegs.length} 人`);
console.log(`  场地方注册: 1 人 (挑战者篮球俱乐部_VM01)`);
console.log(`  真人注册: 1 人`);
console.log(`  注册用户总计: ${data.phases[1].results.length} 人`);

const abilities = [];
playerRegs.forEach(r => {
  const match = r.detail.match(/ability=([\d.]+)/);
  if (match) abilities.push(parseFloat(match[1]));
});

abilities.sort((a, b) => a - b);
const min = abilities[0];
const max = abilities[abilities.length - 1];
const avg = abilities.reduce((s, a) => s + a, 0) / abilities.length;
const median = abilities.length % 2 === 0
  ? (abilities[abilities.length / 2 - 1] + abilities[abilities.length / 2]) / 2
  : abilities[Math.floor(abilities.length / 2)];
const variance = abilities.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / abilities.length;
const stdDev = Math.sqrt(variance);

console.log('');
console.log('  能力值统计:');
console.log(`    最小值: ${min.toFixed(2)}`);
console.log(`    最大值: ${max.toFixed(2)}`);
console.log(`    平均值: ${avg.toFixed(2)}`);
console.log(`    中位数: ${median.toFixed(2)}`);
console.log(`    标准差: ${stdDev.toFixed(2)}`);

// 分桶统计
const buckets = { '40-50': 0, '50-60': 0, '60-70': 0, '70-80': 0, '80-90': 0, '90-100': 0 };
abilities.forEach(a => {
  if (a >= 40 && a < 50) buckets['40-50']++;
  else if (a >= 50 && a < 60) buckets['50-60']++;
  else if (a >= 60 && a < 70) buckets['60-70']++;
  else if (a >= 70 && a < 80) buckets['70-80']++;
  else if (a >= 80 && a < 90) buckets['80-90']++;
  else if (a >= 90 && a <= 100) buckets['90-100']++;
});
console.log('');
console.log('  能力值分桶分布:');
Object.entries(buckets).forEach(([range, count]) => {
  const pct = ((count / abilities.length) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(count / 20));
  console.log(`    ${range}: ${count.toString().padStart(4)} 人 (${pct.padStart(5)}%) ${bar}`);
});

// ==================== 3. 意向提交阶段 ====================
console.log('');
console.log('【3. 意向提交阶段】');
const phase4 = data.phases[4];
const intentionSuccess = phase4.results.filter(r => r.status === 'PASS').length;
const intentionFail = phase4.results.filter(r => r.status === 'FAIL').length;
console.log(`  成功提交意向数: ${intentionSuccess}`);
console.log(`  失败意向数: ${intentionFail}`);
console.log(`  总计: ${phase4.results.length}`);
console.log(`  成功率: ${((intentionSuccess / phase4.results.length) * 100).toFixed(2)}%`);

// 意向时长分布
const durations = [];
phase4.results.forEach(r => {
  const match = r.detail.match(/dur=(\d+)min/);
  if (match) durations.push(parseInt(match[1]));
});
const durBuckets = {};
durations.forEach(d => {
  durBuckets[d] = (durBuckets[d] || 0) + 1;
});
console.log(`  意向时长分布: ${JSON.stringify(durBuckets)}`);

// ==================== 4. 匹配引擎阶段 ====================
console.log('');
console.log('【4. 匹配引擎阶段】');
const phase5 = data.phases[5];
console.log(`  匹配引擎执行: ${phase5.results.length} 次`);
console.log(`  通过: ${phase5.passed}, 失败: ${phase5.failed}`);

// 匹配引擎详情
const meResult = phase5.results[0];
if (meResult && meResult.detail) {
  const scanMatch = meResult.detail.match(/扫描=(\d+)/);
  const createMatch = meResult.detail.match(/创建=(\d+)/);
  console.log(`  扫描意向数: ${scanMatch ? scanMatch[1] : 'N/A'}`);
  console.log(`  成功创建比赛数: ${createMatch ? createMatch[1] : 'N/A'}`);
}

// 从 metrics 获取匹配引擎性能指标
const meMetrics = data.metrics.scenarios['匹配引擎'];
if (meMetrics) {
  console.log(`  匹配引擎耗时: min=${meMetrics.timing.min}ms, max=${meMetrics.timing.max}ms, avg=${meMetrics.timing.avg}ms, p95=${meMetrics.timing.p95}ms`);
}

// 从 integrityChecks 获取比赛状态
const matchStatusCheck = data.integrityChecks.find(ic => ic.label.includes('比赛状态一致性'));
let matchCount = 0;
if (matchStatusCheck && matchStatusCheck.detail) {
  const m = matchStatusCheck.detail.match(/实际:\s*(\d+)\s*场比赛/);
  if (m) matchCount = parseInt(m[1]);
}
console.log(`  数据库中实际比赛数: ${matchCount}`);
console.log(`  匹配成功率: ${matchCount > 0 ? ((matchCount / intentionSuccess) * 100).toFixed(2) : '0.00'}% (基于意向数)`);

// ==================== 5. 确认与支付阶段 ====================
console.log('');
console.log('【5. 确认与支付阶段】');
const paymentCheck = data.integrityChecks.find(ic => ic.label.includes('支付订单完整性'));
if (paymentCheck) {
  console.log(`  支付订单校验: ${paymentCheck.status}`);
  console.log(`  详情: ${paymentCheck.detail}`);
}
const mpIntentionCheck = data.integrityChecks.find(ic => ic.label.includes('MatchPlayer→Intention'));
if (mpIntentionCheck) {
  console.log(`  MatchPlayer→Intention 引用完整性: ${mpIntentionCheck.status}`);
  console.log(`  详情: ${mpIntentionCheck.detail}`);
}
console.log(`  说明: 由于匹配引擎未生成比赛(0场)，确认与支付阶段无实际数据`);
console.log(`  确认成功率: N/A (无比赛可确认)`);

// ==================== 6. 场地确认阶段 ====================
console.log('');
console.log('【6. 场地确认阶段】');
const venueCheck = data.integrityChecks.find(ic => ic.label.includes('时段预订一致性'));
if (venueCheck) {
  console.log(`  场地时段校验: ${venueCheck.status}`);
  console.log(`  详情: ${venueCheck.detail}`);
}
const venuePhase = data.phases[2];
console.log(`  场地创建: ${venuePhase.results.filter(r => r.status === 'PASS').length} 成功`);
console.log(`  说明: 由于匹配引擎未生成比赛，场地未被预订`);
console.log(`  场地确认成功率: N/A (无比赛需确认)`);

// ==================== 7. 比赛日流程 ====================
console.log('');
console.log('【7. 比赛日流程】');
console.log(`  实际开始的比赛数: ${matchCount}`);
console.log(`  说明: 匹配引擎未生成任何比赛，因此比赛日流程未触发`);

// ==================== 8. 反馈阶段 ====================
console.log('');
console.log('【8. 反馈阶段】');
const feedbackCheck = data.integrityChecks.find(ic => ic.label.includes('反馈评分范围'));
if (feedbackCheck) {
  console.log(`  反馈评分范围校验: ${feedbackCheck.status}`);
  console.log(`  详情: ${feedbackCheck.detail}`);
}
const versionCheck = data.integrityChecks.find(ic => ic.label.includes('乐观锁版本号'));
if (versionCheck) {
  console.log(`  乐观锁版本号校验: ${versionCheck.status}`);
  console.log(`  详情: ${versionCheck.detail}`);
}
console.log(`  反馈提交率: N/A (无比赛，无反馈)`);

// ==================== 整体汇总 ====================
console.log('');
console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
console.log('║                              整体汇总                                        ║');
console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
console.log(`║  总测试数:        ${data.summary.totalTests.toString().padStart(8)}                                          ║`);
console.log(`║  通过:            ${data.summary.passed.toString().padStart(8)}                                          ║`);
console.log(`║  失败:            ${data.summary.failed.toString().padStart(8)}                                          ║`);
console.log(`║  跳过:            ${data.summary.skipped.toString().padStart(8)}                                          ║`);
console.log(`║  通过率:          ${data.summary.passRate.padStart(8)}                                          ║`);
console.log(`║  总耗时:           ${(data.summary.totalDurationMs/1000/60).toFixed(2).padStart(6)} 分钟 (${data.summary.totalDurationMs}ms)                    ║`);
console.log(`║  环境:            Node ${data.environment.node}, ${data.environment.platform}, ${data.environment.memoryMB}MB               ║`);
console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

console.log('');
console.log('【关键发现】');
console.log('  1. 所有 7021 个测试用例全部通过 (100%)');
console.log('  2. 2000 名球员成功注册，能力值分布在 50.00~84.20 之间，平均 67.72');
console.log('  3. 2000 条意向全部成功提交');
console.log('  4. 匹配引擎扫描了 2001 条意向，但创建了 0 场比赛');
console.log('  5. 由于未生成比赛，后续确认、支付、场地确认、比赛日、反馈等阶段无实际业务数据');
console.log('  6. 所有 SQL 完整性校验通过，数据库状态一致');
console.log('  7. 这是一个 humanDriven 场景，匹配可能需要真人触发或特定条件才能执行');
