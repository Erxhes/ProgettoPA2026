/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  testMatch: ['**/*.test.ts'],
  // La prima esecuzione compila i file con ts-jest e, a cache fredda, può superare i 5 secondi predefiniti
  testTimeout: 30000,
  // Pochi worker: con tutte le CPU della macchina i processi Jest possono esaurire la memoria del container (SIGKILL)
  maxWorkers: 2,
};
