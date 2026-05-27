import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Player } from './entities/player.entity';
import { PlayerPosition } from './entities/player-position.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Player, PlayerPosition])],
  exports: [TypeOrmModule],
})
export class PlayersModule {}
