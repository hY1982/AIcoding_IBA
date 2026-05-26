import databaseConfig from './database.config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

describe('databaseConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default values when env vars are not set', () => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.DB_SSL;
    delete process.env.DB_POOL_SIZE;

    const config = databaseConfig() as PostgresConnectionOptions;

    expect(config.type).toBe('postgres');
    expect(config.host).toBe('localhost');
    expect(config.port).toBe(5432);
    expect(config.username).toBe('postgres');
    expect(config.password).toBe('password');
    expect(config.database).toBe('basketball_platform');
    expect(config.ssl).toBe(false);
    expect(config.entities).toBeDefined();
  });

  it('should use environment variables when set', () => {
    process.env.DB_HOST = 'db.example.com';
    process.env.DB_PORT = '5433';
    process.env.DB_USERNAME = 'admin';
    process.env.DB_PASSWORD = 'secret';
    process.env.DB_NAME = 'test_db';
    process.env.DB_SSL = 'true';
    process.env.DB_POOL_SIZE = '20';

    const config = databaseConfig() as PostgresConnectionOptions;

    expect(config.host).toBe('db.example.com');
    expect(config.port).toBe(5433);
    expect(config.username).toBe('admin');
    expect(config.password).toBe('secret');
    expect(config.database).toBe('test_db');
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });
});
