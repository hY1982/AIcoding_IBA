import { apiClient } from './client';
import {
  AdminListQuery,
  AdminPlayerListResponse,
  AdminVenueListResponse,
  AdminMatchListResponse,
  AdminStats,
  UpdateSystemParamRequest,
} from '@shared/admin';
import { SystemParam } from '@shared/system';

/**
 * 管理后台 API 封装
 *
 * 所有接口自动携带 JWT Token（通过 apiClient 拦截器）。
 */

/**
 * 获取球员列表
 */
export async function getPlayers(query: AdminListQuery = {}): Promise<AdminPlayerListResponse> {
  const response = await apiClient.get('/admin/players', { params: query });
  return response.data.data;
}

/**
 * 获取场地列表
 */
export async function getVenues(query: AdminListQuery = {}): Promise<AdminVenueListResponse> {
  const response = await apiClient.get('/admin/venues', { params: query });
  return response.data.data;
}

/**
 * 获取比赛列表
 */
export async function getMatches(query: AdminListQuery = {}): Promise<AdminMatchListResponse> {
  const response = await apiClient.get('/admin/matches', { params: query });
  return response.data.data;
}

/**
 * 获取平台数据统计
 */
export async function getStats(): Promise<AdminStats> {
  const response = await apiClient.get('/admin/stats');
  return response.data.data;
}

/**
 * 获取系统参数列表
 */
export async function getSystemParams(): Promise<SystemParam[]> {
  const response = await apiClient.get('/admin/params');
  return response.data.data;
}

/**
 * 更新系统参数
 */
export async function updateSystemParam(
  key: string,
  data: UpdateSystemParamRequest,
): Promise<SystemParam> {
  const response = await apiClient.put(`/admin/params/${key}`, data);
  return response.data.data;
}
