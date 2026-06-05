import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback } from './entities/feedback.entity';
import { FeedbackPlayerRating } from './entities/feedback-player-rating.entity';
import { AdjustUpdateFailure } from './entities/adjust-update-failure.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { Player } from '@modules/players/entities/player.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { FeedbackService } from './services/feedback.service';
import { AbilityAdjustService } from './services/ability-adjust.service';
import { FeedbackAdjustSyncService } from './services/feedback-adjust-sync.service';
import { FeedbacksController } from './feedbacks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Feedback,
      FeedbackPlayerRating,
      AdjustUpdateFailure,
      Match,
      MatchPlayer,
      Player,
      SystemParam,
    ]),
  ],
  controllers: [FeedbacksController],
  providers: [FeedbackService, AbilityAdjustService, FeedbackAdjustSyncService],
  exports: [FeedbackService, AbilityAdjustService, FeedbackAdjustSyncService],
})
export class FeedbacksModule {}
