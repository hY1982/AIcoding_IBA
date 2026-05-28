import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Intention } from './entities/intention.entity';
import { IntentionVenue } from './entities/intention-venue.entity';
import { IntentionFormat } from './entities/intention-format.entity';
import { IntentionsService } from './services/intentions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Intention, IntentionVenue, IntentionFormat]),
  ],
  providers: [IntentionsService],
  exports: [TypeOrmModule, IntentionsService],
})
export class IntentionsModule {}
