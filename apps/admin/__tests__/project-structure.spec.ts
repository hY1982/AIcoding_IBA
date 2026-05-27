import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('Module 0.4 — Admin Dashboard Project Structure', () => {
  const baseDir = resolve(__dirname, '..');

  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'jest.config.cjs',
    '.env.example',
    'index.html',
    'src/vite-env.d.ts',
    'src/main.tsx',
    'src/App.tsx',
    'src/layouts/AdminLayout.tsx',
    'src/api/client.ts',
    '.eslintrc.cjs',
    '.prettierrc',
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

    it('should have correct name', () => {
      expect(pkg.name).toBe('basketball-match-admin');
    });

    it('should include react dependency', () => {
      expect(pkg.dependencies).toHaveProperty('react');
    });

    it('should include react-dom dependency', () => {
      expect(pkg.dependencies).toHaveProperty('react-dom');
    });

    it('should include vite devDependency', () => {
      expect(pkg.devDependencies).toHaveProperty('vite');
    });

    it('should include typescript devDependency', () => {
      expect(pkg.devDependencies).toHaveProperty('typescript');
    });

    it('should include antd dependency', () => {
      expect(pkg.dependencies).toHaveProperty('antd');
    });

    it('should include axios dependency', () => {
      expect(pkg.dependencies).toHaveProperty('axios');
    });

    it('should include react-router-dom dependency', () => {
      expect(pkg.dependencies).toHaveProperty('react-router-dom');
    });

    it('should have dev script', () => {
      expect(pkg.scripts).toHaveProperty('dev');
    });

    it('should have build script', () => {
      expect(pkg.scripts).toHaveProperty('build');
    });

    it('should have test script', () => {
      expect(pkg.scripts).toHaveProperty('test');
    });

    it('should have typecheck script', () => {
      expect(pkg.scripts).toHaveProperty('typecheck');
    });

    it('should have lint script', () => {
      expect(pkg.scripts).toHaveProperty('lint');
    });
  });

  describe('tsconfig.json', () => {
    let tsconfig: Record<string, any>;

    beforeAll(() => {
      const content = readFileSync(resolve(baseDir, 'tsconfig.json'), 'utf-8');
      tsconfig = JSON.parse(content);
    });

    it('should have strict mode enabled', () => {
      expect(tsconfig.compilerOptions?.strict).toBe(true);
    });

    it('should have jsx set to react-jsx', () => {
      expect(tsconfig.compilerOptions?.jsx).toBe('react-jsx');
    });

    it('should have baseUrl set', () => {
      expect(tsconfig.compilerOptions?.baseUrl).toBe('.');
    });

    it('should have @/* path alias', () => {
      expect(tsconfig.compilerOptions?.paths?.['@/*']).toEqual(['./src/*']);
    });
  });

  describe('vite.config.ts', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(resolve(baseDir, 'vite.config.ts'), 'utf-8');
    });

    it('should import @vitejs/plugin-react', () => {
      expect(content).toMatch(/@vitejs\/plugin-react/);
    });

    it('should configure alias', () => {
      expect(content).toMatch(/alias/);
    });
  });

  describe('jest.config.cjs', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(resolve(baseDir, 'jest.config.cjs'), 'utf-8');
    });

    it('should set testEnvironment to jsdom', () => {
      expect(content).toMatch(/testEnvironment.*jsdom/);
    });

    it('should configure moduleNameMapper for @/', () => {
      expect(content).toMatch(/moduleNameMapper/);
      expect(content).toMatch(/@\//);
    });
  });

  describe('.env.example', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(resolve(baseDir, '.env.example'), 'utf-8');
    });

    it('should contain VITE_API_BASE_URL', () => {
      expect(content).toMatch(/VITE_API_BASE_URL/);
    });
  });

  describe('index.html', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(resolve(baseDir, 'index.html'), 'utf-8');
    });

    it('should point to src/main.tsx', () => {
      expect(content).toMatch(/src\/main\.tsx/);
    });
  });

  describe('src/main.tsx', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(resolve(baseDir, 'src/main.tsx'), 'utf-8');
    });

    it('should import react-dom/client', () => {
      expect(content).toMatch(/react-dom\/client/);
    });

    it('should use createRoot', () => {
      expect(content).toMatch(/createRoot/);
    });
  });

  describe('src/App.tsx', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(resolve(baseDir, 'src/App.tsx'), 'utf-8');
    });

    it('should import RouterProvider', () => {
      expect(content).toMatch(/RouterProvider/);
    });

    it('should import ConfigProvider from antd', () => {
      expect(content).toMatch(/ConfigProvider/);
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

    it('should reference VITE_API_BASE_URL', () => {
      expect(content).toMatch(/VITE_API_BASE_URL/);
    });
  });
});
