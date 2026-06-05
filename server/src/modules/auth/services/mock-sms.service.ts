import { Injectable } from '@nestjs/common';
import { SmsService } from '../interfaces/sms-service.interface';

/**
 * 短信服务模拟实现（MVP 阶段）
 *
 * 不调用任何外部短信服务，直接返回模拟成功响应。
 * 用于开发和测试环境，确保前端可以正常调用短信验证码接口。
 *
 * ⚠️ 标注：此为模拟实现，仅用于开发和测试。
 * 生产环境需替换为真实的短信服务实现（如阿里云短信、腾讯云短信）。
 */
@Injectable()
export class MockSmsService implements SmsService {
  /**
   * 模拟发送短信验证码
   *
   * 直接返回成功响应，包含模拟的 requestId 和过期时间（5分钟）。
   */
  async sendSmsCode(
    phone: string,
    _scene?: string,
  ): Promise<{
    success: boolean;
    requestId: string;
    expiresIn: number;
  }> {
    // 生成模拟的请求ID
    const requestId = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    return {
      success: true,
      requestId,
      expiresIn: 300, // 5分钟过期
    };
  }
}
