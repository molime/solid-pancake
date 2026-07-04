import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

if (!existsSync(resolve('.env.e2e'))) {
  console.error(
    'e2e:full requires .env.e2e. Copy .env.e2e.example and fill in live credentials.',
  )
  process.exit(1)
}

const args = [
  '--env-file',
  '.env.e2e',
  './node_modules/@playwright/test/cli.js',
  'test',
  ...process.argv.slice(2),
]

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env: { ...process.env, E2E_FULL: '1' },
})
process.exit(result.status ?? 0)
