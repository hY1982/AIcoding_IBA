import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback } from './entities/feedback.entity';
import { FeedbackPlayerRating } from './entities/feedback-player-rating.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Feedback, FeedbackPlayerRating])],
  exports: [TypeOrmModule],
})
export class FeedbacksModule {}
