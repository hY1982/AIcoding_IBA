/**
 * 短信服务抽象接口
 *
 * 定义发送短信验证码的标准契约。MVP 阶段使用 MockSmsService 实现，
 * 后续接入真实短信服务（阿里云短信、腾讯云短信等）时，只需提供新的实现类并替换注入即可。
 */
export interface SmsService {
  /**
   * 发送短信验证码
   *
   * @param phone - 目标手机号
   * @param scene - 使用场景（如注册、登录、重置密码），用于未来差异化处理
   * @returns 发送结果，包含是否成功、请求ID和过期时间
   */
  sendSmsCode(
    phone: string,
    scene?: string,
  ): Promise<{
    success: boolean;
    requestId: string;
    expiresIn: number;
  }>;
}

/**
 * SMS Service 注入令牌
 */
export const SMS_SERVICE_TOKEN = Symbol('SmsService');
