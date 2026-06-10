/**
 * 前端表单验证规则
 *
 * ⚠️ 契约同步责任：修改此处规则时，必须同步更新后端对应 DTO 文件：
 * - server/src/modules/auth/dto/register.dto.ts
 * - server/src/modules/auth/dto/login.dto.ts
 * - server/src/modules/players/dto/update-player.dto.ts
 *
 * 后端验证规则（class-validator）：
 * - 手机号：@Matches(/^1[3-9]\d{9}$/)
 * - 密码：@Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)
 * - 昵称：@MinLength(1) @MaxLength(50)
 * - 年龄：@Min(1) @Max(120)
 * - 身高：@Min(50) @Max(300)
 * - 体重/臂展/站立摸高/起跳摸高：@IsPositive()（可选字段）
 * - 位置：@ArrayMaxSize(3) @IsEnum(BASKETBALL_POSITIONS)
 * - 公司名称：@MaxLength(100)
 * - 联系人姓名：@MaxLength(50)
 * - 联系人手机号：@Matches(/^1[3-9]\d{9}$/)
 */

import { BASKETBALL_POSITIONS } from '@shared/player';

const PHONE_REGEX = /^1[3-9]\d{9}$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function validatePhone(phone: string): string | null {
  if (!phone || phone.trim() === '') {
    return '请输入手机号';
  }
  if (!PHONE_REGEX.test(phone)) {
    return '请输入有效的11位手机号码';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password || password.trim() === '') {
    return '请输入密码';
  }
  if (!PASSWORD_REGEX.test(password)) {
    return '密码必须至少8位，且包含至少1个字母和1个数字';
  }
  return null;
}

export function validateNickname(nickname: string): string | null {
  if (!nickname || nickname.trim() === '') {
    return '请输入昵称';
  }
  if (nickname.length > 50) {
    return '昵称不能超过50个字符';
  }
  return null;
}

export function validatePlayerAge(age: number): string | null {
  if (age < 1 || age > 120) {
    return '年龄必须在1-120之间';
  }
  return null;
}

export function validateHeight(height: number): string | null {
  if (height < 50 || height > 300) {
    return '身高必须在50-300cm之间';
  }
  return null;
}

export function validatePositions(positions: string[]): string | null {
  if (positions.length > 3) {
    return '最多选择3个位置';
  }
  const validPositions = new Set(BASKETBALL_POSITIONS);
  for (const pos of positions) {
    if (!validPositions.has(pos as (typeof BASKETBALL_POSITIONS)[number])) {
      return '位置必须是 PG, SG, SF, PF, C 之一';
    }
  }
  return null;
}

export function validateOptionalPositiveNumber(
  value: number | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  if (Number.isNaN(value)) return `${fieldName}必须是有效数字`;
  if (value <= 0) return `${fieldName}必须大于0`;
  return null;
}

export function validateCompanyName(companyName: string): string | null {
  if (!companyName || companyName.trim() === '') {
    return '请输入公司名称';
  }
  if (companyName.length > 100) {
    return '公司名称不能超过100个字符';
  }
  return null;
}

export function validateContactName(contactName: string): string | null {
  if (!contactName || contactName.trim() === '') {
    return '请输入联系人姓名';
  }
  if (contactName.length > 50) {
    return '联系人姓名不能超过50个字符';
  }
  return null;
}

export function validateContactPhone(contactPhone: string): string | null {
  if (!contactPhone || contactPhone.trim() === '') {
    return '请输入联系人手机号';
  }
  if (!PHONE_REGEX.test(contactPhone)) {
    return '请输入有效的11位手机号码';
  }
  return null;
}
