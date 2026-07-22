/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'],
  transform: {
    '^.+\\.(t|j)sx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../shared/types/$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
    },
    'import.meta.env': {
      VITE_API_BASE_URL: 'http://localhost:3000/api/v1',
    },
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.cjs'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/**/*.spec.ts',
    '!src/**/*.spec.tsx',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 80,
      lines: 85,
      statements: 85,
    },
  },
};
