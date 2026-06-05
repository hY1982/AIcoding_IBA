import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { MatchingEngineService } from './services/matching-engine.service';
import { TeamBalancerService } from './services/team-balancer.service';
import { MatchingProcessor } from './matching.processor';
import { MatchingScheduler } from './matching.scheduler';

/**
 * 匹配引擎模块
 *
 * 集成 TypeORM 实体、BullMQ 队列和 Cron 定时调度，
 * 提供自动匹配比赛意向的完整能力。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Intention, Match, Format, SystemParam]),
    BullModule.registerQueueAsync({
      name: 'matching',
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisConfig = configService.get<{
          host: string;
          port: number;
          password?: string;
          db: number;
          keyPrefix: string;
        }>('redis');
        return {
          connection: {
            host: redisConfig?.host || 'localhost',
            port: redisConfig?.port || 6379,
            password: redisConfig?.password,
            db: redisConfig?.db || 0,
          },
        };
      },
      inject: [ConfigService],
    }),
    // ScheduleModule.forRoot() 已在 AppModule 中注册，避免重复
  ],
  providers: [
    MatchingEngineService,
    TeamBalancerService,
    MatchingProcessor,
    MatchingScheduler,
  ],
  exports: [MatchingEngineService, TeamBalancerService],
})
export class MatchingModule {}
