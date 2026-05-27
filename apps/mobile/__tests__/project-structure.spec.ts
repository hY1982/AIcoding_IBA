import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('Module 0.3 — Mobile Project Structure', () => {
  const baseDir = resolve(__dirname, '..');

  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'app.json',
    'App.tsx',
    'src/api/client.ts',
    'src/stores/index.ts',
  ];

  test.each(requiredFiles)('file %s should exist', (file) => {
    const filePath = resolve(baseDir, file);
    expect(existsSync(filePath)).toBe(true);
  });

  describe('package.json', () => {
    let pkg: Record<string, any>;

    beforeAll(() => {
      const content = readFileSync(resolve(baseDir, 'package.json'), 'utf-8');
      pkg = JSON.parse(content);
    });

    it('should have correct name and version', () => {
      expect(pkg.name).toBe('basketball-match-mobile');
      expect(pkg.version).toBe('0.0.1');
    });

    it('should include expo dependency', () => {
      expect(pkg.dependencies).toHaveProperty('expo');
    });

    it('should include react-native dependency', () => {
      expect(pkg.dependencies).toHaveProperty('react-native');
    });

    it('should include typescript dependency', () => {
      expect(pkg.devDependencies).toHaveProperty('typescript');
    });

    it('should include zustand for state management', () => {
      expect(pkg.dependencies).toHaveProperty('zustand');
    });

    it('should include react-navigation dependencies', () => {
      expect(pkg.dependencies).toHaveProperty('@react-navigation/native');
    });

    it('should include axios for API calls', () => {
      expect(pkg.dependencies).toHaveProperty('axios');
    });

    it('should have main field pointing to App.tsx', () => {
      expect(pkg.main).toBe('App.tsx');
    });

    it('should have typecheck script', () => {
      expect(pkg.scripts).toHaveProperty('typecheck');
    });
  });

  describe('tsconfig.json', () => {
    let tsconfig: Record<string, any>;

    beforeAll(() => {
      const content = readFileSync(resolve(baseDir, 'tsconfig.json'), 'utf-8');
      tsconfig = JSON.parse(content);
    });

    it('should extend expo tsconfig', () => {
      expect(tsconfig.extends).toBe('expo/tsconfig.base');
    });

    it('should have strict mode enabled', () => {
      expect(tsconfig.compilerOptions?.strict).toBe(true);
    });

    it('should include src directory', () => {
      expect(tsconfig.include).toContain('src/**/*');
    });
  });

  describe('app.json', () => {
    let appConfig: Record<string, any>;

    beforeAll(() => {
      const content = readFileSync(resolve(baseDir, 'app.json'), 'utf-8');
      appConfig = JSON.parse(content);
    });

    it('should have expo configuration', () => {
      expect(appConfig).toHaveProperty('expo');
    });

    it('should have correct app name', () => {
      expect(appConfig.expo?.name).toBe('BasketballMatch');
    });

    it('should have correct slug', () => {
      expect(appConfig.expo?.slug).toBe('basketball-match-mobile');
    });
  });

  describe('App.tsx', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(resolve(baseDir, 'App.tsx'), 'utf-8');
    });

    it('should import React', () => {
      expect(content).toMatch(/import React/);
    });

    it('should export default component', () => {
      expect(content).toMatch(/export default function App/);
    });

    it('should use React Native components', () => {
      expect(content).toMatch(/from ['"]react-native['"]/);
    });
  });

  describe('src/api/client.ts', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(resolve(baseDir, 'src/api/client.ts'), 'utf-8');
    });

    it('should import axios', () => {
      expect(content).toMatch(/import axios/);
    });

    it('should create axios instance', () => {
      expect(content).toMatch(/axios\.create/);
    });

    it('should export the client', () => {
      expect(content).toMatch(/export/);
    });
  });

  describe('src/stores/index.ts', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(resolve(baseDir, 'src/stores/index.ts'), 'utf-8');
    });

    it('should import zustand', () => {
      expect(content).toMatch(/import.*create.*from ['"]zustand['"]/);
    });

    it('should export a store', () => {
      expect(content).toMatch(/export/);
    });
  });
});
