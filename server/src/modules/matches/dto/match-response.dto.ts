import { ApiProperty } from '@nestjs/swagger';
import { MatchStatus, MATCH_STATUSES, MatchPlayerStatus, MATCH_PLAYER_STATUSES } from '@shared/match';

/**
 * Swagger 响应类型类
 *
 * 独立文件以便复用，避免 Controller 文件过长。
 * 所有类使用 @ApiProperty 装饰器，用于 Swagger 文档生成。
 */

// ==================== 子对象响应 ====================

export class MatchTeamResponse {
  @ApiProperty({ description: '队伍编号', example: 1 })
  teamNumber!: number;

  @ApiProperty({ description: '队伍名称', nullable: true, example: 'Team 1' })
  teamName!: string | null;

  @ApiProperty({ description: '平均能力值', nullable: true, example: '55.00' })
  avgAbility!: string | null;
}

export class MatchPlayerResponse {
  @ApiProperty({ description: '球员ID', example: 42 })
  playerId!: number;

  @ApiProperty({ description: '球员昵称', nullable: true, example: 'Player_0001' })
  nickname!: string | null;

  @ApiProperty({ description: '队伍编号', nullable: true, example: 1 })
  teamNumber!: number | null;

  @ApiProperty({ enum: MATCH_PLAYER_STATUSES, description: '参赛状态', example: 'invited' })
  status!: MatchPlayerStatus;
}

// ==================== 列表项响应 ====================

export class MatchListResponseDto {
  @ApiProperty({ description: '比赛ID', example: 1 })
  id!: number;

  @ApiProperty({ description: '场地ID', example: 1 })
  venueId!: number;

  @ApiProperty({ description: '场地名称', nullable: true, example: 'Test Court' })
  venueName!: string | null;

  @ApiProperty({ description: '赛制ID', example: 1 })
  formatId!: number;

  @ApiProperty({ description: '赛制名称', nullable: true, example: '3v3 Short' })
  formatName!: string | null;

  @ApiProperty({ description: '开始时间 ISO8601', example: '2026-06-15T14:00:00.000Z' })
  startTime!: Date;

  @ApiProperty({ description: '结束时间 ISO8601', example: '2026-06-15T16:00:00.000Z' })
  endTime!: Date;

  @ApiProperty({ enum: MATCH_STATUSES, description: '比赛状态', example: 'pending_players' })
  status!: MatchStatus;

  @ApiProperty({ description: '队伍数量', example: 3 })
  teamCount!: number;

  @ApiProperty({ description: '每队人数', example: 3 })
  playersPerTeam!: number;

  @ApiProperty({ description: '总参赛人数', example: 9 })
  totalPlayers!: number;

  @ApiProperty({ description: '已确认人数', example: 0 })
  confirmedPlayers!: number;

  @ApiProperty({ description: '保证金金额', example: '50.00' })
  depositAmount!: string;

  @ApiProperty({ description: '地区编码', nullable: true, example: 'shenzhen_futian' })
  regionCode!: string | null;

  @ApiProperty({
    enum: MATCH_PLAYER_STATUSES,
    description: '当前球员在该比赛中的状态',
    example: 'invited',
  })
  playerStatus!: MatchPlayerStatus;

  @ApiProperty({ description: '当前球员的队伍编号', nullable: true, example: 1 })
  teamNumber!: number | null;

  @ApiProperty({ description: '创建时间', example: '2026-06-14T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: '更新时间', example: '2026-06-14T10:00:00.000Z' })
  updatedAt!: Date;
}

// ==================== 详情响应 ====================

export class MatchDetailResponseDto extends MatchListResponseDto {
  @ApiProperty({ type: [MatchTeamResponse], description: '队伍列表' })
  teams!: MatchTeamResponse[];

  @ApiProperty({ type: [MatchPlayerResponse], description: '参赛球员列表' })
  players!: MatchPlayerResponse[];

  @ApiProperty({ description: '群聊房间ID', nullable: true, example: null })
  groupChatId!: string | null;
}

// ==================== 分页响应 ====================

export class MatchPaginatedResponse {
  @ApiProperty({ description: '当前页码' })
  page!: number;

  @ApiProperty({ description: '每页数量' })
  pageSize!: number;

  @ApiProperty({ description: '总记录数' })
  total!: number;

  @ApiProperty({ type: [MatchListResponseDto], description: '比赛列表' })
  list!: MatchListResponseDto[];
}

// ==================== 确认参赛响应 ====================

export class ConfirmParticipationResponseDto {
  @ApiProperty({ description: '是否成功', example: true })
  success!: boolean;

  @ApiProperty({ description: '比赛ID', example: 1 })
  matchId!: number;

  @ApiProperty({ description: '球员ID', example: 42 })
  playerId!: number;

  @ApiProperty({ description: '支付订单号', example: 'ORD20260614100000' })
  orderNo!: string;

  @ApiProperty({ enum: MATCH_PLAYER_STATUSES, description: '球员参赛状态', example: 'confirmed' })
  status!: MatchPlayerStatus;

  @ApiProperty({ enum: MATCH_STATUSES, description: '比赛状态', example: 'pending_players' })
  matchStatus!: MatchStatus;

  @ApiProperty({ description: '提示信息', example: '确认参赛成功，等待其他球员确认' })
  message!: string;

  @ApiProperty({ description: '是否已确认（幂等性标记）', required: false, example: false })
  alreadyConfirmed?: boolean;
}

// ==================== 拒绝参赛响应 ====================

export class DeclineParticipationResponseDto {
  @ApiProperty({ description: '是否成功', example: true })
  success!: boolean;

  @ApiProperty({ description: '提示信息', example: '已拒绝参赛' })
  message!: string;
}
