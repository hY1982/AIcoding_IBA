/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource, Repository } from 'typeorm';
import { SystemParam } from './system-param.entity';
import { createTestSystemParam } from '../../../../test/factories/feedback.factory';

describe('SystemParam Entity', () => {
  let dataSource: DataSource;
  let paramRepo: Repository<SystemParam>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: 'basketball_platform_test',
      entities: [SystemParam],
      synchronize: true,
    });
    await dataSource.initialize();
    paramRepo = dataSource.getRepository(SystemParam);
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE system_params CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('table structure', () => {
    it('should create system_params table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'system_params'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('param_key');
      expect(columnNames).toContain('param_value');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('updated_at');
    });

    it('should have id as bigint primary key', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'system_params' AND column_name = 'id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have param_key as non-nullable varchar(100)', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'system_params' AND column_name = 'param_key'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('character varying');
      expect(columns[0].character_maximum_length).toBe(100);
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have param_value as jsonb non-nullable', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'system_params' AND column_name = 'param_value'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('jsonb');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have description as nullable varchar(255)', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'system_params' AND column_name = 'description'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('character varying');
      expect(columns[0].character_maximum_length).toBe(255);
      expect(columns[0].is_nullable).toBe('YES');
    });

    it('should have updated_at as timestamptz', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'system_params' AND column_name = 'updated_at'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('timestamp with time zone');
    });

    it('should have unique constraint on param_key', async () => {
      const constraints = await dataSource.query(
        `SELECT constraint_name, constraint_type
         FROM information_schema.table_constraints
         WHERE table_name = 'system_params' AND constraint_type = 'UNIQUE'`,
      );
      // TypeORM synchronize may generate auto-named unique constraints;
      // we just verify at least one UNIQUE constraint exists on the table
      expect(constraints.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('entity creation', () => {
    it('should create a system param with all fields', async () => {
      const param = await createTestSystemParam(dataSource, {
        paramKey: 'test_param' as import('@shared/system').SystemParamKey,
        paramValue: { foo: 'bar', count: 42 },
        description: 'Test parameter description',
      });

      expect(param.id).toBeDefined();
      expect(param.paramKey).toBe('test_param');
      expect(param.paramValue).toEqual({ foo: 'bar', count: 42 });
      expect(param.description).toBe('Test parameter description');
      expect(param.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow description to be null', async () => {
      const param = await createTestSystemParam(dataSource, {
        paramKey: 'test_param_no_desc' as import('@shared/system').SystemParamKey,
        paramValue: { key: 'value' },
      });

      expect(param.description).toBeNull();
    });

    it('should reject duplicate param_key', async () => {
      await createTestSystemParam(dataSource, {
        paramKey: 'duplicate_key' as import('@shared/system').SystemParamKey,
        paramValue: { a: 1 },
      });

      const duplicate = paramRepo.create({
        paramKey: 'duplicate_key' as import('@shared/system').SystemParamKey,
        paramValue: { b: 2 },
      });

      await expect(paramRepo.save(duplicate)).rejects.toThrow();
    });

    it('should store and retrieve complex JSONB structures', async () => {
      const complexValue = {
        nested: {
          array: [1, 2, 3],
          object: { deep: 'value' },
        },
        boolean: true,
        number: 3.14,
        string: 'test',
        nullField: null,
      };

      const param = await createTestSystemParam(dataSource, {
        paramKey: 'complex_param' as import('@shared/system').SystemParamKey,
        paramValue: complexValue,
      });

      const found = await paramRepo.findOne({ where: { id: param.id } });
      expect(found).not.toBeNull();
      expect(found!.paramValue).toEqual(complexValue);
    });
  });
});
