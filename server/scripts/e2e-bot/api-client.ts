/**
 * E2E Bot 测试 — HTTP API 客户端
 *
 * 封装所有 HTTP 调用，与真人使用同一套 API 接口。
 * 响应格式: { code: number, message: string, data: T }
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { API_BASE_URL } from './config';
import { MetricsCollector } from './metrics-collector';

// --- 通用响应类型 ---

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface ApiError {
  code: number;
  message: string;
  data: null;
}

// --- 请求 DTO 类型 ---

export interface PlayerRegisterPayload {
  phone: string;
  password: string;
  nickname: string;
  userType: 'player';
  birthDate: string;
  startPlayingDate: string;
  gender: 'male' | 'female';
  height: number;
  weight?: number;
  wingspan?: number;
  standingReach?: number;
  jumpingReach?: number;
  positions?: string[];
  regionCode?: string;
}

export interface VenueManagerRegisterPayload {
  phone: string;
  password: string;
  nickname: string;
  userType: 'venue_manager';
  companyName: string;
  contactName: string;
  contactPhone: string;
  regionCode?: string;
}

export type RegisterPayload = PlayerRegisterPayload | VenueManagerRegisterPayload;

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface CreateVenuePayload {
  name: string;
  address: string;
  pricePerHour: number;
  courtCount?: number;
  latitude?: number;
  longitude?: number;
  floorMaterial?: string;
  lighting?: string;
  courtType?: string;
  ventilation?: boolean;
  bigFan?: boolean;
  airCondition?: boolean;
  turnoverTime?: number;
  parking?: boolean;
  restroom?: boolean;
  shower?: boolean;
  lockerRoom?: boolean;
  videoRecord?: boolean;
  regionCode?: string;
}

export interface CreateTimeSlotPayload {
  slotDate: string;
  startTime: string;
  endTime: string;
}

export interface CreateIntentionPayload {
  startTime: string;
  durationMinutes: number;
  acceptableWaitMinutes?: number;
  venueIds: Array<{ venueId: number; priority: number }>;
  formatIds: Array<{ formatId: number; priority: number }>;
}

export interface SendMessagePayload {
  content: string;
  messageType?: 'text' | 'image';
}

export interface CreateFeedbackPayload {
  matchId: number;
  playerId: number;
  overallRating: number;
  overallReason?: string;
  playerRatings: Array<{
    ratedPlayerId: number;
    levelMatch?: 'unclear' | 'lower' | 'equal' | 'higher';
    sportsmanship?: 'good' | 'average' | 'poor';
    actionCleanliness?: 'clean' | 'average' | 'dirty';
    isPunctual?: boolean;
  }>;
}

export interface UpdatePlayerPayload {
  birthDate?: string;
  startPlayingDate?: string;
  gender?: 'male' | 'female';
  height?: number;
  weight?: number;
  wingspan?: number;
  standingReach?: number;
  jumpingReach?: number;
  positions?: string[];
  regionCode?: string;
}

// --- API 客户端 ---

export class ApiClient {
  private client: AxiosInstance;
  private accessToken?: string;
  private refreshToken?: string;
  private metrics?: MetricsCollector;

  constructor(baseUrl: string = API_BASE_URL, metrics?: MetricsCollector) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true, // 不抛出 HTTP 错误，让我们自己处理
    });
    this.metrics = metrics;
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  getAccessToken(): string | undefined {
    return this.accessToken;
  }

  getRefreshToken(): string | undefined {
    return this.refreshToken;
  }

  /** 创建一个新的 ApiClient 实例，复用相同配置但独立 Token */
  clone(): ApiClient {
    return new ApiClient(this.client.defaults.baseURL, this.metrics);
  }

  // ─────────────────────────────────────────────
  // 认证
  // ─────────────────────────────────────────────

  async register(payload: RegisterPayload): Promise<any> {
    return this.post('/auth/register', payload);
  }

  async login(payload: LoginPayload): Promise<any> {
    const data = await this.post('/auth/login', payload);
    if (data?.tokens) {
      this.setTokens(data.tokens.accessToken, data.tokens.refreshToken);
    } else if (data?.accessToken) {
      this.setTokens(data.accessToken, data.refreshToken);
    }
    return data;
  }

  async refresh(): Promise<any> {
    const data = await this.post('/auth/refresh', {
      refreshToken: this.refreshToken,
    });
    if (data?.tokens) {
      this.setTokens(data.tokens.accessToken, data.tokens.refreshToken);
    }
    return data;
  }

  // ─────────────────────────────────────────────
  // 球员
  // ─────────────────────────────────────────────

  async getPlayerProfile(): Promise<any> {
    return this.get('/players/profile');
  }

  async updatePlayerProfile(payload: UpdatePlayerPayload): Promise<any> {
    return this.put('/players/profile', payload);
  }

  // ─────────────────────────────────────────────
  // 场地
  // ─────────────────────────────────────────────

  async createVenue(payload: CreateVenuePayload): Promise<any> {
    return this.post('/venues', payload);
  }

  async getVenues(page = 1, pageSize = 50): Promise<any> {
    return this.get(`/venues?page=${page}&pageSize=${pageSize}`);
  }

  async getVenueDetail(id: number): Promise<any> {
    return this.get(`/venues/${id}`);
  }

  async createTimeSlots(venueId: number, slots: CreateTimeSlotPayload[]): Promise<any> {
    return this.post(`/venues/${venueId}/slots`, { slots });
  }

  async getTimeSlots(venueId: number, slotDate?: string): Promise<any> {
    const query = slotDate ? `?slotDate=${slotDate}` : '';
    return this.get(`/venues/${venueId}/slots${query}`);
  }

  // ─────────────────────────────────────────────
  // 意向
  // ─────────────────────────────────────────────

  async createIntention(payload: CreateIntentionPayload): Promise<any> {
    return this.post('/intentions', payload);
  }

  async getMyIntentions(page = 1, pageSize = 50): Promise<any> {
    return this.get(`/intentions/my?page=${page}&pageSize=${pageSize}`);
  }

  async getIntentionDetail(id: number): Promise<any> {
    return this.get(`/intentions/my/${id}`);
  }

  async cancelIntention(id: number): Promise<any> {
    return this.delete(`/intentions/${id}`);
  }

  // ─────────────────────────────────────────────
  // 比赛
  // ─────────────────────────────────────────────

  async getMyMatches(page = 1, pageSize = 50): Promise<any> {
    return this.get(`/matches/my?page=${page}&pageSize=${pageSize}`);
  }

  async getMatchDetail(id: number): Promise<any> {
    return this.get(`/matches/${id}`);
  }

  async confirmMatch(matchId: number): Promise<any> {
    return this.post(`/matches/${matchId}/confirm`, {});
  }

  async declineMatch(matchId: number): Promise<any> {
    return this.post(`/matches/${matchId}/decline`, {});
  }

  // ─────────────────────────────────────────────
  // 消息
  // ─────────────────────────────────────────────

  async sendMessage(matchId: number, payload: SendMessagePayload): Promise<any> {
    return this.post(`/matches/${matchId}/messages`, payload);
  }

  async getMessageHistory(matchId: number, page = 1, pageSize = 50): Promise<any> {
    return this.get(`/matches/${matchId}/messages?page=${page}&pageSize=${pageSize}`);
  }

  // ─────────────────────────────────────────────
  // 反馈
  // ─────────────────────────────────────────────

  async createFeedback(payload: CreateFeedbackPayload): Promise<any> {
    return this.post('/feedbacks', payload);
  }

  async getPendingFeedbacks(playerId: number): Promise<any> {
    return this.get(`/feedbacks/pending/${playerId}`);
  }

  // ─────────────────────────────────────────────
  // 场地经理资料
  // ─────────────────────────────────────────────

  async getVenueManagerProfile(): Promise<any> {
    return this.get('/venue-managers/profile');
  }

  // ─────────────────────────────────────────────
  // 场地管理员功能
  // ─────────────────────────────────────────────

  async confirmVenueBooking(venueId: number, bookingId: number): Promise<any> {
    return this.put(`/venues/${venueId}/bookings/${bookingId}/confirm`, {});
  }

  async getVenueBookings(venueId: number): Promise<any> {
    return this.get(`/venues/${venueId}/bookings`);
  }

  // ─────────────────────────────────────────────
  // 公开端点
  // ─────────────────────────────────────────────

  async getFormats(): Promise<any> {
    return this.get('/formats');
  }

  // ─────────────────────────────────────────────
  // 内部 HTTP 方法
  // ─────────────────────────────────────────────

  private async request(
    method: string,
    path: string,
    body?: any,
  ): Promise<any> {
    const label = `${method} ${path.split('?')[0]}`;
    const start = performance.now();

    try {
      const headers: Record<string, string> = {};
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const response: AxiosResponse<ApiResponse> = await this.client.request({
        method,
        url: path,
        data: body,
        headers,
      });

      const durationMs = Math.round(performance.now() - start);
      const apiResp = response.data;

      // 成功响应 (code === 0 或 HTTP 2xx 且无 code 字段)
      if (response.status >= 200 && response.status < 300 && (apiResp.code === 0 || !apiResp.code)) {
        this.metrics?.record(label, 'success', durationMs);
        return apiResp.data !== undefined ? apiResp.data : apiResp;
      }

      // 错误响应
      const errorMsg = apiResp.message || `HTTP ${response.status}`;
      const err = new Error(errorMsg);
      (err as any).statusCode = response.status;
      (err as any).apiCode = apiResp.code;
      this.metrics?.record(label, 'error', durationMs, errorMsg);
      throw err;
    } catch (err: any) {
      if (err.statusCode) throw err; // 已处理的 API 错误

      const durationMs = Math.round(performance.now() - start);
      const message = err.code === 'ECONNREFUSED'
        ? `无法连接到后端服务 (${this.client.defaults.baseURL})，请确认 npm run start:dev 已启动`
        : err.message;
      this.metrics?.record(label, 'error', durationMs, message);
      throw new Error(message);
    }
  }

  private async get(path: string): Promise<any> {
    return this.request('GET', path);
  }

  private async post(path: string, body: any): Promise<any> {
    return this.request('POST', path, body);
  }

  private async put(path: string, body: any): Promise<any> {
    return this.request('PUT', path, body);
  }

  private async delete(path: string): Promise<any> {
    return this.request('DELETE', path);
  }
}

/**
 * 检查后端 HTTP 服务是否可达
 */
export async function checkServerHealth(baseUrl: string = API_BASE_URL): Promise<boolean> {
  try {
    const resp = await axios.get(`${baseUrl}/formats`, { timeout: 5000, validateStatus: () => true });
    return resp.status >= 200 && resp.status < 400;
  } catch {
    return false;
  }
}
