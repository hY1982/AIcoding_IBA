import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn().mockResolvedValue('value'),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue('PONG'),
    disconnect: jest.fn(),
  }));
});

interface MockRedisClient {
  on: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
  setex: jest.Mock;
  del: jest.Mock;
  ping: jest.Mock;
  disconnect: jest.Mock;
}

describe('RedisService', () => {
  let service: RedisService;
  let configService: ConfigService;

  const mockRedisConfig = {
    host: 'localhost',
    port: 6379,
    password: undefined,
    db: 0,
    keyPrefix: 'basketball:',
    retryStrategy: jest.fn(),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(mockRedisConfig),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw error when redis config is missing', () => {
    jest.spyOn(configService, 'get').mockReturnValueOnce(undefined);
    expect(() => service.onModuleInit()).toThrow(
      'Redis configuration is missing',
    );
  });

  it('should initialize redis client on module init', () => {
    service.onModuleInit();
    const getSpy = jest.spyOn(configService, 'get');
    expect(getSpy).toHaveBeenCalledWith('redis');
  });

  it('should disconnect redis client on module destroy', () => {
    service.onModuleInit();
    service.onModuleDestroy();
    const client = service.getClient() as unknown as MockRedisClient;
    expect(client.disconnect).toHaveBeenCalled();
  });

  describe('get', () => {
    it('should return value from redis', async () => {
      service.onModuleInit();
      const result = await service.get('test-key');
      expect(result).toBe('value');
    });
  });

  describe('set', () => {
    it('should set value without ttl', async () => {
      service.onModuleInit();
      await service.set('test-key', 'test-value');
      const client = service.getClient() as unknown as MockRedisClient;
      expect(client.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should set value with ttl', async () => {
      service.onModuleInit();
      await service.set('test-key', 'test-value', 3600);
      const client = service.getClient() as unknown as MockRedisClient;
      expect(client.setex).toHaveBeenCalledWith('test-key', 3600, 'test-value');
    });
  });

  describe('del', () => {
    it('should delete key from redis', async () => {
      service.onModuleInit();
      await service.del('test-key');
      const client = service.getClient() as unknown as MockRedisClient;
      expect(client.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('ping', () => {
    it('should return PONG', async () => {
      service.onModuleInit();
      const result = await service.ping();
      expect(result).toBe('PONG');
    });
  });

  describe('getClient', () => {
    it('should return redis client instance', () => {
      service.onModuleInit();
      const client = service.getClient();
      expect(client).toBeDefined();
    });
  });
});
