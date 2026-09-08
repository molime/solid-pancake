// Bootstrap: find Clerk user id for the E2E admin, insert platformAdmins row.
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

function loadEnv(path) {
  const out = {}
  try {
    for (const raw of readFileSync(path, 'utf8').split('\n')) {
      const line = raw.replace(/\r$/, '')
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) out[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {}
  return out
}

const local = loadEnv('.env.local')
const e2e = loadEnv('.env.e2e')
const secret = local.CLERK_SECRET_KEY || e2e.CLERK_SECRET_KEY
const email = e2e.E2E_ADMIN_EMAIL
if (!secret || !email) throw new Error('missing CLERK_SECRET_KEY or E2E_ADMIN_EMAIL')

const headers = { Authorization: `Bearer ${secret}`, Accept: 'application/json' }
const res = await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`, { headers })
if (!res.ok) throw new Error(`clerk users lookup failed: ${res.status}`)
const users = await res.json()
const user = users.find((u) => u.email_addresses.some((e) => e.email_address.toLowerCase() === email.toLowerCase()))
if (!user) throw new Error('user not found')
console.log('clerk user id:', user.id)

// Insert platformAdmins row via convex import (idempotent-ish: import adds a row;
// check existing first).
const existing = execSync('npx convex data platformAdmins --format jsonl', { encoding: 'utf8' }).trim()
if (existing.includes(user.id)) {
  console.log('platformAdmins row already exists')
} else {
  writeFileSync('qa-stripe-e2e/platformAdmin.jsonl', JSON.stringify({
    clerkUserId: user.id,
    createdAt: new Date().toISOString(),
  }) + '\n')
  execSync('npx convex import --table platformAdmins --replace qa-stripe-e2e/platformAdmin.jsonl -y', { encoding: 'utf8', stdio: 'inherit' })
  console.log('platformAdmins row inserted')
}
