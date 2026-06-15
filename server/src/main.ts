import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Basketball Match Platform API')
    .setDescription('篮球匹配平台 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT') || 3000;

  // 启动时打印 DB 连接信息（用于调试 test script 与 server 是否连同一个库）
  try {
    const ds = app.get(getDataSourceToken());
    const dbInfo = await ds.query(`SELECT current_database() as db`);
    const host = configService.get<string>('DB_HOST') || 'localhost';
    const dbPort = configService.get<string>('DB_PORT') || '5432';
    console.log(`[DB] Connected to: ${dbInfo[0]?.db} @ ${host}:${dbPort}`);
  } catch { /* ignore */ }

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
void bootstrap();
