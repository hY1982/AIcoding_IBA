/**
 * 公共 API 错误消息提取工具
 *
 * 从 axios 错误响应中提取后端返回的 message 字段，
 * 若无法提取则返回默认的网络错误提示。
 */
export function extractApiErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const axiosError = error as { response?: { data?: { message?: string } } };
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
  }
  return '网络错误，请稍后重试';
}
