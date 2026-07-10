
import { readFileSync } from 'fs'
import { execFileSync } from 'child_process'

const envPath = process.argv[2]
const envText = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envText.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const idx = line.indexOf('=')
  if (idx > 0) {
    env[line.slice(0, idx)] = line.slice(idx + 1)
  }
}

const isWin = process.platform === 'win32'
const convexBin = isWin ? 'node_modules/.bin/convex.cmd' : 'node_modules/.bin/convex'

const keys = [
  'CLERK_SECRET_KEY',
  'APP_URL',
  'VITE_CONVEX_URL',
  'VITE_CONVEX_SITE_URL',
  'VITE_CLERK_PUBLISHABLE_KEY',
  'E2E_CLERK_ORG_ID',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'E2E_HR_EMAIL',
  'E2E_HR_PASSWORD',
  'E2E_COORDINATOR_EMAIL',
  'E2E_COORDINATOR_PASSWORD',
  'E2E_CAREGIVER_EMAIL',
  'E2E_CAREGIVER_PASSWORD',
  'E2E_CANDIDATE_EMAIL',
  'E2E_CANDIDATE_PASSWORD',
  'ATRIA_X_DEV_INVITE_BYPASS',
]
for (const k of keys) {
  const v = env[k]
  if (!v) {
    console.log('skip', k)
    continue
  }
  try {
    execFileSync(convexBin, ['env', 'set', `${k}=${v}`], { stdio: 'inherit' })
  } catch (e) {
    console.error('failed', k, e.message)
    process.exit(1)
  }
}
