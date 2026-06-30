const fs = require('fs');
const data = JSON.parse(fs.readFileSync('d:/AI_coding_projects/AIcoding_IBA/server/scripts/e2e-bot-report-humanDrivenStress-2026-06-30T01-47-03-906Z.json', 'utf8'));

// ==================== 1. 各阶段通过/失败统计 ====================
console.log('【1. 各阶段通过/失败统计】');
console.log('┌──────┬──────────────────────────┬────────┬────────┬────────┬─────────────┐');
console.log('│ 阶段 │ 名称                     │ 通过   │ 失败   │ 跳过   │ 耗时(ms)    │');
console.log('├──────┼──────────────────────────┼────────┼────────┼────────┼─────────────┤');
data.phases.forEach((p, i) => {
  const name = p.name.padEnd(24).substring(0, 24);
  console.log(`│ ${i.toString().padStart(2)}   │ ${name} │ ${p.passed.toString().padStart(6)} │ ${p.failed.toString().padStart(6)} │ ${p.skipped.toString().padStart(6)} │ ${p.totalDurationMs.toString().padStart(11)} │`);
});
console.log('└──────┴──────────────────────────┴────────┴────────┴────────┴─────────────┘');

// ==================== 2. 球员注册数量和能力值分布 ====================
console.log('\n【2. 球员注册数量和能力值分布】');
const playerRegs = data.phases[1].results.filter(r => r.label === '球员注册');
console.log('注册球员数:', playerRegs.length);

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

console.log('能力值分布:');
console.log('  最小值:', min.toFixed(2));
console.log('  最大值:', max.toFixed(2));
console.log('  平均值:', avg.toFixed(2));
console.log('  中位数:', median.toFixed(2));
console.log('  标准差:', stdDev.toFixed(2));

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
console.log('  分桶分布:', JSON.stringify(buckets));

// ==================== 3. 意向提交阶段 ====================
console.log('\n【3. 意向提交阶段】');
// 从 Phase 4 (随机意向生成) 获取
const phase4 = data.phases[4];
const intentionSuccess = phase4.results.filter(r => r.status === 'PASS').length;
const intentionFail = phase4.results.filter(r => r.status === 'FAIL').length;
console.log('成功提交意向数:', intentionSuccess);
console.log('失败意向数:', intentionFail);
console.log('总计:', phase4.results.length);

// ==================== 4. 匹配引擎阶段 ====================
console.log('\n【4. 匹配引擎阶段】');
// 从 Phase 5 (匹配引擎) 获取
const phase5 = data.phases[5];
console.log('匹配引擎执行结果数:', phase5.results.length);
console.log('通过:', phase5.passed, '失败:', phase5.failed);

// 从 integrityChecks 获取比赛状态
const matchStatusCheck = data.integrityChecks.find(ic => ic.label.includes('比赛状态'));
if (matchStatusCheck) {
  console.log('SQL校验详情:', matchStatusCheck.detail);
}

// 从 metrics.scenarios 获取匹配数据
const metrics = data.metrics;
if (metrics.scenarios && metrics.scenarios['匹配引擎']) {
  const me = metrics.scenarios['匹配引擎'];
  console.log('匹配引擎指标 - total:', me.total, 'success:', me.success, 'error:', me.error, 'successRate:', me.successRate);
  if (me.timing) {
    console.log('  耗时 - min:', me.timing.min, 'max:', me.timing.max, 'avg:', me.timing.avg, 'p50:', me.timing.p50, 'p95:', me.timing.p95, 'p99:', me.timing.p99);
  }
}

// 从 integrityChecks 解析实际比赛数
let matchCount = 0;
const matchStatusDetail = data.integrityChecks.find(ic => ic.label.includes('比赛状态一致性'));
if (matchStatusDetail && matchStatusDetail.detail) {
  const m = matchStatusDetail.detail.match(/实际:\s*(\d+)\s*场比赛/);
  if (m) matchCount = parseInt(m[1]);
}
console.log('实际生成的比赛数:', matchCount);

// ==================== 5. 确认与支付阶段 ====================
console.log('\n【5. 确认与支付阶段】');
// 从 integrityChecks 的支付订单完整性获取
const paymentCheck = data.integrityChecks.find(ic => ic.label.includes('支付订单完整性'));
if (paymentCheck) {
  console.log('支付订单校验详情:', paymentCheck.detail);
}
// 从 metrics.scenarios 查找确认相关
if (metrics.scenarios) {
  Object.keys(metrics.scenarios).forEach(k => {
    if (k.includes('确认') || k.includes('支付') || k.includes('payment') || k.includes('confirm')) {
      console.log('指标', k, ':', JSON.stringify(metrics.scenarios[k]));
    }
  });
}

// 解析 confirmed 球员数
let confirmedPlayers = 0;
if (matchStatusDetail && matchStatusDetail.detail) {
  // 无法直接从detail获取，需要从其他方式推断
}
// 从 integrityChecks 的 MatchPlayer 引用完整性 detail 中可能包含信息
// 或者从 metrics 的 overall 推断
console.log('overall metrics:', JSON.stringify(metrics.overall));

// ==================== 6. 场地确认阶段 ====================
console.log('\n【6. 场地确认阶段】');
// 从 Phase 2 (场地创建 + 时段发布) 和 integrityChecks 的时段预订一致性获取
const venueCheck = data.integrityChecks.find(ic => ic.label.includes('时段预订一致性'));
if (venueCheck) {
  console.log('场地时段校验详情:', venueCheck.detail);
}

// ==================== 7. 比赛日流程 ====================
console.log('\n【7. 比赛日流程】');
// 实际开始的比赛数 = 从 integrityChecks 获取的比赛数
console.log('实际开始的比赛数:', matchCount);

// ==================== 8. 反馈阶段 ====================
console.log('\n【8. 反馈阶段】');
// 从 integrityChecks 的反馈评分范围获取
const feedbackCheck = data.integrityChecks.find(ic => ic.label.includes('反馈评分范围'));
if (feedbackCheck) {
  console.log('反馈评分校验详情:', feedbackCheck.detail);
}
// 乐观锁版本号
const versionCheck = data.integrityChecks.find(ic => ic.label.includes('乐观锁版本号'));
if (versionCheck) {
  console.log('版本号校验详情:', versionCheck.detail);
}

// 从 metrics.scenarios 查找反馈相关
if (metrics.scenarios) {
  Object.keys(metrics.scenarios).forEach(k => {
    if (k.includes('反馈') || k.includes('feedback') || k.includes('评分')) {
      console.log('指标', k, ':', JSON.stringify(metrics.scenarios[k]));
    }
  });
}

// ==================== 整体汇总 ====================
console.log('\n【整体汇总】');
console.log('总测试数:', data.summary.totalTests);
console.log('通过:', data.summary.passed);
console.log('失败:', data.summary.failed);
console.log('跳过:', data.summary.skipped);
console.log('通过率:', data.summary.passRate);
console.log('总耗时:', data.summary.totalDurationMs + 'ms (' + (data.summary.totalDurationMs/1000/60).toFixed(2) + '分钟)');
console.log('环境: Node', data.environment.node, ', 平台:', data.environment.platform, ', 内存:', data.environment.memoryMB + 'MB');
