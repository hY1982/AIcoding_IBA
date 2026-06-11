import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Venue } from './venue.entity';

/**
 * VenueUnavailableSlot entity representing a time period when a venue
 * is NOT available for booking (e.g., maintenance, private event).
 *
 * The effective unavailable period includes the turnover time:
 * effectiveEndTime = endTime + venue.turnoverTime
 *
 * Timezone convention: slot_date + start_time / end_time are stored in the
 * venue's local timezone as `date` + `time without time zone`.
 */
@Entity('venue_unavailable_slots')
@Index(['venueId', 'slotDate'])
export class VenueUnavailableSlot {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'venue_id',
    type: 'bigint',
    nullable: false,
  })
  venueId!: number;

  @ManyToOne(() => Venue, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'venue_id' })
  venue!: Venue;

  @Column({
    name: 'slot_date',
    type: 'date',
    nullable: false,
  })
  slotDate!: string;

  @Column({
    name: 'start_time',
    type: 'time',
    nullable: false,
  })
  startTime!: string;

  @Column({
    name: 'end_time',
    type: 'time',
    nullable: false,
  })
  endTime!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  reason!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
