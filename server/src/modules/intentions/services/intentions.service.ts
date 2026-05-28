import { Injectable } from '@nestjs/common';

/**
 * IntentionsService — 意向业务逻辑服务占位。
 *
 * 当前 Module 1.4 仅定义数据层实体，业务逻辑将在 Module 2.5 中实现：
 * - 提交比赛意向（含提前1小时校验）
 * - 修改/取消意向
 * - expires_at 自动计算（submitted_at + acceptable_wait_minutes）
 * - region_code 自动填充策略
 * - 状态机流转校验
 */
@Injectable()
export class IntentionsService {}
