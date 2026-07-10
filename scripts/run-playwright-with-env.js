import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = existsSync(resolve('.env.e2e')) ? '.env.e2e' : '.env.local'
const args = [
  '--env-file',
  envFile,
  './node_modules/@playwright/test/cli.js',
  'test',
  ...process.argv.slice(2),
]

console.log(`e2e using env file: ${envFile}`)

const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
process.exit(result.status ?? 0)
