import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '@shared/common';

/**
 * 全局响应转换拦截器
 *
 * 将所有 Controller 的成功响应自动包装为统一的 ApiResponse 格式：
 * `{ code: 0, message: 'success', data: ... }`
 *
 * 如果返回值已经是 ApiResponse 格式（包含 code/message/data 字段），则直接透传，
 * 避免重复包装。这允许 Controller 在特殊场景下返回自定义的 ApiResponse。
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // 如果数据已经是 ApiResponse 格式，直接透传
        if (
          data !== null &&
          typeof data === 'object' &&
          !Array.isArray(data) &&
          'code' in data &&
          'message' in data &&
          'data' in data
        ) {
          return data as ApiResponse<T>;
        }

        // 包装为统一响应格式
        return {
          code: 0,
          message: 'success',
          data: data ?? null,
        } as ApiResponse<T>;
      }),
    );
  }
}
