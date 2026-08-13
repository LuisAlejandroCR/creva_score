const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
};

module.exports = {
  ...base,
  collectCoverageFrom: ['src/**/*.ts'],
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/test/unit/**/*.spec.ts'] },
    { ...base, displayName: 'fuzz', testMatch: ['<rootDir>/test/fuzz/**/*.spec.ts'] },
    { ...base, displayName: 'invariant', testMatch: ['<rootDir>/test/invariant/**/*.spec.ts'] },
  ],
};
