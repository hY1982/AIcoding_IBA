import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './entities/match.entity';
import { MatchPlayer } from './entities/match-player.entity';
import { MatchTeam } from './entities/match-team.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Match, MatchPlayer, MatchTeam])],
  exports: [TypeOrmModule],
})
export class MatchesModule {}
