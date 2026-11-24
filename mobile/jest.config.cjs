module.exports = {
  preset: 'jest-expo',

  testMatch: [
    '<rootDir>/tests/**/*.jest.test.tsx'
  ],

  testPathIgnorePatterns: [
    '/node_modules/'
  ],

  clearMocks: true,

  collectCoverage: true,

  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts'
  ],

  coverageDirectory: '<rootDir>/coverage',

  coverageReporters: [
    'text',
    'lcov',
    'json-summary'
  ],
};
