import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Venue } from '../entities/venue.entity';
import { User } from '@modules/users/entities/user.entity';
import {
  VenueManagerProfile,
  UpdateVenueManagerProfileDto,
} from '@shared/venue-manager';
import { VenueListItem } from '@shared/venue';
import { maskPhone, maskRealName } from '@common/utils/privacy.util';

/**
 * 场地方资料服务
 *
 * 负责场地方资料的查询和更新。
 */
@Injectable()
export class VenueManagerProfileService {
  private readonly logger = new Logger(VenueManagerProfileService.name);

  constructor(
    @InjectRepository(VenueManager)
    private readonly venueManagerRepo: Repository<VenueManager>,
    @InjectRepository(Venue)
    private readonly venueRepo: Repository<Venue>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 按用户ID查询场地方资料
   *
   * @param userId 用户ID
   * @returns 脱敏后的 VenueManagerProfile，不存在则返回 null
   */
  async findByUserId(userId: number): Promise<VenueManagerProfile | null> {
    const venueManager = await this.venueManagerRepo
      .createQueryBuilder('vm')
      .leftJoinAndSelect('vm.user', 'user')
      .where('vm.user_id = :userId', { userId })
      .getOne();

    if (!venueManager) {
      return null;
    }

    // 查询关联的场地列表
    const venues = await this.venueRepo.find({
      where: { managerId: venueManager.id },
      order: { createdAt: 'DESC' },
    });

    return this.toVenueManagerProfile(venueManager, venues);
  }

  /**
   * 更新场地方资料
   *
   * @param venueManagerId 场地方ID
   * @param dto 更新的属性
   * @throws NotFoundException 场地方不存在
   */
  async update(
    venueManagerId: number,
    dto: UpdateVenueManagerProfileDto,
  ): Promise<VenueManagerProfile> {
    const venueManager = await this.venueManagerRepo.findOne({
      where: { id: venueManagerId },
      relations: ['user'],
    });

    if (!venueManager) {
      throw new NotFoundException(`场地方不存在: id=${venueManagerId}`);
    }

    // 更新字段
    if (dto.companyName !== undefined) {
      venueManager.companyName = dto.companyName || null;
    }
    if (dto.contactName !== undefined) {
      venueManager.contactName = dto.contactName || null;
    }
    if (dto.contactPhone !== undefined) {
      venueManager.contactPhone = dto.contactPhone || null;
    }

    await this.venueManagerRepo.save(venueManager);

    this.logger.log(`场地方资料更新成功: id=${venueManagerId}`);

    // 重新查询关联的场地列表
    const venues = await this.venueRepo.find({
      where: { managerId: venueManager.id },
      order: { createdAt: 'DESC' },
    });

    return this.toVenueManagerProfile(venueManager, venues);
  }

  /**
   * 将 VenueManager 实体转换为脱敏后的 VenueManagerProfile
   */
  private toVenueManagerProfile(
    venueManager: VenueManager,
    venues: Venue[],
  ): VenueManagerProfile {
    const user = venueManager.user;

    const venueList: VenueListItem[] = venues.map((v) => ({
      id: v.id,
      name: v.name,
      address: v.address,
      pricePerHour: Number(v.pricePerHour),
      courtCount: v.courtCount,
      floorMaterial: v.floorMaterial ?? undefined,
      courtType: v.courtType ?? undefined,
      ventilation: v.ventilation ?? undefined,
      bigFan: v.bigFan ?? undefined,
      airCondition: v.airCondition ?? undefined,
      parking: v.parking ?? undefined,
      restroom: v.restroom ?? undefined,
      shower: v.shower ?? undefined,
      lockerRoom: v.lockerRoom ?? undefined,
      videoRecord: v.videoRecord ?? undefined,
      status: v.status,
      ratingAvg: v.ratingAvg ? Number(v.ratingAvg) : undefined,
      ratingCount: v.ratingCount ?? 0,
    }));

    return {
      id: venueManager.id,
      userId: venueManager.userId,
      companyName: venueManager.companyName ?? undefined,
      contactName: venueManager.contactName ?? undefined,
      contactPhone: venueManager.contactPhone ?? undefined,
      phone: user?.phone ? maskPhone(user.phone) : '',
      nickname: user?.nickname || '',
      realName: user?.realName ? maskRealName(user.realName) : '',
      avatarUrl: user?.avatarUrl || undefined,
      venues: venueList,
      createdAt: venueManager.createdAt.toISOString(),
      updatedAt: venueManager.updatedAt.toISOString(),
    };
  }
}
