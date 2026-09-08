// Flow 6 proper: admin schedules a past-due shift for the E2E caregiver with
// Phase 2 Client (who has ACTIVE + DISCONTINUED QA objectives), then the
// caregiver clocks in, walks the documentation wizard, verifies the objective
// picker shows ACTIVE objectives only, links one, submits the note, clocks out.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
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

async function clerkUser(email) {
  const headers = { Authorization: `Bearer ${local.CLERK_SECRET_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
  const res = await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`, { headers })
  const users = await res.json()
  return users.find((u) => u.email_addresses.some((x) => x.email_address.toLowerCase() === email.toLowerCase()))
}

async function clerkTicket(email) {
  const user = await clerkUser(email)
  const headers = { Authorization: `Bearer ${local.CLERK_SECRET_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
  const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', { method: 'POST', headers, body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }) })
  return (await tokRes.json()).token
}

const results = {}
const events = []
function record(name, pass, detail = '') {
  results[name] = { pass, detail: String(detail).slice(0, 500) }
  console.log(`[${pass === null ? 'SKIP' : pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`)
}
async function waitFor(fn, timeoutMs = 15000, interval = 500) {
  const start = Date.now()
  for (;;) {
    const v = await fn().catch(() => null)
    if (v) return v
    if (Date.now() - start > timeoutMs) return null
    await new Promise((r) => setTimeout(r, interval))
  }
}
async function signIn(browser, email, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, ...opts })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) events.push(m.type() + ': ' + m.text().slice(0, 300)) })
  page.on('pageerror', (e) => events.push('pageerror: ' + String(e).slice(0, 300)))
  const ticket = await clerkTicket(email)
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
  await page.waitForTimeout(3500)
  return { ctx, page }
}

const now = new Date()
const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

async function main() {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] })

  // ---- 1) admin schedules a shift 06:00-10:00 UTC today (shows as 12:00 AM
  // local, IN PROGRESS because the start is already due). Skip if one exists.
  {
    const { ctx, page } = await signIn(browser, e2e.E2E_CAREGIVER_EMAIL)
    await page.goto(BASE + '/caregiver/today', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(7000)
    const existing = await page.locator('[data-testid^="shift-card-"]', { hasText: 'Phase 2 Client' }).filter({ hasText: '12:00 AM' }).count()
    await ctx.close().catch(() => {})
    if (existing > 0) {
      record('setup: past-due shift for caregiver', true, 'already present')
    } else {
      const { ctx: actx, page: apage } = await signIn(browser, e2e.E2E_ADMIN_EMAIL)
      await apage.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await waitFor(() => apage.getByRole('link', { name: 'Phase 2 Client' }).count().then((c) => c > 0), 30000)
      const row = apage.locator('tr', { has: apage.getByRole('link', { name: 'Phase 2 Client' }) }).first()
      await row.getByRole('button', { name: 'Schedule' }).click()
      const dlg = apage.getByRole('dialog')
      await dlg.waitFor({ timeout: 10000 })
      const caregiver = await clerkUser(e2e.E2E_CAREGIVER_EMAIL)
      await dlg.locator('select').selectOption(caregiver.id)
      await dlg.locator('input[type="date"]').fill(todayLocal)
      await dlg.locator('input[type="time"]').nth(0).fill('06:00')
      await dlg.locator('input[type="time"]').nth(1).fill('10:00')
      const rate = dlg.locator('input[type="number"]')
      if ((await rate.inputValue()) === '') await rate.fill('25')
      await dlg.getByRole('button', { name: 'Schedule Shift' }).click()
      const closed = await waitFor(() => dlg.count().then((c) => c === 0), 15000)
      record('setup: admin scheduled past-due shift for caregiver', !!closed, closed ? `${todayLocal} 06:00-10:00` : await dlg.innerText().catch(() => 'dialog stuck'))
      await actx.close().catch(() => {})
      if (!closed) throw new Error('scheduling failed')
    }
  }

  // ---- 2) caregiver clocks in and completes documentation
  {
    const { ctx, page } = await signIn(browser, e2e.E2E_CAREGIVER_EMAIL, {
      geolocation: { latitude: 38.5816, longitude: -121.4944 },
      permissions: ['geolocation'],
    })
    await page.goto(BASE + '/caregiver/today', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(7000)
    const card = page.locator('[data-testid^="shift-card-"]', { hasText: 'Phase 2 Client' }).filter({ hasText: '12:00 AM' }).first()
    const found = (await card.count()) > 0
    record('setup: new shift appears on caregiver today', found, '')
    if (!found) throw new Error('shift card not found')
    await card.click()
    await page.waitForTimeout(3000)

    const clockInBtn = page.locator('[data-testid="clock-in-button"]')
    if ((await clockInBtn.count()) > 0) {
      await clockInBtn.first().click()
    }
    const inWizard = await waitFor(() => page.locator('[data-testid="step-content-when"]').count().then((c) => c > 0), 25000)
    record('caregiver clock-in reaches wizard', !!inWizard, inWizard ? '' : 'still on clock-in screen')
    if (!inWizard) {
      await page.screenshot({ path: 'qa-audit/shots/c18-clockin-blocked.png', fullPage: true }).catch(() => {})
      throw new Error('clock-in blocked')
    }

    const nextBtn = page.locator('[data-testid="wizard-next-button"]')
    await page.waitForTimeout(1000)
    if (await nextBtn.isDisabled()) {
      if ((await page.locator('[data-testid="start-time-input"]').count()) === 0) {
        await page.getByRole('button', { name: 'Change' }).first().click()
      }
      await page.locator('[data-testid="start-time-input"]').fill('06:00')
      if ((await page.locator('[data-testid="end-time-input"]').count()) === 0) {
        await page.getByRole('button', { name: 'Change' }).first().click()
      }
      await page.locator('[data-testid="end-time-input"]').fill('10:00')
      await page.waitForTimeout(800)
    }
    record('when step can advance', !(await nextBtn.isDisabled()), '')
    await nextBtn.click()
    await page.waitForTimeout(1200)

    // 'what': pick a service — but the note autosaves between runs, so a
    // service may already be selected; only click an unselected one.
    {
      const opts = page.locator('[data-testid^="service-option-"]')
      const nOpts = await opts.count()
      let anySelected = false
      for (let i = 0; i < nOpts; i++) {
        if ((await opts.nth(i).innerText()).includes('✓')) { anySelected = true; break }
      }
      if (!anySelected && nOpts > 0) await opts.first().click()
      await page.waitForTimeout(600)
      const whatOk = await waitFor(() => nextBtn.isEnabled().then((e) => (e ? true : null)), 6000)
      record('what step can advance', !!whatOk, '')
    }
    await nextBtn.click()
    await page.waitForTimeout(1200)

    await page.locator('[data-testid="narrative-textarea"]').fill('QA note: helped with meal prep and light housekeeping; client in good spirits throughout the visit.')
    await page.waitForTimeout(800)
    await nextBtn.click()
    await page.waitForTimeout(1500)

    const objSel = page.locator('[data-testid="objective-select"]')
    if ((await objSel.count()) === 0) {
      record('objective picker appears for client with active objectives', false, 'objective-select missing on goal step')
    } else {
      const options = await objSel.locator('option').allInnerTexts()
      const actives = options.filter((t) => t.includes('QA IPP Cooking'))
      const discontinued = options.filter((t) => t.includes('QA ISP Mobility'))
      record('objective picker shows ACTIVE objectives only', actives.length > 0 && discontinued.length === 0, `options=[${options.join(' | ')}]`)
      await objSel.selectOption({ label: actives[0] })
      await page.waitForTimeout(1500)
      record('objective linked to note', (await objSel.inputValue()) !== '', `selected="${actives[0]}"`)
      await page.screenshot({ path: 'qa-audit/shots/c19-goal-step.png', fullPage: true }).catch(() => {})
    }
    // goal: select a goal unless one is already selected (autosaved note)
    {
      const opts = page.locator('[data-testid^="goal-option-"]')
      const nOpts = await opts.count()
      let anySelected = false
      for (let i = 0; i < nOpts; i++) {
        if ((await opts.nth(i).innerText()).includes('✓')) { anySelected = true; break }
      }
      if (!anySelected && nOpts > 0) await opts.first().click()
      await page.waitForTimeout(600)
    }
    let goalOk = await waitFor(() => nextBtn.isEnabled().then((e) => (e ? true : null)), 6000)
    if (!goalOk) {
      // diagnostics: which step are we on, what do the goal options show?
      const step = await page.locator('[data-testid^="step-content-"]').first().getAttribute('data-testid').catch(() => '?')
      const goals = await page.locator('[data-testid^="goal-option-"]').allInnerTexts().catch(() => [])
      console.log(`  goal-step diag: step=${step} goals=${JSON.stringify(goals.map((g) => g.replace(/\n/g, ' | ')))}`)
      // click an unselected goal (no ✓) if any
      const opts = page.locator('[data-testid^="goal-option-"]')
      const nOpts = await opts.count()
      for (let i = 0; i < nOpts; i++) {
        const t = await opts.nth(i).innerText()
        if (!t.includes('✓')) { await opts.nth(i).click(); break }
      }
      goalOk = await waitFor(() => nextBtn.isEnabled().then((e) => (e ? true : null)), 6000)
    }
    record('goal step can advance', !!goalOk, '')
    await nextBtn.click()
    await page.waitForTimeout(1200)

    await page.locator('[data-testid="issue-choice-no"]').click()
    await page.waitForTimeout(600)
    // complete any pending shift tasks (they block advancing); upload proof
    // where required
    const taskBoxes = page.locator('[data-testid^="task-complete-checkbox-"]')
    const nTasks = await taskBoxes.count()
    for (let i = 0; i < nTasks; i++) {
      if (!(await taskBoxes.nth(i).isChecked().catch(() => false))) {
        await taskBoxes.nth(i).check().catch(() => taskBoxes.nth(i).click())
      }
    }
    const proofInputs = page.locator('[data-testid^="task-proof-input-"]')
    if ((await proofInputs.count()) > 0) {
      writeFileSync('qa-audit/qa-proof.txt', `QA proof upload ${Date.now()}\n`)
      await proofInputs.first().setInputFiles('qa-audit/qa-proof.txt')
      await page.waitForTimeout(4000)
    }
    if (nTasks > 0) await page.waitForTimeout(800)
    const issuesOk = await waitFor(() => nextBtn.isEnabled().then((e) => (e ? true : null)), 8000)
    if (!issuesOk) {
      const step = await page.locator('[data-testid^="step-content-"]').first().getAttribute('data-testid').catch(() => '?')
      const txt = await page.locator('[data-testid^="step-content-"]').first().innerText().catch(() => '')
      console.log(`  issues-step diag: step=${step} tasks=${nTasks} content=${txt.slice(0, 300).replace(/\n/g, ' | ')}`)
    }
    record('issues step can advance', !!issuesOk, `tasks=${nTasks}`)
    await nextBtn.click()
    await page.waitForTimeout(1200)

    await page.locator('[data-testid="confirm-checkbox"]').check()
    await page.waitForTimeout(500)
    const submitOk = !(await nextBtn.isDisabled())
    record('note submission enabled with objective linked', submitOk, '')
    if (submitOk) {
      await nextBtn.click()
      const clockOutBtn = page.locator('[data-testid="clock-out-button"]')
      const atClockOut = await waitFor(() => clockOutBtn.count().then((c) => c > 0), 15000)
      if (atClockOut && !(await clockOutBtn.isDisabled().catch(() => true))) {
        await clockOutBtn.click()
        const done = await waitFor(async () => {
          const t = await page.locator('body').innerText()
          return /clocked out|all done|great work|you're done|submitted/i.test(t) ? t : null
        }, 20000)
        record('note submitted + clocked out', !!done, done ? '' : 'success screen not detected')
      } else {
        const missing = await page.locator('[data-testid="missing-checklist"]').innerText().catch(() => '')
        record('note submitted + clocked out', false, `clock-out unavailable: ${missing.slice(0, 200).replace(/\n/g, ' | ')}`)
      }
      await page.screenshot({ path: 'qa-audit/shots/c20-caregiver-done.png', fullPage: true }).catch(() => {})
    }
    await ctx.close().catch(() => {})
  }

  await browser.close()
}

main()
  .catch((e) => console.error('FATAL', e.message))
  .finally(() => {
    console.log('---EVENTS---')
    console.log(events.filter((e) => !e.startsWith('warning')).join('\n') || '(none)')
    writeFileSync('qa-audit/flow6-results.json', JSON.stringify(results, null, 2))
    process.exit(0)
  })
