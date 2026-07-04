import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const projectRoot = path.resolve(import.meta.dirname, '../..')
const appDir = path.resolve(import.meta.dirname, 'screenshot-app')

export default defineConfig(async ({ mode }) => {
  const plugins: unknown[] = [react()]

  if (mode !== 'test') {
    const { default: tailwindcss } = await import('@tailwindcss/vite')
    plugins.push(tailwindcss())
  }

  return {
    root: appDir,
    plugins: plugins as never,
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, './src'),
        '@clerk/react': path.resolve(appDir, './mockClerk.tsx'),
        'convex/react': path.resolve(appDir, './mockConvex.tsx'),
      },
    },
    server: {
      port: 5179,
      host: '127.0.0.1',
    },
  }
})
