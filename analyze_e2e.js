const fs = require('fs');
const data = JSON.parse(fs.readFileSync('d:/AI_coding_projects/AIcoding_IBA/server/scripts/e2e-bot-report-humanDrivenStress-2026-06-30T01-47-03-906Z.json', 'utf8'));

// 1. 各阶段通过/失败统计
console.log('=== 各阶段统计 ===');
data.phases.forEach(p => {
  console.log(p.name + ': 通过=' + p.passed + ', 失败=' + p.failed + ', 跳过=' + p.skipped + ', 耗时=' + p.totalDurationMs + 'ms');
});

// 2. 球员注册数量和能力值分布
const players = data.registrations ? data.registrations.players : [];
console.log('\n=== 球员注册统计 ===');
console.log('注册球员数:', players.length);
if (players.length > 0) {
  const abilities = players.map(p => p.ability).filter(a => typeof a === 'number');
  abilities.sort((a,b) => a-b);
  const min = abilities[0];
  const max = abilities[abilities.length-1];
  const avg = abilities.reduce((s,a) => s+a, 0) / abilities.length;
  const median = abilities.length % 2 === 0 
    ? (abilities[abilities.length/2 - 1] + abilities[abilities.length/2]) / 2 
    : abilities[Math.floor(abilities.length/2)];
  const variance = abilities.reduce((s,a) => s + Math.pow(a - avg, 2), 0) / abilities.length;
  const stdDev = Math.sqrt(variance);
  console.log('能力值 - 最小:', min, '最大:', max, '平均:', avg.toFixed(2), '中位数:', median, '标准差:', stdDev.toFixed(2));
}

// 3. 意向提交阶段
const phase2 = data.phases.find(p => p.name.includes('Phase 2'));
console.log('\n=== 意向提交阶段 ===');
if (phase2 && phase2.results) {
  const success = phase2.results.filter(r => r.status === 'PASS').length;
  const fail = phase2.results.filter(r => r.status === 'FAIL').length;
  console.log('成功:', success, '失败:', fail, '总计:', phase2.results.length);
}

// 4. 匹配引擎阶段
const phase3 = data.phases.find(p => p.name.includes('Phase 3'));
console.log('\n=== 匹配引擎阶段 ===');
if (phase3 && phase3.results) {
  const success = phase3.results.filter(r => r.status === 'PASS').length;
  const fail = phase3.results.filter(r => r.status === 'FAIL').length;
  console.log('成功:', success, '失败:', fail, '总计:', phase3.results.length);
  // 状态分布
  const statusDist = {};
  phase3.results.forEach(r => {
    if (r.detail && r.detail.status) {
      statusDist[r.detail.status] = (statusDist[r.detail.status] || 0) + 1;
    }
  });
  console.log('状态分布:', JSON.stringify(statusDist));
}

// 5. 确认与支付阶段
const phase4 = data.phases.find(p => p.name.includes('Phase 4'));
console.log('\n=== 确认与支付阶段 ===');
if (phase4 && phase4.results) {
  const success = phase4.results.filter(r => r.status === 'PASS').length;
  const fail = phase4.results.filter(r => r.status === 'FAIL').length;
  console.log('成功:', success, '失败:', fail, '总计:', phase4.results.length);
  if (phase4.results.length > 0) {
    console.log('确认成功率:', ((success/phase4.results.length)*100).toFixed(2) + '%');
  }
}

// 6. 场地确认阶段
const phase5 = data.phases.find(p => p.name.includes('Phase 5'));
console.log('\n=== 场地确认阶段 ===');
if (phase5 && phase5.results) {
  const success = phase5.results.filter(r => r.status === 'PASS').length;
  const fail = phase5.results.filter(r => r.status === 'FAIL').length;
  console.log('成功:', success, '失败:', fail, '总计:', phase5.results.length);
  if (phase5.results.length > 0) {
    console.log('确认成功率:', ((success/phase5.results.length)*100).toFixed(2) + '%');
  }
}

// 7. 比赛日流程
const phase7 = data.phases.find(p => p.name.includes('Phase 7'));
console.log('\n=== 比赛日流程 ===');
if (phase7 && phase7.results) {
  console.log('结果数:', phase7.results.length);
  phase7.results.slice(0, 5).forEach(r => console.log('  ', r.label, r.status, JSON.stringify(r.detail).substring(0,100)));
}

// 8. 反馈阶段
const phase8 = data.phases.find(p => p.name.includes('Phase 8'));
console.log('\n=== 反馈阶段 ===');
if (phase8 && phase8.results) {
  const success = phase8.results.filter(r => r.status === 'PASS').length;
  const fail = phase8.results.filter(r => r.status === 'FAIL').length;
  console.log('成功:', success, '失败:', fail, '总计:', phase8.results.length);
  if (phase8.results.length > 0) {
    console.log('反馈提交率:', ((success/phase8.results.length)*100).toFixed(2) + '%');
  }
}

// 汇总
console.log('\n=== 整体汇总 ===');
console.log('总测试数:', data.summary.totalTests);
console.log('通过:', data.summary.passed);
console.log('失败:', data.summary.failed);
console.log('跳过:', data.summary.skipped);
console.log('通过率:', data.summary.passRate);
console.log('总耗时:', data.summary.totalDurationMs + 'ms');
