import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import type { PluginOption } from 'vite'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins: PluginOption[] = [react()]
  const env = loadEnv(mode, process.cwd(), '')
  const convexUrl = env.VITE_CONVEX_URL || 'http://127.0.0.1:3210'

  // Tailwind's Vite plugin loads a native Oxide binding. Vite's default
  // config bundler tries to resolve that native dependency while bundling
  // vite.config.ts, which fails in some Windows sandboxes with EPERM.
  // package.json now invokes Vite/Vitest with --configLoader native so the
  // config is executed by Node directly instead of being bundled. We still
  // keep the plugin out of test mode because jsdom tests do not need CSS
  // processing and should not pull in the Oxide binary.
  if (mode !== 'test') {
    const { default: tailwindcss } = await import('@tailwindcss/vite')
    plugins.push(tailwindcss())
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api/storage': {
          target: convexUrl,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/e2e/**',
        '.hermes-pipeline/**',
      ],
      globals: true,
      setupFiles: './src/test/setup.ts',
      css: true,
      pool: 'threads',
      fileParallelism: false,
      maxWorkers: 1,
      testTimeout: 15000,
    },
  }
})
