import type { Config } from 'jest';

const config: Config = {
  projects: [
    // Node environment: lib/db, estimator logic, API route unit tests
    {
      displayName: 'node',
      testMatch: ['<rootDir>/tests/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      // Pass --experimental-sqlite to the Node process that runs tests
      testEnvironmentOptions: {
        nodeOptions: ['--experimental-sqlite'],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      globals: {
        'ts-jest': {
          tsconfig: {
            module: 'CommonJS',
          },
        },
      },
    },
    // jsdom environment: React component tests
    {
      displayName: 'jsdom',
      testMatch: ['<rootDir>/tests/**/*.test.tsx'],
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['@testing-library/jest-dom'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '\\.(css|scss)$': '<rootDir>/tests/__mocks__/fileMock.js',
      },
      globals: {
        'ts-jest': {
          tsconfig: {
            module: 'CommonJS',
            jsx: 'react-jsx',
          },
        },
      },
    },
  ],
};

export default config;
