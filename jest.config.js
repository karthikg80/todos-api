module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  moduleNameMapper: {
    '^uuid$': require.resolve('uuid')
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)'
  ]
};
