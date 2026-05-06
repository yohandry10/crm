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
      reporter: ['text', 'json', 'html', 'lcov'],
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
      // Coverage is reported in CI, but not gated yet. The current baseline is
      // low and must be raised by module before enabling hard thresholds.
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
