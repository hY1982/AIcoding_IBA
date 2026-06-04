import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Intention } from './entities/intention.entity';
import { IntentionVenue } from './entities/intention-venue.entity';
import { IntentionFormat } from './entities/intention-format.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { IntentionService } from './services/intention.service';

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
  ],
  providers: [IntentionService],
  exports: [TypeOrmModule, IntentionService],
})
export class IntentionsModule {}
