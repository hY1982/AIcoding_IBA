import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Venue } from './venue.entity';

/**
 * VenueTimeSlot entity representing a bookable time slot for a venue.
 *
 * Timezone convention: slot_date + start_time / end_time are stored in the
 * venue's local timezone as `date` + `time without time zone`. Application
 * layer handles timezone conversion uniformly.
 */
@Entity('venue_time_slots')
@Index(['venueId', 'slotDate'])
export class VenueTimeSlot {
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
    name: 'is_booked',
    type: 'boolean',
    nullable: true,
    default: false,
  })
  isBooked!: boolean | null;

  /**
   * Reserved foreign key to matches table. Will be linked via migration
   * after the matches table is created in a later module.
   */
  @Column({
    name: 'match_id',
    type: 'bigint',
    nullable: true,
  })
  matchId!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
