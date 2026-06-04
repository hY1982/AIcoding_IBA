import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import { CommonModule } from './common/common.module';
import { UsersModule } from './modules/users/users.module';
import { PlayersModule } from './modules/players/players.module';
import { VenuesModule } from './modules/venues/venues.module';
import { FormatsModule } from './modules/formats/formats.module';
import { IntentionsModule } from './modules/intentions/intentions.module';
import { MatchesModule } from './modules/matches/matches.module';
import { MessagesModule } from './modules/messages/messages.module';
import { FeedbacksModule } from './modules/feedbacks/feedbacks.module';
import { SystemModule } from './modules/system/system.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuthModule } from './modules/auth/auth.module';
import { MatchingModule } from './modules/matching/matching.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get<{
          type: string;
          host: string;
          port: number;
          username: string;
          password: string;
          database: string;
          entities: string[];
          synchronize: boolean;
          logging: boolean;
          ssl: boolean | { rejectUnauthorized: boolean };
          extra: Record<string, unknown>;
        }>('database');
        if (!dbConfig) {
          throw new Error('Database configuration is missing');
        }
        return {
          type: dbConfig.type as 'postgres',
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          entities: dbConfig.entities,
          synchronize: dbConfig.synchronize,
          logging: dbConfig.logging,
          ssl: dbConfig.ssl,
          extra: dbConfig.extra,
        };
      },
      inject: [ConfigService],
    }),
    CommonModule,
    UsersModule,
    PlayersModule,
    VenuesModule,
    FormatsModule,
    IntentionsModule,
    MatchesModule,
    MessagesModule,
    FeedbacksModule,
    SystemModule,
    NotificationsModule,
    AuthModule,
    MatchingModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
