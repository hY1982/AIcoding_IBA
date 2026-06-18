import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Match } from '@modules/matches/entities/match.entity';
import { Venue } from './venue.entity';
import {
  BookingRequestStatus,
  BOOKING_REQUEST_STATUSES,
} from '@shared/venue-booking';

/**
 * VenueBookingRequest entity — v2.0 新增。
 *
 * 记录场地预订请求的全生命周期：
 * - 满员后创建请求（status=pending，deadline=requestedAt+30min）
 * - 场地方手动确认（status=confirmed）
 * - 30分钟超时系统自动确认（status=auto_confirmed）
 * - 场地方拒绝（status=rejected，需填写拒绝原因）
 * - 比赛取消连带取消（status=cancelled）
 *
 * 索引设计：
 * - (matchId): 按比赛查询预订请求
 * - (venueId, slotDate): 按场地+日期查询当日请求
 * - (status, responseDeadline): 超时调度器高频查询
 */
@Entity('venue_booking_requests')
@Index(['matchId'])
@Index(['venueId', 'slotDate'])
@Index(['status', 'responseDeadline'])
export class VenueBookingRequest {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'match_id',
    type: 'bigint',
    nullable: false,
  })
  matchId!: number;

  @ManyToOne(() => Match, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match!: Match;

  @Column({
    name: 'venue_id',
    type: 'bigint',
    nullable: false,
  })
  venueId!: number;

  @ManyToOne(() => Venue, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'venue_id' })
  venue!: Venue;

  @Column({
    name: 'slot_date',
    type: 'date',
    nullable: false,
  })
  slotDate!: string; // YYYY-MM-DD

  @Column({
    name: 'start_time',
    type: 'time',
    nullable: false,
  })
  startTime!: string; // HH:mm:ss

  @Column({
    name: 'end_time',
    type: 'time',
    nullable: false,
  })
  endTime!: string; // HH:mm:ss

  @Column({
    type: 'enum',
    enum: BOOKING_REQUEST_STATUSES,
    nullable: false,
    default: 'pending',
  })
  status!: BookingRequestStatus;

  @Column({
    name: 'requested_at',
    type: 'timestamptz',
    nullable: false,
    default: () => 'NOW()',
  })
  requestedAt!: Date;

  /**
   * 场地方响应时间（确认/拒绝时设置）。
   */
  @Column({
    name: 'responded_at',
    type: 'timestamptz',
    nullable: true,
  })
  respondedAt!: Date | null;

  /**
   * 响应截止时间 = requestedAt + 30分钟。
   * 超时后由调度器自动处理。
   */
  @Column({
    name: 'response_deadline',
    type: 'timestamptz',
    nullable: false,
  })
  responseDeadline!: Date;

  /**
   * 拒绝原因（仅 status=rejected 时填写）。
   */
  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  rejectionReason!: string | null;
}
