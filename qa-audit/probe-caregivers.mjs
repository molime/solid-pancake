// Debug: dump caregiver options in the Schedule Shift dialog.
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
async function clerkTicket(email) {
  const headers = { Authorization: `Bearer ${local.CLERK_SECRET_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
  const res = await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`, { headers })
  const users = await res.json()
  const user = users.find((u) => u.email_addresses.some((x) => x.email_address.toLowerCase() === email.toLowerCase()))
  const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', { method: 'POST', headers, body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }) })
  return (await tokRes.json()).token
}
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] })
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 } })
const page = await ctx.newPage()
const ticket = await clerkTicket(e2e.E2E_ADMIN_EMAIL)
await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
await page.waitForTimeout(3500)
await page.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(6000)
const row = page.locator('tr', { has: page.getByRole('link', { name: 'Phase 2 Client' }) }).first()
await row.getByRole('button', { name: 'Schedule' }).click()
await page.waitForTimeout(3000)
const opts = await page.getByRole('dialog').locator('select option').allInnerTexts()
console.log('E2E_CAREGIVER_EMAIL =', JSON.stringify(e2e.E2E_CAREGIVER_EMAIL))
console.log('options:', JSON.stringify(opts, null, 2))
await browser.close()
