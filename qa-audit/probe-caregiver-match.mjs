// Match schedule-dropdown option values against the E2E caregiver Clerk user id.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5180'
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
const headers = { Authorization: `Bearer ${local.CLERK_SECRET_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
async function clerkUser(email) {
  const res = await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`, { headers })
  const users = await res.json()
  return users.find((u) => u.email_addresses.some((x) => x.email_address.toLowerCase() === email.toLowerCase()))
}
async function clerkTicket(userId) {
  const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', { method: 'POST', headers, body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }) })
  return (await tokRes.json()).token
}

const caregiver = await clerkUser(e2e.E2E_CAREGIVER_EMAIL)
console.log('caregiver clerk user id:', caregiver.id, '| emails:', caregiver.email_addresses.map((x) => x.email_address).join(', '))

const admin = await clerkUser(e2e.E2E_ADMIN_EMAIL)
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] })
const ctx = await browser.newContext()
const page = await ctx.newPage()
const ticket = await clerkTicket(admin.id)
await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
await page.waitForTimeout(3500)
await page.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(6000)
const row = page.locator('tr', { has: page.getByRole('link', { name: 'Phase 2 Client' }) }).first()
await row.getByRole('button', { name: 'Schedule' }).click()
await page.waitForTimeout(3000)
const options = await page.getByRole('dialog').locator('select option').evaluateAll((els) => els.map((el) => ({ value: el.value, label: el.textContent })))
const match = options.find((o) => o.value === caregiver.id)
console.log('match for signed-in caregiver:', JSON.stringify(match ?? null))
const testAccount = options.find((o) => o.label?.includes('e2e-caregiver@atriax.test'))
console.log('e2e-caregiver@atriax.test option:', JSON.stringify(testAccount ?? null))
await browser.close()
