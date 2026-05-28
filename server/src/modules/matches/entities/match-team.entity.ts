import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Match } from './match.entity';

/**
 * MatchTeam entity representing a team within a match.
 *
 * Stores team assignments including team number, optional name,
 * and average ability score for balance tracking.
 *
 * avgAbility maintenance strategy:
 * - Recalculated whenever a MatchPlayer's teamNumber is assigned or changed.
 * - Can be implemented via database trigger for strong consistency,
 *   or via TeamAssignmentService.updateTeamAbility() in application layer.
 * - Formula: AVG(match_players.player.baseAbilityScore) for players
 *   where match_players.teamNumber = this.teamNumber.
 */
@Entity('match_teams')
@Unique(['matchId', 'teamNumber'])
export class MatchTeam {
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
    name: 'team_number',
    type: 'int',
    nullable: false,
  })
  teamNumber!: number;

  @Column({
    name: 'team_name',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  teamName!: string | null;

  @Column({
    name: 'avg_ability',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  avgAbility!: number | null;
}
