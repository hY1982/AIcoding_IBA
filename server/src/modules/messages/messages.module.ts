import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitter } from 'events';
import { MatchMessage } from './entities/match-message.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { Player } from '@modules/players/entities/player.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { MessageService } from './services/message.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MatchMessage, Match, MatchPlayer, Player, SystemParam]),
  ],
  providers: [
    MessageService,
    {
      provide: EventEmitter,
      useValue: new EventEmitter(),
    },
  ],
  exports: [MessageService, TypeOrmModule],
})
export class MessagesModule {}
