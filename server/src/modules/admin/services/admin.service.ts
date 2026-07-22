import { Injectable } from '@nestjs/common';
import { DataSource, Between } from 'typeorm';
import { Player } from '@modules/players/entities/player.entity';
import { User } from '@modules/users/entities/user.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import {
  AdminListQuery,
  AdminPlayerListResponse,
  AdminVenueListResponse,
  AdminMatchListResponse,
  AdminStats,
} from '@shared/admin';
import { SystemParamKey } from '@shared/system';

/**
 * 管理后台 Service
 *
 * 提供管理后台业务逻辑：
 * - 球员/场地/比赛列表查询（支持分页、筛选）
 * - 平台数据统计聚合
 * - 系统参数管理
 */
@Injectable()
export class AdminService {
  constructor(private readonly dataSource: DataSource) {}

  // ===== 列表查询 =====

  /**
   * 获取球员列表（完整信息，管理员视角不脱敏）
   */
  async findPlayers(query: AdminListQuery): Promise<AdminPlayerListResponse> {
    const { page = 1, pageSize = 10, keyword, sortField = 'id', sortOrder = 'asc' } = query;

    const repo = this.dataSource.getRepository(Player);
    const qb = repo.createQueryBuilder('player')
      .leftJoin('player.user', 'user')
      .addSelect(['user.phone', 'user.nickname', 'user.realName', 'user.status'])
      .orderBy(`player.${sortField}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (keyword) {
      qb.andWhere(
        '(user.nickname ILIKE :keyword OR user.phone ILIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    const [players, total] = await qb.getManyAndCount();

    const list = players.map((player) => {
      const user = player.user as User;
      return {
        ...player,
        phone: this.maskPhone(user.phone),
        phoneRaw: user.phone,
        realName: this.maskRealName(user.realName),
        realNameRaw: user.realName,
        nickname: user.nickname,
        userStatus: user.status,
      };
    });

    return { page, pageSize, total, list: list as unknown as AdminPlayerListResponse['list'] };
  }

  /**
   * 获取场地列表
   */
  async findVenues(query: AdminListQuery): Promise<AdminVenueListResponse> {
    const { page = 1, pageSize = 10, keyword, regionCode, sortField = 'id', sortOrder = 'asc' } = query;

    const repo = this.dataSource.getRepository(Venue);
    const qb = repo.createQueryBuilder('venue')
      .orderBy(`venue.${sortField}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (keyword) {
      qb.andWhere(
        '(venue.name ILIKE :keyword OR venue.address ILIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    if (regionCode) {
      qb.andWhere('venue.regionCode = :regionCode', { regionCode });
    }

    const [venues, total] = await qb.getManyAndCount();

    return { page, pageSize, total, list: venues as unknown as AdminVenueListResponse['list'] };
  }

  /**
   * 获取比赛列表（含场地和赛制名称）
   */
  async findMatches(query: AdminListQuery): Promise<AdminMatchListResponse> {
    const { page = 1, pageSize = 10, keyword, status, sortField = 'id', sortOrder = 'desc' } = query;

    const repo = this.dataSource.getRepository(Match);
    const qb = repo.createQueryBuilder('match')
      .leftJoinAndSelect('match.venue', 'venue')
      .leftJoinAndSelect('match.format', 'format')
      .orderBy(`match.${sortField}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (keyword) {
      qb.andWhere(
        '(venue.name ILIKE :keyword OR format.name ILIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    if (status) {
      qb.andWhere('match.status = :status', { status });
    }

    const [matches, total] = await qb.getManyAndCount();

    const list = matches.map((match) => ({
      ...match,
      venueName: match.venue?.name || '',
      formatName: match.format?.name || '',
    }));

    return { page, pageSize, total, list: list as unknown as AdminMatchListResponse['list'] };
  }

  // ===== 数据统计 =====

  /**
   * 获取平台核心数据统计
   */
  async getStats(): Promise<AdminStats> {
    const playerRepo = this.dataSource.getRepository(Player);
    const venueManagerRepo = this.dataSource.getRepository(VenueManager);
    const venueRepo = this.dataSource.getRepository(Venue);
    const intentionRepo = this.dataSource.getRepository(Intention);
    const matchRepo = this.dataSource.getRepository(Match);

    const [
      totalPlayers,
      totalVenueManagers,
      totalVenues,
      pendingIntentions,
    ] = await Promise.all([
      playerRepo.count(),
      venueManagerRepo.count(),
      venueRepo.count(),
      intentionRepo.count({ where: { status: 'pending' } }),
    ]);

    // 今日比赛数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayMatches = await matchRepo.count({
      where: {
        startTime: Between(today, tomorrow),
      },
    });

    // 近7天比赛趋势
    const weeklyMatchTrend = await this.getWeeklyMatchTrend();

    // 比赛状态分布
    const matchStatusDistribution = await this.getMatchStatusDistribution();

    return {
      totalPlayers,
      totalVenueManagers,
      totalVenues,
      todayMatches,
      pendingIntentions,
      weeklyMatchTrend,
      matchStatusDistribution,
    };
  }

  // ===== 系统参数 =====

  /**
   * 获取所有系统参数
   */
  async findSystemParams(): Promise<SystemParam[]> {
    const repo = this.dataSource.getRepository(SystemParam);
    return repo.find({ order: { paramKey: 'ASC' } });
  }

  /**
   * 更新系统参数（不存在则创建）
   */
  async updateSystemParam(
    paramKey: string,
    paramValue: unknown,
    description?: string,
  ): Promise<SystemParam> {
    const repo = this.dataSource.getRepository(SystemParam);
    let param = await repo.findOne({ where: { paramKey: paramKey as SystemParamKey } });

    if (!param) {
      param = repo.create({
        paramKey: paramKey as SystemParamKey,
        paramValue,
        description: description || null,
      });
    } else {
      param.paramValue = paramValue;
      if (description !== undefined) {
        param.description = description;
      }
    }

    return repo.save(param);
  }

  // ===== 私有工具方法 =====

  private async getWeeklyMatchTrend(): Promise<Array<{ date: string; count: number }>> {
    const repo = this.dataSource.getRepository(Match);
    const results: Array<{ date: string; count: string }> = await repo
      .createQueryBuilder('match')
      .select("TO_CHAR(match.startTime, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where("match.startTime >= NOW() - INTERVAL '7 days'")
      .groupBy("TO_CHAR(match.startTime, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    // 填充没有比赛的日期为0
    const trend: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = results.find((r) => r.date === dateStr);
      trend.push({ date: dateStr, count: found ? parseInt(found.count, 10) : 0 });
    }

    return trend;
  }

  private async getMatchStatusDistribution(): Promise<Array<{ status: string; count: number }>> {
    const repo = this.dataSource.getRepository(Match);
    const results: Array<{ status: string; count: string }> = await repo
      .createQueryBuilder('match')
      .select('match.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('match.status')
      .getRawMany();

    return results.map((r) => ({ status: r.status, count: parseInt(r.count, 10) }));
  }

  private maskPhone(phone: string): string {
    if (phone.length < 7) return phone;
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  }

  private maskRealName(name: string | null): string {
    if (!name) return '';
    if (name.length <= 1) return name;
    return name[0] + '**';
  }
}
