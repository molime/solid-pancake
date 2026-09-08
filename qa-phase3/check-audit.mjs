import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const BASE = 'http://localhost:5180'
mkdirSync('qa-phase3/shots', { recursive: true })
function loadEnv(path) {
  const out = {}
  try {
    for (const raw of readFileSync(path, 'utf8').split('\n')) {
      const m = raw.replace(/\r$/, '').match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) out[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {}
  return out
}
const local = loadEnv('.env.local')
const e2e = loadEnv('.env.e2e')
const headers = { Authorization: `Bearer ${local.CLERK_SECRET_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
const users = await (await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(e2e.E2E_ADMIN_EMAIL)}`, { headers })).json()
const user = users.find((u) => u.email_addresses.some((x) => x.email_address.toLowerCase() === e2e.E2E_ADMIN_EMAIL.toLowerCase()))
const tok = (await (await fetch('https://api.clerk.com/v1/sign_in_tokens', { method: 'POST', headers, body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }) })).json()).token

const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--js-flags=--max-old-space-size=512'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const events = []
const page = await ctx.newPage()
page.on('console', (m) => { if (m.type() === 'error') events.push(`console.error: ${m.text().slice(0, 400)}`) })
page.on('pageerror', (e) => events.push(`pageerror: ${String(e).slice(0, 400)}`))
await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(tok)}`, { waitUntil: 'domcontentloaded' })
await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
await page.waitForTimeout(3000)
await page.goto(`${BASE}/audit`, { waitUntil: 'domcontentloaded' })
let body = ''
let resolved = false
for (let i = 0; i < 45; i++) {
  await page.waitForTimeout(1000)
  body = await page.locator('body').innerText().catch(() => '')
  if (!/Loading audit events…/.test(body)) { resolved = true; break }
}
console.log(`audit events resolved: ${resolved}`)
const eventsSection = body.split('Events').pop()?.trim().slice(0, 500) ?? ''
console.log('--- events section excerpt ---')
console.log(eventsSection.replace(/\n+/g, ' | '))
console.log('--- console events ---')
console.log(events.length ? [...new Set(events)].join('\n') : '(none)')
await page.screenshot({ path: 'qa-phase3/shots/v4_audit.png' }).catch(() => {})
writeFileSync('qa-phase3/audit-check.json', JSON.stringify({ resolved, events: [...new Set(events)], excerpt: eventsSection }, null, 2))
await browser.close()
