// Probe: what happens when the caregiver clicks "Clock in now"?
import { readFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5180'
mkdirSync('qa-audit/shots', { recursive: true })

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
const ctx = await browser.newContext({
  viewport: { width: 1360, height: 950 },
  geolocation: { latitude: 38.5816, longitude: -121.4944 },
  permissions: ['geolocation'],
})
const page = await ctx.newPage()
const events = []
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) events.push(m.type() + ': ' + m.text().slice(0, 400)) })
page.on('pageerror', (e) => events.push('pageerror: ' + String(e).slice(0, 400)))

const ticket = await clerkTicket(e2e.E2E_CAREGIVER_EMAIL)
await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
await page.waitForTimeout(3500)
await page.goto(BASE + '/caregiver/today', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(6000)

const card = page.locator('[data-testid^="shift-card-"]', { hasText: 'Phase 2 Client' }).first()
await card.click()
await page.waitForTimeout(3000)
console.log('clock-in btn count:', await page.locator('[data-testid="clock-in-button"]').count())
const btn = page.locator('[data-testid="clock-in-button"]').first()
console.log('disabled:', await btn.isDisabled().catch(() => 'n/a'))
await btn.click()
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(1000)
  const wizard = await page.locator('[data-testid^="step-content-"]').count()
  const saveErr = await page.locator('[data-testid="save-error"]').count()
  const outside = await page.locator('text=/outside/i').count()
  console.log(`t+${i + 1}s wizard=${wizard} saveErr=${saveErr} outside=${outside} btnText="${await btn.innerText().catch(() => '?')}"`)
  if (wizard > 0 || saveErr > 0) break
}
const formText = await page.locator('[data-testid="shift-clock-in-screen"], [data-testid^="step-content-"]').first().innerText().catch(() => '(none)')
console.log('---FORM---')
console.log(formText.slice(0, 1500))
const saveErrText = await page.locator('[data-testid="save-error"]').innerText().catch(() => '')
if (saveErrText) console.log('---SAVE ERROR---\n' + saveErrText)
console.log('---EVENTS---')
console.log(events.join('\n') || '(none)')
await page.screenshot({ path: 'qa-audit/shots/c13-clockin-probe.png', fullPage: true }).catch(() => {})
await browser.close()
