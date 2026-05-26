import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Mock TypeORM to avoid real database connections in E2E tests
jest.mock('@nestjs/typeorm', () => ({
  TypeOrmModule: {
    forRootAsync: jest.fn().mockReturnValue({
      module: class MockTypeOrmModule {},
    }),
    forRoot: jest.fn().mockReturnValue({
      module: class MockTypeOrmModule {},
    }),
    forFeature: jest.fn().mockReturnValue({
      module: class MockTypeOrmModule {},
    }),
  },
  InjectRepository: jest.fn().mockReturnValue(jest.fn()),
  getRepositoryToken: jest.fn().mockReturnValue('Repository'),
}));

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('/api/v1/health (GET) should return status ok', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.timestamp).toBeDefined();
      });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
