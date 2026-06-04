import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { Intention } from '../entities/intention.entity';
import { IntentionVenue } from '../entities/intention-venue.entity';
import { IntentionFormat } from '../entities/intention-format.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { CreateIntentionDto } from '../dto/create-intention.dto';
import { UpdateIntentionDto } from '../dto/update-intention.dto';
import { QueryIntentionDto } from '../dto/query-intention.dto';
import {
  IntentionStatus,
  INTENTION_STATUS_TRANSITIONS,
} from '@shared/intention';
import { PaginatedResponse } from '@shared/common';

/**
 * 意向响应对象（API 返回格式）
 */
export interface IntentionResponse {
  id: number;
  playerId: number;
  startTime: string;
  durationMinutes: number;
  acceptableWaitMinutes: number;
  endTime: string;
  status: IntentionStatus;
  matchId: number | null;
  regionCode: string | null;
  submittedAt: string;
  updatedAt: string;
  expiresAt: string;
  venues: { venueId: number; priority: number; venueName?: string }[];
  formats: { formatId: number; priority: number; formatName?: string }[];
}

/**
 * 意向服务
 *
 * 负责比赛意向的提交、修改、取消、查询。
 * 核心设计原则：
 * - 提前 1 小时校验：startTime 必须 >= now + 1 小时
 * - 状态机校验：使用 INTENTION_STATUS_TRANSITIONS 控制流转
 * - 时间重叠检测：同一球员的 pending 意向时间范围不能重叠
 * - regionCode 自动填充：player.regionCode → 首选场地.regionCode
 */
@Injectable()
export class IntentionService {
  private readonly logger = new Logger(IntentionService.name);

  constructor(
    @InjectRepository(Intention)
    private readonly intentionRepo: Repository<Intention>,
    @InjectRepository(IntentionVenue)
    private readonly intentionVenueRepo: Repository<IntentionVenue>,
    @InjectRepository(IntentionFormat)
    private readonly intentionFormatRepo: Repository<IntentionFormat>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    @InjectRepository(Format)
    private readonly formatRepo: Repository<Format>,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== CREATE ====================

  /**
   * 提交比赛意向
   *
   * 流程：
   * 1. 校验基础参数（提前1小时、duration范围、venue/format数量）
   * 2. 校验球员/场地/赛制存在性
   * 3. 检测时间重叠
   * 4. 计算 regionCode
   * 5. 事务内创建 Intention + IntentionVenue + IntentionFormat
   *
   * @param playerId 球员ID
   * @param dto 意向信息
   * @throws BadRequestException 参数校验失败
   * @throws NotFoundException 球员/场地/赛制不存在
   * @throws ConflictException 时间重叠
   */
  async create(
    playerId: number,
    dto: CreateIntentionDto,
  ): Promise<IntentionResponse> {
    // 基础参数校验
    this.validateCreateDto(dto);

    // 校验球员存在
    const player = await this.playerRepo.findOneBy({ id: playerId });
    if (!player) {
      throw new NotFoundException(`球员不存在: playerId=${playerId}`);
    }

    // 批量校验场地存在性（避免N+1查询）
    const venueIds = dto.venueIds.map((v) => v.venueId);
    const venues = await this.venueRepo.findBy({ id: In(venueIds) });
    if (venues.length !== venueIds.length) {
      const foundIds = new Set(venues.map((v) => v.id));
      const missingId = venueIds.find((id) => !foundIds.has(id));
      throw new NotFoundException(`场地不存在: venueId=${missingId}`);
    }

    // 批量校验赛制存在性（避免N+1查询）
    const formatIds = dto.formatIds.map((f) => f.formatId);
    const formats = await this.formatRepo.findBy({ id: In(formatIds) });
    if (formats.length !== formatIds.length) {
      const foundIds = new Set(formats.map((f) => f.id));
      const missingId = formatIds.find((id) => !foundIds.has(id));
      throw new NotFoundException(`赛制不存在: formatId=${missingId}`);
    }

    const startTime = new Date(dto.startTime);

    // 检测时间重叠
    const hasOverlap = await this.checkTimeOverlap(
      playerId,
      startTime,
      dto.durationMinutes,
    );
    if (hasOverlap) {
      throw new ConflictException(
        '该时间段内已存在 pending 状态的比赛意向，时间重叠',
      );
    }

    // 计算 regionCode（传入已查询的player避免重复查询）
    const regionCode = this.resolveRegionCode(player, dto.venueIds, venues);

    // 事务内创建
    const savedIntention = await this.dataSource.transaction(
      async (manager) => {
        // 创建 Intention
        const intention = manager.create(Intention, {
          playerId,
          startTime,
          durationMinutes: dto.durationMinutes,
          acceptableWaitMinutes: dto.acceptableWaitMinutes ?? 30,
          status: 'pending' as IntentionStatus,
          regionCode,
        });

        // 触发 @BeforeInsert 钩子计算 endTime 和 expiresAt
        intention.computeDerivedTimes();

        const saved = await manager.save(Intention, intention);

        // 创建 IntentionVenue
        const intentionVenues = dto.venueIds.map((item) =>
          manager.create(IntentionVenue, {
            intentionId: saved.id,
            venueId: item.venueId,
            priority: item.priority,
          }),
        );
        await manager.save(IntentionVenue, intentionVenues);

        // 创建 IntentionFormat
        const intentionFormats = dto.formatIds.map((item) =>
          manager.create(IntentionFormat, {
            intentionId: saved.id,
            formatId: item.formatId,
            priority: item.priority,
          }),
        );
        await manager.save(IntentionFormat, intentionFormats);

        return saved;
      },
    );

    this.logger.log(
      `意向创建成功: intentionId=${savedIntention.id}, playerId=${playerId}, startTime=${dto.startTime}`,
    );

    return this.findById(savedIntention.id);
  }

  // ==================== UPDATE ====================

  /**
   * 修改比赛意向
   *
   * 仅 pending 状态的意向可被修改。
   * 修改后需重新满足提前 1 小时规则。
   * 若修改了 startTime/durationMinutes，需重新检测时间重叠。
   *
   * @param intentionId 意向ID
   * @param playerId 当前操作球员ID（权限校验）
   * @param dto 更新字段
   * @throws NotFoundException 意向不存在
   * @throws ForbiddenException 非所属球员
   * @throws BadRequestException 状态不允许修改或参数校验失败
   * @throws ConflictException 时间重叠
   */
  async update(
    intentionId: number,
    playerId: number,
    dto: UpdateIntentionDto,
  ): Promise<IntentionResponse> {
    // 查询意向（含关联）
    const intention = await this.intentionRepo
      .createQueryBuilder('intention')
      .leftJoinAndSelect('intention.intentionVenues', 'intentionVenue')
      .leftJoinAndSelect('intention.intentionFormats', 'intentionFormat')
      .where('intention.id = :intentionId', { intentionId })
      .getOne();

    if (!intention) {
      throw new NotFoundException(`意向不存在: intentionId=${intentionId}`);
    }

    // 权限校验
    if (intention.playerId !== playerId) {
      throw new ForbiddenException('无权操作该意向');
    }

    // 状态校验：仅 pending 可修改
    if (intention.status !== 'pending') {
      throw new BadRequestException(
        `当前状态为 ${intention.status}，仅 pending 状态的意向可修改`,
      );
    }

    // 校验更新后的参数
    this.validateUpdateDto(dto, intention);

    // 若修改了时间相关字段，检测重叠（排除自身）
    const newStartTime = dto.startTime
      ? new Date(dto.startTime)
      : intention.startTime;
    const newDuration = dto.durationMinutes ?? intention.durationMinutes;

    if (dto.startTime !== undefined || dto.durationMinutes !== undefined) {
      const hasOverlap = await this.checkTimeOverlap(
        playerId,
        newStartTime,
        newDuration,
        intentionId,
      );
      if (hasOverlap) {
        throw new ConflictException('修改后的时间段与其他意向重叠');
      }
    }

    // 事务内更新
    await this.dataSource.transaction(async (manager) => {
      // 在事务内重新查询实体，避免使用事务外实体实例
      const intentionInTx = await manager.findOne(Intention, {
        where: { id: intentionId },
      });
      if (!intentionInTx) {
        throw new NotFoundException(
          `意向不存在: intentionId=${intentionId}`,
        );
      }

      // 更新 Intention 主表
      if (dto.startTime !== undefined) {
        intentionInTx.startTime = new Date(dto.startTime);
      }
      if (dto.durationMinutes !== undefined) {
        intentionInTx.durationMinutes = dto.durationMinutes;
      }
      if (dto.acceptableWaitMinutes !== undefined) {
        intentionInTx.acceptableWaitMinutes = dto.acceptableWaitMinutes;
      }

      // 使用 save 触发 @BeforeUpdate 钩子重新计算 endTime/expiresAt
      if (
        dto.startTime !== undefined ||
        dto.durationMinutes !== undefined ||
        dto.acceptableWaitMinutes !== undefined
      ) {
        intentionInTx.computeDerivedTimes();
        await manager.save(Intention, intentionInTx);
      }

      // 更新 venueIds：先删后插
      if (dto.venueIds !== undefined) {
        await manager.delete(IntentionVenue, { intentionId });
        if (dto.venueIds.length > 0) {
          const venues = dto.venueIds.map((item) =>
            manager.create(IntentionVenue, {
              intentionId,
              venueId: item.venueId,
              priority: item.priority,
            }),
          );
          await manager.save(IntentionVenue, venues);
        }
      }

      // 更新 formatIds：先删后插
      if (dto.formatIds !== undefined) {
        await manager.delete(IntentionFormat, { intentionId });
        if (dto.formatIds.length > 0) {
          const formats = dto.formatIds.map((item) =>
            manager.create(IntentionFormat, {
              intentionId,
              formatId: item.formatId,
              priority: item.priority,
            }),
          );
          await manager.save(IntentionFormat, formats);
        }
      }
    });

    this.logger.log(
      `意向更新成功: intentionId=${intentionId}, playerId=${playerId}`,
    );

    return this.findById(intentionId);
  }

  // ==================== CANCEL ====================

  /**
   * 取消比赛意向
   *
   * 允许取消的状态：pending, matched
   * 不允许取消的状态：confirmed, cancelled, expired, failed
   *
   * @param intentionId 意向ID
   * @param playerId 当前操作球员ID
   * @throws NotFoundException 意向不存在
   * @throws ForbiddenException 非所属球员
   * @throws BadRequestException 状态不允许取消
   */
  async cancel(intentionId: number, playerId: number): Promise<void> {
    const intention = await this.intentionRepo
      .createQueryBuilder('intention')
      .where('intention.id = :intentionId', { intentionId })
      .getOne();

    if (!intention) {
      throw new NotFoundException(`意向不存在: intentionId=${intentionId}`);
    }

    // 权限校验
    if (intention.playerId !== playerId) {
      throw new ForbiddenException('无权操作该意向');
    }

    // 状态校验
    if (!this.canTransitionStatus(intention.status, 'cancelled')) {
      throw new BadRequestException(
        `当前状态为 ${intention.status}，不可取消`,
      );
    }

    intention.status = 'cancelled';
    await this.intentionRepo.save(intention);

    this.logger.log(
      `意向取消成功: intentionId=${intentionId}, playerId=${playerId}`,
    );
  }

  // ==================== READ ====================

  /**
   * 按ID查询意向详情（含场地和赛制关联）
   *
   * @param intentionId 意向ID
   * @throws NotFoundException 意向不存在
   */
  async findById(intentionId: number): Promise<IntentionResponse> {
    const intention = await this.intentionRepo
      .createQueryBuilder('intention')
      .leftJoinAndSelect('intention.intentionVenues', 'intentionVenue')
      .leftJoinAndSelect('intentionVenue.venue', 'venue')
      .leftJoinAndSelect('intention.intentionFormats', 'intentionFormat')
      .leftJoinAndSelect('intentionFormat.format', 'format')
      .where('intention.id = :intentionId', { intentionId })
      .getOne();

    if (!intention) {
      throw new NotFoundException(`意向不存在: intentionId=${intentionId}`);
    }

    return this.toIntentionResponse(intention);
  }

  /**
   * 按球员查询意向列表（支持状态筛选、分页）
   *
   * @param playerId 球员ID
   * @param query 查询条件
   */
  async findByPlayer(
    playerId: number,
    query: QueryIntentionDto,
  ): Promise<PaginatedResponse<IntentionResponse>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const qb = this.intentionRepo
      .createQueryBuilder('intention')
      .leftJoinAndSelect('intention.intentionVenues', 'intentionVenue')
      .leftJoinAndSelect('intentionVenue.venue', 'venue')
      .leftJoinAndSelect('intention.intentionFormats', 'intentionFormat')
      .leftJoinAndSelect('intentionFormat.format', 'format')
      .where('intention.player_id = :playerId', { playerId });

    if (query.status) {
      qb.andWhere('intention.status = :status', { status: query.status });
    }

    qb.orderBy('intention.submitted_at', 'DESC').skip(skip).take(pageSize);

    const [intentions, total] = await qb.getManyAndCount();

    const list = intentions.map((i) => this.toIntentionResponse(i));

    return { page, pageSize, total, list };
  }

  // ==================== Status Transition ====================

  /**
   * 校验意向状态是否可以流转到目标状态
   */
  canTransitionStatus(from: IntentionStatus, to: IntentionStatus): boolean {
    return INTENTION_STATUS_TRANSITIONS[from].includes(to);
  }

  // ==================== Private Helpers ====================

  /**
   * 校验创建意向的 DTO
   */
  private validateCreateDto(dto: CreateIntentionDto): void {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const startTime = new Date(dto.startTime);

    if (startTime < oneHourLater) {
      throw new BadRequestException('比赛开始时间必须至少提前 1 小时');
    }

    if (dto.durationMinutes < 120 || dto.durationMinutes > 360) {
      throw new BadRequestException('比赛时长必须在 120-360 分钟之间');
    }

    if (!dto.venueIds || dto.venueIds.length === 0) {
      throw new BadRequestException('至少选择 1 个场地');
    }

    if (dto.venueIds.length > 3) {
      throw new BadRequestException('最多选择 3 个场地');
    }

    if (!dto.formatIds || dto.formatIds.length === 0) {
      throw new BadRequestException('至少选择 1 个赛制');
    }

    if (dto.formatIds.length > 3) {
      throw new BadRequestException('最多选择 3 个赛制');
    }
  }

  /**
   * 校验更新意向的 DTO
   */
  private validateUpdateDto(
    dto: UpdateIntentionDto,
    existing: Intention,
  ): void {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    if (dto.startTime !== undefined) {
      const startTime = new Date(dto.startTime);
      if (startTime < oneHourLater) {
        throw new BadRequestException('比赛开始时间必须至少提前 1 小时');
      }
    }

    if (dto.durationMinutes !== undefined) {
      if (dto.durationMinutes < 120 || dto.durationMinutes > 360) {
        throw new BadRequestException('比赛时长必须在 120-360 分钟之间');
      }
    }

    if (dto.venueIds !== undefined) {
      if (dto.venueIds.length === 0) {
        throw new BadRequestException('至少选择 1 个场地');
      }
      if (dto.venueIds.length > 3) {
        throw new BadRequestException('最多选择 3 个场地');
      }
    }

    if (dto.formatIds !== undefined) {
      if (dto.formatIds.length === 0) {
        throw new BadRequestException('至少选择 1 个赛制');
      }
      if (dto.formatIds.length > 3) {
        throw new BadRequestException('最多选择 3 个赛制');
      }
    }
  }

  /**
   * 检测时间重叠
   *
   * 检查同一球员是否存在 pending 状态的意向与给定时间范围重叠。
   * 重叠判定：startTime < otherEndTime && endTime > otherStartTime
   *
   * @param excludeIntentionId 可选：排除指定意向ID（用于更新时排除自身）
   */
  private async checkTimeOverlap(
    playerId: number,
    startTime: Date,
    durationMinutes: number,
    excludeIntentionId?: number,
  ): Promise<boolean> {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    const qb = this.intentionRepo
      .createQueryBuilder('intention')
      .where('intention.player_id = :playerId', { playerId })
      .andWhere('intention.status = :status', { status: 'pending' })
      .andWhere('intention.start_time < :endTime', { endTime })
      .andWhere('intention.end_time > :startTime', { startTime });

    if (excludeIntentionId !== undefined) {
      qb.andWhere('intention.id != :excludeId', {
        excludeId: excludeIntentionId,
      });
    }

    const count = await qb.getCount();
    return count > 0;
  }

  /**
   * 解析 regionCode
   *
   * 策略：
   * 1. 优先使用 player.regionCode
   * 2. 若 player 无 regionCode，使用首选场地（priority=1）的 regionCode
   *
   * @param player 已查询的球员实体
   * @param venueSelections 场地选择列表
   * @param venues 已查询的场地实体列表
   */
  private resolveRegionCode(
    player: Player,
    venueSelections: { venueId: number; priority: number }[],
    venues: Venue[],
  ): string | null {
    // 策略1：从 player 获取
    if (player?.regionCode) {
      return player.regionCode;
    }

    // 策略2：从首选场地获取
    const preferredSelection =
      venueSelections.find((v) => v.priority === 1) ?? venueSelections[0];
    if (preferredSelection) {
      const venue = venues.find((v) => v.id === preferredSelection.venueId);
      return venue?.regionCode ?? null;
    }

    return null;
  }

  /**
   * 将 Intention 实体转换为响应对象
   */
  private toIntentionResponse(intention: Intention): IntentionResponse {
    const venues =
      intention.intentionVenues?.map((iv) => ({
        venueId: iv.venueId,
        priority: iv.priority,
        venueName: iv.venue?.name,
      })) ?? [];

    const formats =
      intention.intentionFormats?.map((ifmt) => ({
        formatId: ifmt.formatId,
        priority: ifmt.priority,
        formatName: ifmt.format?.name,
      })) ?? [];

    return {
      id: intention.id,
      playerId: intention.playerId,
      startTime: intention.startTime.toISOString(),
      durationMinutes: intention.durationMinutes,
      acceptableWaitMinutes: intention.acceptableWaitMinutes,
      endTime: intention.endTime.toISOString(),
      status: intention.status,
      matchId: intention.matchId,
      regionCode: intention.regionCode,
      submittedAt: intention.submittedAt.toISOString(),
      updatedAt: intention.updatedAt.toISOString(),
      expiresAt: intention.expiresAt.toISOString(),
      venues,
      formats,
    };
  }
}
