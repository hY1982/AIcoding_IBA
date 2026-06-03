import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Player } from './entities/player.entity';
import { PlayerPosition } from './entities/player-position.entity';
import { User } from '@modules/users/entities/user.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { PlayerService } from './services/player.service';
import { AbilityCalculationService } from './services/ability-calculation.service';
import { DefaultWeightsProvider } from './providers/default-weights.provider';
import { SystemParamWeightsProvider } from './providers/system-param-weights.provider';
import { ABILITY_WEIGHTS_PROVIDER } from './interfaces/ability-weights.provider';

/**
 * 球员模块
 *
 * 提供球员资料管理、能力值计算等核心能力。
 * 导出 PlayerService 供其他模块（如 AuthModule、MatchesModule）使用。
 */
@Module({
  imports: [TypeOrmModule.forFeature([Player, PlayerPosition, User, SystemParam, MatchPlayer])],
  providers: [
    PlayerService,
    AbilityCalculationService,
    DefaultWeightsProvider,
    {
      provide: ABILITY_WEIGHTS_PROVIDER,
      useClass: SystemParamWeightsProvider,
    },
  ],
  exports: [PlayerService, AbilityCalculationService, TypeOrmModule],
})
export class PlayersModule {}
