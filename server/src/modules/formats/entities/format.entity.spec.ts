/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { DataSource, Repository } from 'typeorm';
import { Format } from './format.entity';

describe('Format Entity', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: 'basketball_platform_test',
      entities: [Format],
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE formats CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('table structure', () => {
    it('should create formats table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'formats'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('format_type');
      expect(columnNames).toContain('team_size');
      expect(columnNames).toContain('team_count_min');
      expect(columnNames).toContain('team_count_max');
      expect(columnNames).toContain('win_condition');
      expect(columnNames).toContain('duration_hours');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('is_active');
      expect(columnNames).toContain('created_at');
    });

    it('should have id as bigint primary key', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'formats' AND column_name = 'id'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('bigint');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have name as varchar(50) non-nullable', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'formats' AND column_name = 'name'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('character varying');
      expect(columns[0].character_maximum_length).toBe(50);
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have format_type as enum non-nullable', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable, udt_name
         FROM information_schema.columns
         WHERE table_name = 'formats' AND column_name = 'format_type'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('USER-DEFINED');
      expect(columns[0].udt_name).toBe('formats_format_type_enum');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have team_size, team_count_min, team_count_max as int non-nullable', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'formats'
         AND column_name IN ('team_size', 'team_count_min', 'team_count_max')
         ORDER BY column_name`,
      );
      expect(columns.length).toBe(3);
      for (const col of columns) {
        expect(col.data_type).toBe('integer');
        expect(col.is_nullable).toBe('NO');
      }
    });

    it('should have duration_hours as decimal(3,1)', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, numeric_precision, numeric_scale
         FROM information_schema.columns
         WHERE table_name = 'formats' AND column_name = 'duration_hours'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('numeric');
      expect(parseInt(columns[0].numeric_precision, 10)).toBe(3);
      expect(parseInt(columns[0].numeric_scale, 10)).toBe(1);
    });

    it('should have is_active as non-nullable with default true', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, column_default, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'formats' AND column_name = 'is_active'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('true');
    });

    it('should have created_at as timestamptz', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type
         FROM information_schema.columns
         WHERE table_name = 'formats' AND column_name = 'created_at'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('timestamp with time zone');
    });

    it('should have CHECK constraint on team_count_max >= team_count_min', async () => {
      const constraints = await dataSource.query(
        `SELECT constraint_name, constraint_type
         FROM information_schema.table_constraints
         WHERE table_name = 'formats' AND constraint_type = 'CHECK'`,
      );
      const checkConstraint = constraints.find(
        (c: { constraint_name: string }) =>
          c.constraint_name === 'CHK_formats_team_counts',
      );
      expect(checkConstraint).toBeDefined();
    });
  });

  describe('entity creation', () => {
    it('should create a format with all fields', async () => {
      const formatRepo = dataSource.getRepository(Format);

      const format = formatRepo.create({
        name: '3v3短赛',
        formatType: 'short',
        teamSize: 3,
        teamCountMin: 3,
        teamCountMax: 4,
        winCondition: '先进5球或11分',
        durationHours: 1.5,
        description: '3对3短赛，先进5球或先得11分者胜',
      });
      const saved = await formatRepo.save(format);

      expect(saved.id).toBeDefined();
      expect(saved.name).toBe('3v3短赛');
      expect(saved.formatType).toBe('short');
      expect(saved.teamSize).toBe(3);
      expect(saved.teamCountMin).toBe(3);
      expect(saved.teamCountMax).toBe(4);
      expect(saved.winCondition).toBe('先进5球或11分');
      expect(parseFloat(saved.durationHours as unknown as string)).toBe(1.5);
      expect(saved.description).toBe('3对3短赛，先进5球或先得11分者胜');
      expect(saved.isActive).toBe(true);
      expect(saved.createdAt).toBeInstanceOf(Date);
    });

    it('should reject invalid format_type', async () => {
      const formatRepo = dataSource.getRepository(Format);

      const format = formatRepo.create({
        name: 'Invalid Format',
        formatType: 'invalid_type' as 'short',
        teamSize: 3,
        teamCountMin: 3,
        teamCountMax: 4,
      });

      await expect(formatRepo.save(format)).rejects.toThrow();
    });

    it('should default is_active to true', async () => {
      const formatRepo = dataSource.getRepository(Format);

      const format = formatRepo.create({
        name: 'Default Active Format',
        formatType: 'short',
        teamSize: 3,
        teamCountMin: 3,
        teamCountMax: 4,
      });
      const saved = await formatRepo.save(format);

      expect(saved.isActive).toBe(true);
    });

    it('should allow optional fields to be null', async () => {
      const formatRepo = dataSource.getRepository(Format);

      const format = formatRepo.create({
        name: 'Minimal Format',
        formatType: 'short',
        teamSize: 3,
        teamCountMin: 3,
        teamCountMax: 4,
      });
      const saved = await formatRepo.save(format);

      expect(saved.winCondition).toBeNull();
      expect(saved.durationHours).toBeNull();
      expect(saved.description).toBeNull();
    });

    it('should reject team_count_max < team_count_min via database CHECK constraint', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "formats" ("name","format_type","team_size","team_count_min","team_count_max")
           VALUES ('Bad Format','short',3,4,2)`,
        ),
      ).rejects.toThrow(/CHK_formats_team_counts/);
    });
  });
});
