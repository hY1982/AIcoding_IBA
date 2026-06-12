import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

function getDatabaseConfig(): TypeOrmModuleOptions {
  const password = process.env.DB_PASSWORD;
  if (!password) {
    throw new Error('DB_PASSWORD environment variable is required');
  }
  // E2E bot 测试运行时静默 TypeORM 日志和 schema 同步
  const isE2E = process.env.E2E_TEST === 'true';
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password,
    database: process.env.DB_NAME || 'basketball_platform',
    entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
    synchronize: !isE2E && process.env.NODE_ENV !== 'production',
    logging: !isE2E && process.env.NODE_ENV === 'development',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    extra: {
      poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
      connectionTimeoutMillis: 5000,
    },
  };
}

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => getDatabaseConfig(),
);

export function getConnectionSource(): DataSource {
  return new DataSource({
    ...(getDatabaseConfig() as DataSourceOptions),
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    migrationsTableName: 'migrations',
  });
}
