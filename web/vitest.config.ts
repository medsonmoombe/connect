import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'src/lib/*.ts',
        'src/lib/*.tsx',
      ],
      exclude: [
        'src/lib/supabase.ts',
        'src/lib/supabase-server.ts',
        'src/lib/api-client.ts',
        'src/lib/ai-provider.ts',
        'src/lib/storage-provider.ts',
        'src/lib/storage.ts',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
