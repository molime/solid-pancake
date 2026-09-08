// Dump every shift card the E2E caregiver sees on /caregiver/today.
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
async function clerkTicket(email) {
  const res = await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`, { headers })
  const users = await res.json()
  const user = users.find((u) => u.email_addresses.some((x) => x.email_address.toLowerCase() === email.toLowerCase()))
  const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', { method: 'POST', headers, body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }) })
  return (await tokRes.json()).token
}
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] })
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 } })
const page = await ctx.newPage()
const ticket = await clerkTicket(e2e.E2E_CAREGIVER_EMAIL)
await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
await page.waitForTimeout(3500)
await page.goto(BASE + '/caregiver/today', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(8000)
const cards = page.locator('[data-testid^="shift-card-"]')
const n = await cards.count()
console.log(`cards: ${n}`)
for (let i = 0; i < n; i++) {
  console.log(`  [${i}] ${(await cards.nth(i).innerText()).replace(/\n+/g, ' | ').slice(0, 200)}`)
}
console.log('body excerpt:', (await page.locator('body').innerText()).slice(0, 400).replace(/\n+/g, ' | '))
await browser.close()
