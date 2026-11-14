// Testes de integração: falam com o Supabase DE VERDADE (projeto ADRER-Financeiro).
// Rodar: npm run test:integracao   (precisa do token do Supabase no ambiente — veja supabase/api.mjs)
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/integracao/**/*.test.ts'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '^expo/virtual/env$': '<rootDir>/integracao/env-stub.js' },
  testTimeout: 90000,
};
