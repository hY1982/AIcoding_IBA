import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { VenueTimeSlot } from './venue-time-slot.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import {
  FloorMaterial,
  FLOOR_MATERIALS,
  CourtType,
  COURT_TYPES,
  VenueStatus,
  VENUE_STATUSES,
} from '@shared/venue';

/**
 * Venue entity representing a basketball court facility.
 *
 * Spatial index note: idx_venues_location (GIST on point(longitude, latitude))
 * is created via raw SQL in the migration file, not through TypeORM @Index
 * decorator, because GIST indexes on expressions are not directly supported.
 *
 * Coordinate standard: WGS84 (SRID 4326).
 */
@Entity('venues')
@Index(['managerId'])
@Index(['regionCode'])
export class Venue {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'manager_id',
    type: 'bigint',
    nullable: false,
  })
  managerId!: number;

  @ManyToOne(() => VenueManager, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'manager_id' })
  manager!: VenueManager;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  address!: string;

  @Column({
    name: 'price_per_hour',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: false,
  })
  pricePerHour!: number;

  @Column({
    name: 'court_count',
    type: 'int',
    nullable: false,
    default: 1,
  })
  courtCount!: number;

  /** Latitude in WGS84 (SRID 4326), decimal degrees */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 8,
    nullable: true,
  })
  latitude!: number | null;

  /** Longitude in WGS84 (SRID 4326), decimal degrees */
  @Column({
    type: 'decimal',
    precision: 11,
    scale: 8,
    nullable: true,
  })
  longitude!: number | null;

  @Column({
    name: 'floor_material',
    type: 'enum',
    enum: FLOOR_MATERIALS,
    nullable: true,
  })
  floorMaterial!: FloorMaterial | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  lighting!: string | null;

  @Column({
    name: 'court_type',
    type: 'enum',
    enum: COURT_TYPES,
    nullable: true,
  })
  courtType!: CourtType | null;

  @Column({ type: 'boolean', nullable: true, default: false })
  ventilation!: boolean | null;

  @Column({ name: 'big_fan', type: 'boolean', nullable: true, default: false })
  bigFan!: boolean | null;

  @Column({
    name: 'air_condition',
    type: 'boolean',
    nullable: true,
    default: false,
  })
  airCondition!: boolean | null;

  @Column({ name: 'turnover_time', type: 'int', nullable: true })
  turnoverTime!: number | null;

  /** Business opening time (default 08:00) */
  @Column({ name: 'open_time', type: 'time', nullable: true, default: '08:00:00' })
  openTime!: string | null;

  /** Business closing time (default 22:00) */
  @Column({ name: 'close_time', type: 'time', nullable: true, default: '22:00:00' })
  closeTime!: string | null;

  @Column({ type: 'boolean', nullable: true, default: false })
  parking!: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: false })
  restroom!: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: false })
  shower!: boolean | null;

  @Column({
    name: 'locker_room',
    type: 'boolean',
    nullable: true,
    default: false,
  })
  lockerRoom!: boolean | null;

  @Column({
    name: 'video_record',
    type: 'boolean',
    nullable: true,
    default: false,
  })
  videoRecord!: boolean | null;

  /** Average rating; NULL when no ratings exist (avoids misleading 5-star display) */
  @Column({
    name: 'rating_avg',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
    default: null,
  })
  ratingAvg!: number | null;

  @Column({
    name: 'rating_count',
    type: 'int',
    nullable: true,
    default: 0,
  })
  ratingCount!: number | null;

  @Column({
    type: 'enum',
    enum: VENUE_STATUSES,
    nullable: false,
    default: 'active',
  })
  status!: VenueStatus;

  @Column({
    name: 'region_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  regionCode!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'version', default: 0 })
  version!: number;

  @OneToMany(() => VenueTimeSlot, (slot) => slot.venue, {
    cascade: true,
  })
  timeSlots!: VenueTimeSlot[];

  @OneToMany(() => IntentionVenue, (iv) => iv.venue, { lazy: true })
  intentionVenues!: Promise<IntentionVenue[]>;
}
