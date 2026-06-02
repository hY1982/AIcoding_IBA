import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Player } from './entities/player.entity';
import { PlayerPosition } from './entities/player-position.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { AbilityCalculationService } from './services/ability-calculation.service';
import { DefaultWeightsProvider } from './providers/default-weights.provider';
import { SystemParamWeightsProvider } from './providers/system-param-weights.provider';
import { ABILITY_WEIGHTS_PROVIDER } from './interfaces/ability-weights.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Player, PlayerPosition, SystemParam])],
  providers: [
    AbilityCalculationService,
    DefaultWeightsProvider,
    {
      provide: ABILITY_WEIGHTS_PROVIDER,
      useClass: SystemParamWeightsProvider,
    },
  ],
  exports: [AbilityCalculationService, TypeOrmModule],
})
export class PlayersModule {}
