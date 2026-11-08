const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

module.exports = createJestConfig({
  testEnvironment: 'node', // testes de View definem @jest-environment jsdom no topo
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
});
