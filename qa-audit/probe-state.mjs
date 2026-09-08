// Bulletproof probe: capture what happens to the clock-in button / form.
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

const events = []
async function main() {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] })
  const ctx = await browser.newContext({
    viewport: { width: 1360, height: 950 },
    geolocation: { latitude: 38.5816, longitude: -121.4944 },
    permissions: ['geolocation'],
  })
  const page = await ctx.newPage()
  page.on('console', (m) => events.push(m.type() + ': ' + m.text().slice(0, 500)))
  page.on('pageerror', (e) => events.push('PAGEERROR: ' + String(e).slice(0, 800)))

  const ticket = await clerkTicket(e2e.E2E_CAREGIVER_EMAIL)
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
  await page.waitForTimeout(3500)
  await page.goto(BASE + '/caregiver/today', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(7000)

  const card = page.locator('[data-testid^="shift-card-"]', { hasText: 'Phase 2 Client' }).first()
  await card.click()
  console.log('clicked card; watching...')
  let clicked = false
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(2000)
    const probe = async (sel) => page.locator(sel).count().catch(() => -1)
    const clockIn = await probe('[data-testid="clock-in-button"]')
    const wizard = await probe('[data-testid^="step-content-"]')
    const loading = await probe('text=Loading shift details')
    const saveErr = await probe('[data-testid="save-error"]')
    console.log(`t+${(i + 1) * 2}s clockIn=${clockIn} wizardSteps=${wizard} loading=${loading} saveErr=${saveErr}`)
    if (saveErr > 0) console.log('  saveError text:', (await page.locator('[data-testid="save-error"]').innerText().catch(() => '')).slice(0, 300))
    if (clockIn > 0 && !clicked) {
      clicked = true
      try {
        await page.locator('[data-testid="clock-in-button"]').first().click({ timeout: 5000 })
        console.log('  clicked clock-in')
      } catch (e) {
        console.log('  click failed:', e.message.split('\n')[0])
      }
    }
    if (wizard > 0) { console.log('  WIZARD REACHED'); break }
  }
  await page.screenshot({ path: 'qa-audit/shots/c17-probe-final.png', fullPage: true }).catch(() => {})
  await browser.close()
}

main().catch((e) => console.error('FATAL', e.message)).finally(() => {
  console.log('---EVENTS---')
  console.log(events.join('\n') || '(none)')
  process.exit(0)
})
