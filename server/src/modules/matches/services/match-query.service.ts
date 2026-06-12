import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from '../entities/match.entity';
import { MatchPlayer } from '../entities/match-player.entity';
import { MatchTeam } from '../entities/match-team.entity';
import { QueryMatchDto } from '../dto/query-match.dto';
import { PaginatedResponse } from '@shared/common';
import { MatchPlayerStatus } from '@shared/match';

/**
 * 比赛列表项响应
 */
export interface MatchListResponse {
  id: number;
  venueId: number;
  venueName: string | null;
  formatId: number;
  formatName: string | null;
  startTime: Date;
  endTime: Date;
  status: string;
  teamCount: number;
  playersPerTeam: number;
  totalPlayers: number;
  confirmedPlayers: number;
  depositAmount: string;
  regionCode: string | null;
  playerStatus: MatchPlayerStatus;
  teamNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 比赛详情响应（含队伍和参赛球员列表）
 */
export interface MatchDetailResponse extends MatchListResponse {
  teams: MatchTeamItem[];
  players: MatchPlayerItem[];
  groupChatId: string | null;
}

export interface MatchTeamItem {
  teamNumber: number;
  teamName: string | null;
  avgAbility: string | null;
}

export interface MatchPlayerItem {
  playerId: number;
  nickname: string | null;
  teamNumber: number | null;
  status: MatchPlayerStatus;
  isReserve: boolean;
}

/**
 * 比赛查询服务
 *
 * 提供比赛列表和详情查询功能，内含参赛资格校验（Service 层权限校验）。
 * 与 MatchConfirmationService 职责分离：本服务专注读操作，后者专注写操作。
 *
 * 权限设计：
 * - findMyMatches：通过 match_players innerJoin 自然过滤，仅返回球员参与的比赛
 * - findMatchDetail：Service 层校验参赛资格，非参与者得到 404，不暴露比赛存在性
 */
@Injectable()
export class MatchQueryService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    @InjectRepository(MatchPlayer)
    private readonly matchPlayerRepo: Repository<MatchPlayer>,
    @InjectRepository(MatchTeam)
    private readonly matchTeamRepo: Repository<MatchTeam>,
  ) {}

  /**
   * 查询球员参与的比赛列表（分页）
   *
   * 通过 match_players innerJoin 确保只返回当前球员有记录的比赛。
   * 同时获取 venue.name 和 format.name 用于展示。
   * 支持按比赛状态筛选。
   */
  async findMyMatches(
    playerId: number,
    query: QueryMatchDto,
  ): Promise<PaginatedResponse<MatchListResponse>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const baseQb = () =>
      this.matchRepo
        .createQueryBuilder('match')
        .innerJoin('match_players', 'mp', 'mp.match_id = match.id')
        .leftJoin('venues', 'venue', 'venue.id = match.venue_id')
        .leftJoin('formats', 'format', 'format.id = match.format_id')
        .where('mp.player_id = :playerId', { playerId });

    // Count query
    const countQb = baseQb();
    if (query.status) {
      countQb.andWhere('match.status = :status', { status: query.status });
    }
    const total = await countQb.getCount();

    // Data query
    const dataQb = baseQb()
      .addSelect([
        'venue.name AS venue_name',
        'format.name AS format_name',
        'mp.status AS mp_status',
        'mp.team_number AS mp_team_number',
      ]);
    if (query.status) {
      dataQb.andWhere('match.status = :status', { status: query.status });
    }
    dataQb.orderBy('match.start_time', 'DESC').offset(skip).limit(pageSize);

    const rawResults = await dataQb.getRawMany();

    const responseList: MatchListResponse[] = rawResults.map((raw) => ({
      id: Number(raw.match_id),
      venueId: Number(raw.match_venue_id),
      venueName: raw.venue_name ?? null,
      formatId: Number(raw.match_format_id),
      formatName: raw.format_name ?? null,
      startTime: raw.match_start_time,
      endTime: raw.match_end_time,
      status: raw.match_status,
      teamCount: Number(raw.match_team_count),
      playersPerTeam: Number(raw.match_players_per_team),
      totalPlayers: Number(raw.match_total_players),
      confirmedPlayers: Number(raw.match_confirmed_players),
      depositAmount: raw.match_deposit_amount,
      regionCode: raw.match_region_code ?? null,
      playerStatus: (raw.mp_status as MatchPlayerStatus) ?? 'invited',
      teamNumber: raw.mp_team_number != null ? Number(raw.mp_team_number) : null,
      createdAt: raw.match_created_at,
      updatedAt: raw.match_updated_at,
    }));

    return { page, pageSize, total, list: responseList };
  }

  /**
   * 查询比赛详情（含队伍分配和参赛球员列表）
   *
   * 权限校验：Service 层验证当前球员是否为比赛参与者。
   * 非参与者得到 NotFoundException（不暴露比赛存在性）。
   * 此设计确保方法可被定时任务等其他模块安全调用。
   */
  async findMatchDetail(
    matchId: number,
    playerId: number,
  ): Promise<MatchDetailResponse> {
    // 1. 校验参赛资格（Service 层权限校验）
    const matchPlayer = await this.matchPlayerRepo.findOne({
      where: { matchId, playerId },
    });
    if (!matchPlayer) {
      throw new NotFoundException('比赛不存在或您不是该比赛的参与者');
    }

    // 2. 查询比赛 + 关联场地/赛制名称（单次 getRawOne 查询）
    const rawMatch = await this.matchRepo
      .createQueryBuilder('match')
      .leftJoin('venues', 'venue', 'venue.id = match.venue_id')
      .leftJoin('formats', 'format', 'format.id = match.format_id')
      .addSelect(['venue.name AS venue_name', 'format.name AS format_name'])
      .where('match.id = :matchId', { matchId })
      .getRawOne();

    if (!rawMatch) {
      throw new NotFoundException('比赛不存在');
    }

    // 3. 查询队伍列表
    const teams = await this.matchTeamRepo.find({
      where: { matchId },
      order: { teamNumber: 'ASC' },
    });

    // 4. 查询参赛球员列表（含球员基本信息）
    const players = await this.matchPlayerRepo
      .createQueryBuilder('mp')
      .leftJoin('players', 'player', 'player.id = mp.player_id')
      .leftJoin('users', 'u', 'u.id = player.user_id')
      .addSelect(['player.id', 'u.nickname'])
      .where('mp.match_id = :matchId', { matchId })
      .orderBy('mp.team_number', 'ASC', 'NULLS LAST')
      .getRawMany();

    const teamItems: MatchTeamItem[] = teams.map((t) => ({
      teamNumber: t.teamNumber,
      teamName: t.teamName,
      avgAbility: t.avgAbility != null ? String(t.avgAbility) : null,
    }));

    const playerItems: MatchPlayerItem[] = players.map((p) => ({
      playerId: Number(p.mp_player_id),
      nickname: p.u_nickname ?? null,
      teamNumber: p.mp_team_number != null ? Number(p.mp_team_number) : null,
      status: p.mp_status as MatchPlayerStatus,
      isReserve: p.mp_is_reserve ?? false,
    }));

    return {
      id: Number(rawMatch.match_id),
      venueId: Number(rawMatch.match_venue_id),
      venueName: rawMatch.venue_name ?? null,
      formatId: Number(rawMatch.match_format_id),
      formatName: rawMatch.format_name ?? null,
      startTime: rawMatch.match_start_time,
      endTime: rawMatch.match_end_time,
      status: rawMatch.match_status,
      teamCount: Number(rawMatch.match_team_count),
      playersPerTeam: Number(rawMatch.match_players_per_team),
      totalPlayers: Number(rawMatch.match_total_players),
      confirmedPlayers: Number(rawMatch.match_confirmed_players),
      depositAmount: rawMatch.match_deposit_amount,
      regionCode: rawMatch.match_region_code ?? null,
      playerStatus: matchPlayer.status,
      teamNumber: matchPlayer.teamNumber,
      createdAt: rawMatch.match_created_at,
      updatedAt: rawMatch.match_updated_at,
      teams: teamItems,
      players: playerItems,
      groupChatId: rawMatch.match_group_chat_id ?? null,
    };
  }

}
