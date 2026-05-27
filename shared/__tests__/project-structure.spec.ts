import * as fs from 'fs';
import * as path from 'path';

describe('shared package structure', () => {
  const sharedDir = path.resolve(__dirname, '..');
  const rootDir = path.resolve(sharedDir, '..');

  describe('required files exist', () => {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'types/index.ts',
      'types/common.ts',
      'types/auth.ts',
      'types/player.ts',
      'types/venue.ts',
    ];

    test.each(requiredFiles)('%s must exist', (file) => {
      const filePath = path.join(sharedDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('package.json correctness', () => {
    const pkgPath = path.join(sharedDir, 'package.json');

    test('must have correct name and be private', () => {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.name).toBe('@basketball-match/shared');
      expect(pkg.private).toBe(true);
    });

    test('must not have main field (types-only package)', () => {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.main).toBeUndefined();
    });

    test('must have types field pointing to entry', () => {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.types).toBe('./types/index.ts');
    });

    test('must have exports field for subpath imports', () => {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.exports).toBeDefined();
      expect(pkg.exports['./*']).toBe('./types/*.ts');
    });

    test('must have typecheck script', () => {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.scripts?.typecheck).toBe('tsc --noEmit');
    });
  });

  describe('tsconfig.json correctness', () => {
    const tsconfigPath = path.join(sharedDir, 'tsconfig.json');

    test('must have strict mode enabled', () => {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      expect(tsconfig.compilerOptions?.strict).toBe(true);
    });

    test('must have declaration and emitDeclarationOnly', () => {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      expect(tsconfig.compilerOptions?.declaration).toBe(true);
      expect(tsconfig.compilerOptions?.emitDeclarationOnly).toBe(true);
    });

    test('must have baseUrl and paths for @shared/*', () => {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      expect(tsconfig.compilerOptions?.baseUrl).toBe('.');
      expect(tsconfig.compilerOptions?.paths?.['@shared/*']).toEqual(['types/*']);
    });
  });

  describe('type files export expected symbols', () => {
    test('common.ts must export ApiResponse, PaginatedResponse, TokenPair, Timestamps', () => {
      const content = fs.readFileSync(path.join(sharedDir, 'types/common.ts'), 'utf-8');
      expect(content).toContain('export interface ApiResponse');
      expect(content).toContain('export interface PaginatedResponse');
      expect(content).toContain('export interface TokenPair');
      expect(content).toContain('export interface Timestamps');
      expect(content).toContain('export const DEFAULT_PAGE_SIZE');
      expect(content).toContain('export const USER_STATUSES');
      expect(content).toContain('export const USER_TYPES');
    });

    test('auth.ts must export RegisterDto, LoginDto, AuthUser, AuthResponse', () => {
      const content = fs.readFileSync(path.join(sharedDir, 'types/auth.ts'), 'utf-8');
      expect(content).toContain('export interface RegisterDto');
      expect(content).toContain('export interface LoginDto');
      expect(content).toContain('export interface AuthUser');
      expect(content).toContain('export interface AuthResponse');
    });

    test('player.ts must export PlayerAttributes, PlayerProfile, PlayerAbility, ShootingRecord', () => {
      const content = fs.readFileSync(path.join(sharedDir, 'types/player.ts'), 'utf-8');
      expect(content).toContain('export interface PlayerAttributes');
      expect(content).toContain('export interface PlayerProfile');
      expect(content).toContain('export interface PlayerAbility');
      expect(content).toContain('export interface ShootingRecord');
      expect(content).toContain('export const BASKETBALL_POSITIONS');
      expect(content).toContain('export const GENDERS');
    });

    test('venue.ts must export Venue, VenueDetail, VenueTimeSlot, VenueListItem', () => {
      const content = fs.readFileSync(path.join(sharedDir, 'types/venue.ts'), 'utf-8');
      expect(content).toContain('export interface Venue');
      expect(content).toContain('export interface VenueDetail');
      expect(content).toContain('export interface VenueTimeSlot');
      expect(content).toContain('export interface VenueListItem');
      expect(content).toContain('export const VENUE_STATUSES');
      expect(content).toContain('export const COURT_TYPES');
    });

    test('index.ts must barrel export all modules', () => {
      const content = fs.readFileSync(path.join(sharedDir, 'types/index.ts'), 'utf-8');
      expect(content).toContain("export * from './common'");
      expect(content).toContain("export * from './auth'");
      expect(content).toContain("export * from './player'");
      expect(content).toContain("export * from './venue'");
    });
  });

  describe('consumer tsconfig.json references', () => {
    test('server/tsconfig.json must have @shared/* path mapping', () => {
      const tsconfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'server/tsconfig.json'), 'utf-8'));
      expect(tsconfig.compilerOptions?.paths?.['@shared/*']).toEqual(['../shared/types/*']);
    });

    test('apps/admin/tsconfig.json must have @shared/* path mapping', () => {
      const tsconfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps/admin/tsconfig.json'), 'utf-8'));
      expect(tsconfig.compilerOptions?.paths?.['@shared/*']).toEqual(['../../shared/types/*']);
    });

    test('apps/mobile/tsconfig.json must have @shared/* path mapping', () => {
      const tsconfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps/mobile/tsconfig.json'), 'utf-8'));
      expect(tsconfig.compilerOptions?.paths?.['@shared/*']).toEqual(['../../shared/types/*']);
    });
  });
});
