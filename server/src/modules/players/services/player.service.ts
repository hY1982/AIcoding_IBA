import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Player } from '../entities/player.entity';
import { PlayerPosition } from '../entities/player-position.entity';
import { User } from '@modules/users/entities/user.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { AbilityCalculationService } from './ability-calculation.service';
import { CreatePlayerDto } from '../dto/create-player.dto';
import { UpdatePlayerDto } from '../dto/update-player.dto';
import {
  PlayerProfile,
  PlayerAttributes,
  PlayerPosition as PlayerPositionType,
} from '@shared/player';
import { maskPhone, maskRealName } from '@common/utils/privacy.util';

/**
 * 影响基础能力值计算的字段集合
 * 当 UpdatePlayerDto 中包含这些字段的任意一个时，需要重新计算 baseAbilityScore
 */
const ABILITY_RELATED_FIELDS: (keyof UpdatePlayerDto)[] = [
  'age',
  'basketballAge',
  'gender',
  'height',
  'weight',
  'wingspan',
  'standingReach',
  'jumpingReach',
];

/**
 * 球员服务
 *
 * 负责球员资料的 CRUD、属性更新、能力值自动重算。
 * 核心设计原则：
 * - 事务完整性：Player 与 PlayerPosition 的操作始终包裹在事务中
 * - 智能重算：仅当影响能力值的字段变化时才触发重算
 * - 数据脱敏：查询响应自动脱敏敏感字段
 */
@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);

  constructor(
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(PlayerPosition)
    private readonly positionRepo: Repository<PlayerPosition>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MatchPlayer)
    private readonly matchPlayerRepo: Repository<MatchPlayer>,
    private readonly abilityCalcService: AbilityCalculationService,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== CREATE ====================

  /**
   * 创建球员记录
   *
   * 流程：
   * 1. 校验位置数量（最多3个）
   * 2. 检查 userId 是否已存在 Player（唯一约束防御）
   * 3. 调用 AbilityCalculationService 计算 baseAbilityScore
   * 4. 事务内原子创建 Player + PlayerPosition
   * 5. 返回脱敏后的 PlayerProfile
   *
   * @param userId 关联的用户ID
   * @param dto 球员属性
   * @throws BadRequestException 位置超过3个
   * @throws ConflictException 用户已存在球员记录
   */
  async create(userId: number, dto: CreatePlayerDto): Promise<PlayerProfile> {
    // 防御性校验：位置数量限制
    if (dto.positions && dto.positions.length > 3) {
      throw new BadRequestException('司职位置最多只能选择3个');
    }

    // 检查用户是否已存在球员记录
    const existingPlayer = await this.playerRepo.findOneBy({ userId });
    if (existingPlayer) {
      throw new ConflictException('该用户已存在球员资料');
    }

    // 计算基础能力值
    const playerAttributes = this.buildPlayerAttributesFromDto(dto);
    const baseAbilityScore =
      this.abilityCalcService.calculateBaseAbility(playerAttributes);

    // 使用事务原子创建 Player + PlayerPosition
    const savedPlayer = await this.dataSource.transaction(async (manager) => {
      // 创建 Player 记录
      const player = manager.create(Player, {
        userId,
        age: dto.age,
        basketballAge: dto.basketballAge,
        gender: dto.gender,
        height: dto.height,
        weight: dto.weight ?? null,
        wingspan: dto.wingspan ?? null,
        standingReach: dto.standingReach ?? null,
        jumpingReach: dto.jumpingReach ?? null,
        baseAbilityScore,
        matchAdjustValue: 0,
        regionCode: dto.regionCode || null,
      });
      const saved = await manager.save(Player, player);

      // 创建 PlayerPosition 记录
      if (dto.positions && dto.positions.length > 0) {
        const positions = dto.positions.map((position, index) =>
          manager.create(PlayerPosition, {
            playerId: saved.id,
            position,
            priority: index + 1,
          }),
        );
        await manager.save(PlayerPosition, positions);
      }

      return saved;
    });

    this.logger.log(
      `球员创建成功: playerId=${savedPlayer.id}, userId=${userId}, baseAbilityScore=${baseAbilityScore}`,
    );

    // 返回完整的脱敏资料
    return this.findById(savedPlayer.id);
  }

  // ==================== UPDATE ====================

  /**
   * 更新球员资料
   *
   * 智能重算策略：
   * - 检查 dto 是否包含影响能力值的字段
   * - 若包含 → 合并现有数据 + dto 数据 → 重新计算 baseAbilityScore
   * - 若不包含 → 保持现有 baseAbilityScore 不变
   * - matchAdjustValue 始终不变
   *
   * 位置更新策略：
   * - 若 dto 包含 positions：事务内先删除所有现有位置，再插入新位置
   * - 若 dto 不包含 positions：保持现有位置不变
   *
   * @param playerId 球员ID
   * @param dto 更新的属性
   * @throws NotFoundException 球员不存在
   * @throws BadRequestException 位置超过3个
   */
  async update(playerId: number, dto: UpdatePlayerDto): Promise<PlayerProfile> {
    // 查询现有球员
    const existingPlayer = await this.playerRepo.findOne({
      where: { id: playerId },
    });
    if (!existingPlayer) {
      throw new NotFoundException(`球员不存在: playerId=${playerId}`);
    }

    // 防御性校验：位置数量限制
    if (dto.positions && dto.positions.length > 3) {
      throw new BadRequestException('司职位置最多只能选择3个');
    }

    // 判断是否需要重新计算能力值
    const shouldRecalculate = this.shouldRecalculateAbility(dto);
    let baseAbilityScore = existingPlayer.baseAbilityScore;

    if (shouldRecalculate) {
      const mergedAttributes = this.buildPlayerAttributesForUpdate(
        existingPlayer,
        dto,
      );
      baseAbilityScore =
        this.abilityCalcService.calculateBaseAbility(mergedAttributes);
    }

    // 使用事务原子更新 Player + PlayerPosition
    const updatedPlayer = await this.dataSource.transaction(async (manager) => {
      // 更新 Player 记录（使用乐观锁防止并发更新丢失）
      // 注意：positions 是 PlayerPosition[] 关系属性，需单独处理，不能从 DTO 直接 spread
      const { positions: _positions, ...playerFields } = dto;
      const updateData: Partial<Player> = {
        ...playerFields,
        baseAbilityScore,
        // matchAdjustValue 始终不变，不在这里设置即可保持原值
      };

      // 清理 undefined 字段，避免覆盖现有值
      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof Player] === undefined) {
          delete updateData[key as keyof Player];
        }
      });

      // 手动递增版本号（QueryBuilder.update 不会自动处理 @VersionColumn）
      (updateData as any).version = existingPlayer.version + 1;

      // 使用 UpdateQueryBuilder + 版本号进行乐观锁更新
      const updateResult = await manager
        .createQueryBuilder()
        .update(Player)
        .set(updateData)
        .where('id = :id', { id: playerId })
        .andWhere('version = :version', { version: existingPlayer.version })
        .execute();

      if (updateResult.affected === 0) {
        throw new ConflictException('数据已被其他操作修改，请刷新后重试');
      }

      // 更新位置：若提供了 positions（非 null/undefined），先删后插
      if (dto.positions !== undefined && dto.positions !== null) {
        await manager.delete(PlayerPosition, { playerId });

        if (dto.positions.length > 0) {
          const positions = dto.positions.map((position, index) =>
            manager.create(PlayerPosition, {
              playerId,
              position,
              priority: index + 1,
            }),
          );
          await manager.save(PlayerPosition, positions);
        }
      }

      // 重新加载更新后的 Player（含最新 version 和关联数据）
      return manager
        .createQueryBuilder(Player, 'player')
        .leftJoinAndSelect('player.user', 'user')
        .leftJoinAndSelect('player.positions', 'positions')
        .where('player.id = :playerId', { playerId })
        .orderBy('positions.priority', 'ASC')
        .getOne();
    });

    this.logger.log(
      `球员更新成功: playerId=${playerId}, baseAbilityScore=${baseAbilityScore}`,
    );

    if (!updatedPlayer) {
      throw new NotFoundException(`球员不存在: playerId=${playerId}`);
    }

    // 返回更新后的脱敏资料（无需额外查询）
    return this.toPlayerProfile(updatedPlayer);
  }

  // ==================== READ ====================

  /**
   * 按球员ID查询详情
   *
   * 使用 QueryBuilder + leftJoinAndSelect 一次性查询 Player + User + PlayerPosition，
   * 避免 N+1 查询问题。
   *
   * 响应自动脱敏：
   * - 手机号：13812345678 → 138****5678
   * - 真实姓名：张三丰 → 张**
   *
   * @param playerId 球员ID
   * @throws NotFoundException 球员不存在
   */
  async findById(playerId: number): Promise<PlayerProfile> {
    const player = await this.playerRepo
      .createQueryBuilder('player')
      .leftJoinAndSelect('player.user', 'user')
      .leftJoinAndSelect('player.positions', 'positions')
      .where('player.id = :playerId', { playerId })
      .orderBy('positions.priority', 'ASC')
      .getOne();

    if (!player) {
      throw new NotFoundException(`球员不存在: playerId=${playerId}`);
    }

    return this.toPlayerProfile(player);
  }

  /**
   * 按用户ID查询球员资料
   *
   * @param userId 用户ID
   * @returns 脱敏后的 PlayerProfile，不存在则返回 null
   */
  async findByUserId(userId: number): Promise<PlayerProfile | null> {
    const player = await this.playerRepo
      .createQueryBuilder('player')
      .leftJoinAndSelect('player.user', 'user')
      .leftJoinAndSelect('player.positions', 'positions')
      .where('player.user_id = :userId', { userId })
      .orderBy('positions.priority', 'ASC')
      .getOne();

    if (!player) {
      return null;
    }

    return this.toPlayerProfile(player);
  }

  // ==================== DELETE ====================

  /**
   * 删除球员记录
   *
   * 删除前检查是否有关联的比赛记录，防止破坏历史数据完整性。
   * 依赖数据库 ON DELETE CASCADE 自动清理关联的 PlayerPosition 记录。
   *
   * @param playerId 球员ID
   * @throws NotFoundException 球员不存在
   * @throws ConflictException 球员已参与比赛，无法删除
   */
  async remove(playerId: number): Promise<void> {
    const player = await this.playerRepo.findOne({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException(`球员不存在: playerId=${playerId}`);
    }

    // 检查是否有关联的比赛记录
    const matchPlayerCount = await this.matchPlayerRepo.count({
      where: { playerId },
    });
    if (matchPlayerCount > 0) {
      throw new ConflictException('该球员已参与比赛，无法删除');
    }

    await this.playerRepo.remove(player);

    this.logger.log(`球员删除成功: playerId=${playerId}`);
  }

  // ==================== Private Helpers ====================

  /**
   * 从 CreatePlayerDto 构建 PlayerAttributes（用于能力值计算）
   */
  private buildPlayerAttributesFromDto(dto: CreatePlayerDto): PlayerAttributes {
    return {
      age: dto.age,
      basketballAge: dto.basketballAge,
      gender: dto.gender,
      height: dto.height,
      weight: dto.weight,
      wingspan: dto.wingspan,
      standingReach: dto.standingReach,
      jumpingReach: dto.jumpingReach,
      positions: dto.positions || [],
    };
  }

  /**
   * 为更新操作构建 PlayerAttributes（合并现有数据 + dto 数据）
   */
  private buildPlayerAttributesForUpdate(
    existing: Player,
    dto: UpdatePlayerDto,
  ): PlayerAttributes {
    return {
      age: dto.age ?? existing.age,
      basketballAge: dto.basketballAge ?? existing.basketballAge,
      gender: dto.gender ?? existing.gender,
      height: dto.height ?? existing.height,
      weight: dto.weight ?? existing.weight ?? undefined,
      wingspan: dto.wingspan ?? existing.wingspan ?? undefined,
      standingReach: dto.standingReach ?? existing.standingReach ?? undefined,
      jumpingReach: dto.jumpingReach ?? existing.jumpingReach ?? undefined,
      positions: dto.positions ?? [],
    };
  }

  /**
   * 判断 UpdatePlayerDto 是否包含影响能力值的字段
   */
  private shouldRecalculateAbility(dto: UpdatePlayerDto): boolean {
    return ABILITY_RELATED_FIELDS.some((field) => dto[field] !== undefined);
  }

  /**
   * 将 Player 实体转换为脱敏后的 PlayerProfile
   */
  private toPlayerProfile(player: Player): PlayerProfile {
    const user = player.user;
    const positions = (player as any).positions || [];

    return {
      id: player.id,
      userId: player.userId,
      age: player.age,
      basketballAge: player.basketballAge,
      gender: player.gender,
      height: player.height,
      weight: player.weight ?? undefined,
      wingspan: player.wingspan ?? undefined,
      standingReach: player.standingReach ?? undefined,
      jumpingReach: player.jumpingReach ?? undefined,
      positions: positions.map((p: PlayerPosition) => ({
        position: p.position,
        priority: p.priority,
      })),
      regionCode: player.regionCode ?? undefined,
      baseAbilityScore: player.baseAbilityScore,
      matchAdjustValue: player.matchAdjustValue,
      // totalAbilityScore 是数据库生成列(base_ability_score + match_adjust_value)，
      // 在事务内立即查询可能拿到旧值，因此手动计算确保准确性
      totalAbilityScore: Math.round((player.baseAbilityScore + player.matchAdjustValue) * 100) / 100,
      phone: user?.phone ? maskPhone(user.phone) : '',
      nickname: user?.nickname || '',
      realName: user?.realName ? maskRealName(user.realName) : '',
      avatarUrl: user?.avatarUrl || undefined,
      createdAt: player.createdAt.toISOString(),
      updatedAt: player.updatedAt.toISOString(),
    };
  }
}
