import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerShootingRecord } from '../entities/player-shooting-record.entity';
import { CreateShootingRecordDto } from '../dto/create-shooting-record.dto';
import { ShootingStats } from '@shared/player';

/**
 * 投篮记录服务
 *
 * 负责球员投篮记录的录入和统计查询。
 *
 * 性能与扩展性说明：
 * - createRecord 在 Repository 层面使用 save 的隐式事务，确保单条记录的原子性
 *   若未来扩展为 "每日每类型只能录入一次" 的幂等校验，需升级为显式事务
 * - getShootingStats 依赖实体上的 (playerId, recordDate DESC) 复合索引，确保日期范围查询高效
 * - MVP 阶段不实现缓存；若未来查询频率增高，可考虑为统计结果增加短期内存缓存（TTL 5分钟），
 *   由于训练数据更新频率低，缓存可大幅降低数据库负载
 */
@Injectable()
export class ShootingService {
  private readonly logger = new Logger(ShootingService.name);

  constructor(
    @InjectRepository(PlayerShootingRecord)
    private readonly shootingRepo: Repository<PlayerShootingRecord>,
  ) {}

  /**
   * 录入投篮记录
   *
   * 执行业务校验后保存到数据库：
   * 1. 校验 shotsMade <= shotsAttempted
   * 2. 校验 recordDate 不是未来日期
   * 3. 保存记录到数据库（save 提供隐式事务）
   *
   * @param playerId 球员ID
   * @param dto 投篮记录数据
   * @throws BadRequestException 业务校验失败
   */
  async createRecord(
    playerId: number,
    dto: CreateShootingRecordDto,
  ): Promise<PlayerShootingRecord> {
    if (dto.shotsMade > dto.shotsAttempted) {
      throw new BadRequestException('命中数不能大于出手数');
    }

    // 将 YYYY-MM-DD 解析为本地时间午夜，避免时区偏移导致日期判断错误
    const [year, month, day] = dto.recordDate.split('-').map(Number);
    const recordDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (recordDate > today) {
      throw new BadRequestException('记录日期不能是未来日期');
    }

    const record = this.shootingRepo.create({
      playerId,
      recordType: dto.recordType,
      shotsAttempted: dto.shotsAttempted,
      shotsMade: dto.shotsMade,
      recordDate,
    });

    const saved = await this.shootingRepo.save(record);
    this.logger.log(
      `投篮记录录入: playerId=${playerId}, type=${dto.recordType}, ${dto.shotsMade}/${dto.shotsAttempted}`,
    );
    return saved;
  }

  /**
   * 查询投篮统计（半年滚动）
   *
   * 查询近6个月的投篮记录，按 recordType 分组聚合，计算命中率。
   * 依赖 (playerId, recordDate DESC) 复合索引确保查询高效。
   *
   * MVP 扩展预留：若未来查询频率增高，可在此方法前增加缓存层（TTL 5分钟）。
   *
   * @param playerId 球员ID
   * @returns 按类型分组的投篮统计数组
   */
  async getShootingStats(playerId: number): Promise<ShootingStats[]> {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // 使用 QueryBuilder + YYYY-MM-DD 字符串参数避免 TypeORM date 类型与 MoreThanOrEqual 的时区兼容问题
    const records = await this.shootingRepo
      .createQueryBuilder('r')
      .where('r.player_id = :playerId', { playerId })
      .andWhere('r.record_date >= :sixMonthsAgo', {
        sixMonthsAgo: sixMonthsAgo.toISOString().split('T')[0],
      })
      .orderBy('r.record_date', 'DESC')
      .getMany();

    // 按 recordType 分组聚合
    const statsMap = new Map<
      string,
      { totalAttempted: number; totalMade: number }
    >();

    for (const record of records) {
      const key = record.recordType;
      const existing = statsMap.get(key) || {
        totalAttempted: 0,
        totalMade: 0,
      };
      existing.totalAttempted += record.shotsAttempted;
      existing.totalMade += record.shotsMade;
      statsMap.set(key, existing);
    }

    const result: ShootingStats[] = [];
    for (const [recordType, data] of statsMap) {
      result.push({
        recordType: recordType as ShootingStats['recordType'],
        totalAttempted: data.totalAttempted,
        totalMade: data.totalMade,
        percentage:
          data.totalAttempted > 0
            ? Math.round((data.totalMade / data.totalAttempted) * 1000) / 10
            : 0,
      });
    }

    return result;
  }
}
