import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules', '.next', '.next-build', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules',
        '.next',
        '.next-build',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        'instrumentation.ts', // OpenTelemetry setup
        'middleware*.ts', // Middlewares (difíciles de testear)
        '.claude/**',
        'scripts/**', // Scripts de deploy
        'docs/**',
      ],
      thresholds: {
        statements: 5,
        branches: 27,
        functions: 13,
        lines: 5,
      },
      // This is a conservative baseline gate. Raise it module by module as
      // critical API/auth/tenant coverage increases.
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
