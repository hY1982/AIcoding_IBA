import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR, APP_FILTER, APP_PIPE } from '@nestjs/core';
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
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
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
  providers: [
    AppService,
    // Global ValidationPipe — 在模块级别注册确保 E2E 测试也能生效
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    },
    // Global TransformInterceptor — 统一成功响应格式
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Global HttpExceptionFilter — 统一错误响应格式
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
