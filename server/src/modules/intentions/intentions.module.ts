import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Intention } from './entities/intention.entity';
import { IntentionVenue } from './entities/intention-venue.entity';
import { IntentionFormat } from './entities/intention-format.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { IntentionService } from './services/intention.service';
import { IntentionController } from './controllers/intention.controller';
import { PlayersModule } from '@modules/players/players.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Intention,
      IntentionVenue,
      IntentionFormat,
      Player,
      Venue,
      Format,
    ]),
    PlayersModule,
  ],
  controllers: [IntentionController],
  providers: [IntentionService],
  exports: [TypeOrmModule, IntentionService],
})
export class IntentionsModule {}
