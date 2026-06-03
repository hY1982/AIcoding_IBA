/**
 * 数据脱敏工具类
 *
 * 集中管理所有敏感数据的脱敏规则，确保：
 * - 代码复用：所有服务层查询共用同一套脱敏逻辑
 * - 易于维护：规则变更只需修改一处
 * - 可测试：独立单元测试验证脱敏正确性
 *
 * 使用场景：
 * - PlayerService.findById / findByUserId — 球员资料脱敏
 * - AuthService.buildAuthResponse — 认证响应脱敏
 * - AdminController（可选）— 管理员查看完整信息时跳过脱敏
 */

/**
 * 手机号脱敏：13812345678 → 138****5678
 *
 * 规则：保留前3位和后4位，中间用 **** 替换
 * 非11位手机号直接返回原值（可能是已加密存储的密文）
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || phone.length !== 11) {
    return phone || '';
  }
  return phone.slice(0, 3) + '****' + phone.slice(7);
}

/**
 * 真实姓名脱敏：张三丰 → 张**
 *
 * 规则：保留姓氏（第一个字符），其余用 ** 替换
 * 单字姓名直接返回原值
 * 空值返回空字符串
 */
export function maskRealName(name: string | null | undefined): string {
  if (!name) {
    return '';
  }
  if (name.length <= 1) {
    return name;
  }
  return name[0] + '**';
}

/**
 * 身份证号脱敏：110101199001011234 → 110***********1234
 *
 * 规则：保留前3位和后4位，中间用 * 替换
 * 不足7位的直接返回原值
 */
export function maskIdCard(idCard: string | null | undefined): string {
  if (!idCard || idCard.length < 7) {
    return idCard || '';
  }
  return idCard.slice(0, 3) + '*'.repeat(idCard.length - 7) + idCard.slice(-4);
}
