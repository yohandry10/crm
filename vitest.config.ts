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
      // Umbrales de coverage
      // Estos umbrales fallarán el build si no se cumplen
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
      // Archivos específicos que deben tener 100% coverage
      // perFile: true,
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
