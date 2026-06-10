import { Timestamps } from './common';
import { VenueListItem } from './venue';

/**
 * 场地方资料（API 响应）
 *
 * 包含场地方基本信息、关联的场地列表、用户信息（脱敏后）和时间戳。
 */
export interface VenueManagerProfile extends Timestamps {
  id: number;
  userId: number;
  companyName?: string;
  contactName?: string;
  contactPhone?: string;
  // 用户信息（已脱敏）
  phone: string;
  nickname: string;
  realName: string;
  avatarUrl?: string;
  // 关联的场地列表
  venues: VenueListItem[];
}

/**
 * 更新场地方资料 DTO（前端提交）
 */
export interface UpdateVenueManagerProfileDto {
  companyName?: string;
  contactName?: string;
  contactPhone?: string;
}
