import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * 全局 HTTP 异常过滤器
 *
 * 捕获所有 HttpException，将其转换为统一的响应格式：
 * `{ code: httpStatus, message: errorMessage, data: null }`
 *
 * 这确保了 API 的错误响应与成功响应具有统一的结构，
 * 便于前端统一处理。
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message = this.extractMessage(exceptionResponse);

    response.status(status).json({
      code: status,
      message,
      data: null,
    });
  }

  /**
   * 从异常响应中提取可读的错误消息
   *
   * 处理以下情况：
   * 1. 字符串消息：直接返回
   * 2. class-validator 验证错误数组：提取每个错误的字段和约束信息
   * 3. NestJS 标准错误对象：提取 message 字段
   */
  private extractMessage(exceptionResponse: string | object): string {
    // 字符串消息直接返回
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    // 处理 class-validator 的验证错误数组（数组形式传入时）
    if (Array.isArray(exceptionResponse)) {
      return this.formatValidationErrors(
        exceptionResponse as Array<Record<string, unknown>>,
      );
    }

    // 处理对象形式的响应
    const response = exceptionResponse as Record<string, unknown>;

    // 处理 NestJS 标准错误对象 { statusCode, message, error }
    if (response.message !== undefined) {
      if (Array.isArray(response.message)) {
        // 检查 message 数组是否包含验证错误对象（来自 class-validator）
        const messages = response.message as unknown[];
        if (
          messages.length > 0 &&
          typeof messages[0] === 'object' &&
          messages[0] !== null &&
          'property' in (messages[0] as Record<string, unknown>)
        ) {
          return this.formatValidationErrors(
            messages as Array<Record<string, unknown>>,
          );
        }
        return messages.join('; ');
      }
      return String(response.message);
    }

    // 兜底：返回 error 字段或序列化整个对象
    if (response.error !== undefined) {
      return String(response.error);
    }

    return JSON.stringify(response);
  }

  /**
   * 格式化 class-validator 验证错误数组为可读字符串
   */
  private formatValidationErrors(
    errors: Array<Record<string, unknown>>,
  ): string {
    const messages: string[] = [];

    for (const error of errors) {
      const property = String(error.property || 'unknown');
      const constraints = error.constraints as Record<string, string>;

      if (constraints && typeof constraints === 'object') {
        const constraintMessages = Object.values(constraints);
        messages.push(`${property}: ${constraintMessages.join(', ')}`);
      } else {
        messages.push(`${property}: validation failed`);
      }
    }

    return messages.join('; ');
  }
}
