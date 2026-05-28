import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchMessage } from './entities/match-message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MatchMessage])],
  exports: [TypeOrmModule],
})
export class MessagesModule {}
