// Flow 6 completion: caregiver shift documentation wizard for Phase 2 Client.
// The shift is already clocked in (previous run). Walk when->what->how->goal
// (verify objective picker shows ACTIVE objectives only, link one)->issues->
// done->submit->clock out.
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
const results = {}
function record(name, pass, detail = '') {
  results[name] = { pass, detail: String(detail).slice(0, 500) }
  console.log(`[${pass === null ? 'SKIP' : pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`)
}

const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] })
const ctx = await browser.newContext({
  viewport: { width: 1360, height: 950 },
  geolocation: { latitude: 38.5816, longitude: -121.4944 },
  permissions: ['geolocation'],
})
const page = await ctx.newPage()
const events = []
page.on('console', (m) => { if (m.type() === 'error') events.push('console.error: ' + m.text().slice(0, 400)) })
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
await page.screenshot({ path: 'qa-audit/shots/c14-wizard-open.png', fullPage: true }).catch(() => {})

// clock in if needed
const clockInBtn = page.locator('[data-testid="clock-in-button"]')
if ((await clockInBtn.count()) > 0) {
  await clockInBtn.click()
  await page.waitForTimeout(4000)
}
const wizardThere = (await page.locator('[data-testid="step-content-when"]').count()) > 0
record('wizard reached (clocked in)', wizardThere, wizardThere ? '' : 'still on clock-in screen')
if (!wizardThere) {
  console.log(await page.locator('body').innerText().catch(() => ''))
  process.exit(1)
}

const nextBtn = page.locator('[data-testid="wizard-next-button"]')
// step 'when': normalize times so end > start
if (await nextBtn.isDisabled()) {
  const startInput = page.locator('[data-testid="start-time-input"]')
  if ((await startInput.count()) === 0) await page.getByRole('button', { name: 'Change' }).first().click()
  await page.locator('[data-testid="start-time-input"]').fill('10:00')
  if ((await page.locator('[data-testid="end-time-input"]').count()) === 0) {
    await page.getByRole('button', { name: 'Change' }).nth(1).click()
  }
  await page.locator('[data-testid="end-time-input"]').fill('14:00')
  await page.waitForTimeout(800)
}
record('when step can advance', !(await nextBtn.isDisabled()), '')
await nextBtn.click()
await page.waitForTimeout(1200)

// 'what'
await page.locator('[data-testid^="service-option-"]').first().click()
await page.waitForTimeout(600)
record('what step can advance', !(await nextBtn.isDisabled()), '')
await nextBtn.click()
await page.waitForTimeout(1200)

// 'how'
await page.locator('[data-testid="narrative-textarea"]').fill('QA note: helped with meal prep and light housekeeping; client in good spirits throughout the visit.')
await page.waitForTimeout(800)
record('how step can advance', !(await nextBtn.isDisabled()), '')
await nextBtn.click()
await page.waitForTimeout(1500)

// 'goal': objective picker
const objSel = page.locator('[data-testid="objective-select"]')
if ((await objSel.count()) === 0) {
  record('objective picker appears for client with active objectives', false, 'objective-select not on goal step')
} else {
  const options = await objSel.locator('option').allInnerTexts()
  const hasActiveIpp = options.some((t) => t.includes('QA IPP Cooking'))
  const hasDiscIsp = options.some((t) => t.includes('QA ISP Mobility'))
  record('objective picker shows ACTIVE objectives only', hasActiveIpp && !hasDiscIsp, `options=[${options.join(' | ')}]`)
  await objSel.selectOption({ label: options.find((t) => t.includes('QA IPP Cooking')) })
  await page.waitForTimeout(1500)
  record('objective linked to note', (await objSel.inputValue()) !== '', '')
  await page.screenshot({ path: 'qa-audit/shots/c15-goal-step.png', fullPage: true }).catch(() => {})
}
await page.locator('[data-testid^="goal-option-"]').first().click()
await page.waitForTimeout(600)
await nextBtn.click()
await page.waitForTimeout(1200)

// 'issues'
await page.locator('[data-testid="issue-choice-no"]').click()
await page.waitForTimeout(600)
await nextBtn.click()
await page.waitForTimeout(1200)

// 'done'
await page.locator('[data-testid="confirm-checkbox"]').check()
await page.waitForTimeout(500)
record('submit enabled with objective linked', !(await nextBtn.isDisabled()), '')
await nextBtn.click()
await page.waitForTimeout(2500)

// clock out
const clockOutBtn = page.locator('[data-testid="clock-out-button"]')
if ((await clockOutBtn.count()) > 0 && !(await clockOutBtn.isDisabled())) {
  await clockOutBtn.click()
  let done = false
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000)
    const t = await page.locator('body').innerText()
    if (/clocked out|all done|great work|you'?re done|thank/i.test(t)) { done = true; break }
  }
  record('note submitted + clocked out', done, '')
} else {
  const missing = await page.locator('[data-testid="missing-checklist"]').innerText().catch(() => '')
  record('note submitted + clocked out', false, `clock-out blocked: ${missing.slice(0, 300).replace(/\n/g, ' | ')}`)
}
await page.screenshot({ path: 'qa-audit/shots/c16-caregiver-done.png', fullPage: true }).catch(() => {})
console.log('---EVENTS---')
console.log(events.join('\n') || '(none)')
await browser.close()
