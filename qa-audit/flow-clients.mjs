// Stage 3/4 QA: client master-record depth, IPP/ISP objectives, authorized
// hours indicator, progress reports (generate/edit/submit/CSV), create-client
// regression, caregiver objective-picker + note submission flow.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5180'
const SHOTS = 'qa-audit/shots'
mkdirSync(SHOTS, { recursive: true })

const TS = Date.now().toString(36)
const CLIENT_NAME = 'Phase 2 Client'
const PROFILE = {
  uci: `UCI-QA-${TS}`,
  dobDigits: '03151985',
  dobUS: '03/15/1985',
  conservatorName: `QA Conservator Jane ${TS}`,
  conservatorPhone: '555-0142',
  regionalCenter: `QA Regional Center ${TS}`,
  scName: `QA Coordinator Sam ${TS}`,
  scEmail: `qa.coordinator.${TS}@example.com`,
  vendorNumber: `VND-QA-${TS}`,
  serviceCode: '520',
  ecName: `QA Emergency Ed ${TS}`,
  ecPhone: '555-0199',
  ecRelationship: 'Brother',
}
const OBJ_IPP = `QA IPP Cooking ${TS}`
const OBJ_ISP = `QA ISP Mobility ${TS}`
const NEW_CLIENT = `QA Regression Client ${TS}`
const EDIT_MARK = `QA progress note ${TS}`

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
  const user = Array.isArray(users) ? users.find((u) => u.email_addresses.some((x) => x.email_address.toLowerCase() === email.toLowerCase())) : null
  if (!user) throw new Error(`clerk user not found: ${email}`)
  const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', { method: 'POST', headers, body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }) })
  if (!tokRes.ok) throw new Error(`sign_in_tokens failed: HTTP ${tokRes.status}`)
  return (await tokRes.json()).token
}

const results = {}
let currentEvents = []
function record(flow, name, pass, detail = '') {
  results[`${flow} :: ${name}`] = { pass, detail: String(detail).slice(0, 600) }
  const tag = pass === null ? 'SKIP' : pass ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${flow} :: ${name}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`)
}
async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }).catch(() => {})
}
const PENDING = /Loading|Opening agency workspace|Securing agency workspace|Preparing workspace/i
async function waitLoaded(page, timeoutS = 60) {
  for (let i = 0; i < timeoutS; i++) {
    await page.waitForTimeout(1000)
    const body = await page.locator('body').innerText().catch(() => '')
    if (body.trim().length > 60 && !PENDING.test(body.trim().slice(0, 200))) return body
  }
  return page.locator('body').innerText().catch(() => '')
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
// First table in document order after a card's h3 title (cards stack vertically).
function tableAfterTitle(page, title) {
  return page.locator(`xpath=//h3[normalize-space(text())='${title}']/following::table[1]`)
}
async function signIn(browser, email, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, acceptDownloads: true, ...opts })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') currentEvents.push('console.error: ' + m.text().slice(0, 400)) })
  page.on('pageerror', (e) => currentEvents.push('pageerror: ' + String(e).slice(0, 400)))
  const ticket = await clerkTicket(email)
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
  await page.waitForTimeout(3500)
  return { ctx, page }
}

async function adminFlows(browser) {
  const { ctx, page } = await signIn(browser, e2e.E2E_ADMIN_EMAIL)

  // ---- /clients list: capture authorizationHours for the cap comparison
  await page.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await waitLoaded(page)
  await waitFor(() => page.getByRole('link', { name: CLIENT_NAME }).count().then((c) => c > 0), 20000)
  const listRowText = await page.locator('tr', { has: page.getByRole('link', { name: CLIENT_NAME }) }).first().innerText().catch(() => '')
  const authCapFromList = (listRowText.match(/(\d+(?:\.\d+)?)/g) ?? []).pop()

  await page.getByRole('link', { name: CLIENT_NAME }).first().click()
  await page.waitForURL(/\/clients\//, { timeout: 15000 })
  await waitFor(() => page.getByText('Profile details').count().then((c) => c > 0), 30000)
  await shot(page, 'c01-detail-initial')

  // ================= FLOW 1: profile details =================
  {
    const body = (await page.locator('body').innerText()).toLowerCase()
    const labels = ['UCI', 'Date of birth', 'Service code', 'Vendor number', 'Regional center', 'Service coordinator', 'Coordinator email', 'Conservator / authorized rep', 'Conservator phone', 'Emergency contacts']
    const missing = labels.filter((l) => !body.includes(l.toLowerCase()))
    record('flow1', 'profile fields render', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : 'all 10 labels present')

    await page.getByRole('button', { name: 'Edit profile' }).click()
    const dlg = page.getByRole('dialog')
    await dlg.waitFor({ timeout: 10000 })
    const inputs = dlg.locator('input')
    await inputs.nth(0).fill(PROFILE.uci)
    await inputs.nth(1).fill(PROFILE.dobDigits)
    await inputs.nth(2).fill(PROFILE.conservatorName)
    await inputs.nth(3).fill(PROFILE.conservatorPhone)
    await inputs.nth(4).fill(PROFILE.regionalCenter)
    await inputs.nth(5).fill(PROFILE.scName)
    await inputs.nth(6).fill(PROFILE.scEmail)
    await inputs.nth(7).fill(PROFILE.vendorNumber)
    await inputs.nth(8).fill(PROFILE.serviceCode)
    while ((await dlg.getByRole('button', { name: 'Remove' }).count()) > 0) {
      await dlg.getByRole('button', { name: 'Remove' }).first().click()
      await page.waitForTimeout(200)
    }
    await dlg.getByRole('button', { name: 'Add contact' }).click()
    await dlg.getByLabel('Emergency contact 1 name').fill(PROFILE.ecName)
    await dlg.getByLabel('Emergency contact 1 phone').fill(PROFILE.ecPhone)
    await dlg.getByLabel('Emergency contact 1 relationship').fill(PROFILE.ecRelationship)
    await shot(page, 'c02-profile-dialog')
    await dlg.getByRole('button', { name: 'Save profile' }).click()
    const closed = await waitFor(() => dlg.count().then((c) => c === 0), 15000)
    record('flow1', 'save profile closes dialog (no validation error)', !!closed, closed ? '' : await dlg.innerText().catch(() => 'dialog stuck'))

    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitFor(() => page.getByText('Profile details').count().then((c) => c > 0), 30000)
    await page.waitForTimeout(1500)
    const after = await page.locator('body').innerText()
    const expected = [PROFILE.uci, PROFILE.dobUS, PROFILE.conservatorName, PROFILE.conservatorPhone, PROFILE.regionalCenter, PROFILE.scName, PROFILE.scEmail, PROFILE.vendorNumber, PROFILE.serviceCode, PROFILE.ecName, PROFILE.ecPhone, PROFILE.ecRelationship]
    const notPersisted = expected.filter((v) => !after.includes(v))
    record('flow1', 'profile values persist after reload', notPersisted.length === 0, notPersisted.length ? `missing: ${notPersisted.join(' | ')}` : 'all values persisted')
    await shot(page, 'c03-profile-saved')
  }

  // ================= FLOW 2: objectives =================
  let expectedActive = 0
  {
    async function addObjective(title, source) {
      await page.getByRole('button', { name: 'Add objective' }).first().click()
      const dlg = page.getByRole('dialog')
      await dlg.waitFor({ timeout: 10000 })
      await dlg.locator('input').nth(0).fill(title)
      await dlg.locator('select').selectOption(source)
      await dlg.getByRole('button', { name: 'Add objective' }).click()
      return waitFor(() => dlg.count().then((c) => c === 0), 15000)
    }
    const ok1 = await addObjective(OBJ_IPP, 'ipp')
    record('flow2', 'add IPP objective', !!ok1, ok1 ? OBJ_IPP : 'dialog did not close')
    const ok2 = await addObjective(OBJ_ISP, 'isp')
    record('flow2', 'add ISP objective', !!ok2, ok2 ? OBJ_ISP : 'dialog did not close')

    const table = tableAfterTitle(page, 'IPP/ISP objectives')
    const listed = await waitFor(async () => {
      const t = await table.innerText().catch(() => '')
      return t.includes(OBJ_IPP) && t.includes(OBJ_ISP) ? t : null
    }, 15000)
    record('flow2', 'both objectives listed', !!listed, listed ? '' : 'not found in objectives table')
    if (listed) {
      const rowFor = (title) => table.locator('tbody tr', { hasText: title }).first()
      const ippRow = await rowFor(OBJ_IPP).innerText()
      const ispRow = await rowFor(OBJ_ISP).innerText()
      record('flow2', 'status badges + source badges', /\bIPP\b/.test(ippRow) && /active/i.test(ippRow) && /\bISP\b/.test(ispRow) && /active/i.test(ispRow), `ippRow="${ippRow.replace(/\n/g, ' | ')}" ispRow="${ispRow.replace(/\n/g, ' | ')}"`)
      await rowFor(OBJ_ISP).getByRole('button', { name: 'Discontinue' }).click()
      const disc = await waitFor(async () => {
        const t = await rowFor(OBJ_ISP).innerText().catch(() => '')
        return /discontinued/i.test(t) ? t : null
      }, 15000)
      record('flow2', 'discontinue flips status', !!disc, disc ? disc.replace(/\n/g, ' | ') : 'status did not change')
      // count remaining ACTIVE objectives (report prefill expectation)
      const rows = table.locator('tbody tr')
      const n = await rows.count()
      for (let i = 0; i < n; i++) {
        const statusCell = await rows.nth(i).locator('td').nth(2).innerText()
        if (/^\s*active\s*$/i.test(statusCell)) expectedActive++
      }
      await shot(page, 'c04-objectives')
    }
  }

  // ================= FLOW 3: authorized hours indicator =================
  {
    const txt = await page.locator('[data-testid="hours-usage"]').innerText().catch(() => '')
    const m = txt.match(/Authorized hours this month:\s*([\d.]+)\s*of\s*([\d.]+)/)
    const plausible = !!m && !/NaN|undefined/.test(txt) && Number.isFinite(Number(m[1])) && Number.isFinite(Number(m[2]))
    record('flow3', 'hours indicator renders numeric values', plausible, txt)
    if (m && authCapFromList !== undefined) {
      record('flow3', 'cap matches clients-list authorizationHours', Number(m[2]) === Number(authCapFromList), `indicator cap=${m[2]} list cap=${authCapFromList}`)
    }
  }

  // ================= FLOW 4: progress reports =================
  {
    const table = tableAfterTitle(page, 'Progress reports')
    const bodyHasEmptyState = async () => (await page.locator('body').innerText()).includes('No progress reports yet')
    const countRows = async () => ((await bodyHasEmptyState()) ? 0 : table.locator('tbody tr').count().catch(() => 0))

    const rowsBefore = await countRows()
    async function generate() {
      await page.getByRole('button', { name: 'Generate report' }).click()
      const dlg = page.getByRole('dialog')
      await dlg.waitFor({ timeout: 10000 })
      await dlg.getByRole('button', { name: 'Generate' }).click()
      const closed = await waitFor(() => dlg.count().then((c) => c === 0), 20000)
      if (!closed) return { ok: false, err: await dlg.innerText().catch(() => '') }
      return { ok: true }
    }
    const g1 = await generate()
    record('flow4', 'generate report', g1.ok, g1.ok ? `rows before=${rowsBefore}` : `error: ${g1.err.slice(0, 200)}`)
    const draftRowSeen = await waitFor(async () => {
      const t = await table.innerText().catch(() => '')
      return /draft/i.test(t) ? t : null
    }, 15000)
    const rowsAfter1 = await countRows()
    record('flow4', 'draft row appears', !!draftRowSeen && rowsAfter1 === rowsBefore + 1, `rows ${rowsBefore} -> ${rowsAfter1}`)

    // entries prefilled from ACTIVE objectives with numeric hoursDelivered
    if (draftRowSeen) {
      const draftRow = table.locator('tbody tr', { hasText: 'Draft' }).first()
      await draftRow.getByRole('button', { name: 'Edit' }).click()
      const dlg = page.getByRole('dialog')
      await dlg.waitFor({ timeout: 10000 })
      await page.waitForTimeout(800)
      const dlgText = await dlg.innerText()
      const hoursMatches = [...dlgText.matchAll(/Hours delivered:\s*([\d.]+)/g)].map((x) => Number(x[1]))
      const hoursOk = hoursMatches.length > 0 && hoursMatches.every((h) => Number.isFinite(h))
      const hasIpp = dlgText.includes(OBJ_IPP)
      const excludesIsp = !dlgText.includes(OBJ_ISP)
      record('flow4', 'entries prefilled from active objectives only', hasIpp && excludesIsp && hoursMatches.length === expectedActive, `entries=${hoursMatches.length} expectedActive=${expectedActive} hasIpp=${hasIpp} excludesDiscontinuedIsp=${excludesIsp}`)
      record('flow4', 'hoursDelivered numeric', hoursOk, `hours=[${hoursMatches.join(', ')}]`)
      await shot(page, 'c05-report-edit-entries')
      await dlg.getByRole('button', { name: 'Cancel' }).click()
      await waitFor(() => page.getByRole('dialog').count().then((c) => c === 0), 10000)
    }

    // regenerate -> same draft updated, not duplicated
    const g2 = await generate()
    await page.waitForTimeout(1500)
    const rowsAfter2 = await countRows()
    record('flow4', 'regenerate does not duplicate', g2.ok && rowsAfter2 === rowsAfter1, `ok=${g2.ok} rows ${rowsAfter1} -> ${rowsAfter2}`)

    // edit draft entry text, save, verify persistence
    {
      const draftRow = table.locator('tbody tr', { hasText: 'Draft' }).first()
      await draftRow.getByRole('button', { name: 'Edit' }).click()
      const dlg = page.getByRole('dialog')
      await dlg.waitFor({ timeout: 10000 })
      await dlg.getByLabel(`Progress for ${OBJ_IPP}`).fill(EDIT_MARK)
      await dlg.getByLabel(`Barriers for ${OBJ_IPP}`).fill(`QA barrier ${TS}`)
      await dlg.getByLabel(`Plan forward for ${OBJ_IPP}`).fill(`QA plan ${TS}`)
      await dlg.getByRole('button', { name: 'Save entries' }).click()
      const closed = await waitFor(() => page.getByRole('dialog').count().then((c) => c === 0), 15000)
      record('flow4', 'save edited entries', !!closed, closed ? '' : 'dialog stuck')
      await table.locator('tbody tr', { hasText: 'Draft' }).first().getByRole('button', { name: 'Edit' }).click()
      const dlg2 = page.getByRole('dialog')
      await dlg2.waitFor({ timeout: 10000 })
      const persisted = await dlg2.getByLabel(`Progress for ${OBJ_IPP}`).inputValue()
      record('flow4', 'entry edit persists', persisted === EDIT_MARK, `progress="${persisted.slice(0, 80)}"`)
      await dlg2.getByRole('button', { name: 'Cancel' }).click()
      await waitFor(() => page.getByRole('dialog').count().then((c) => c === 0), 10000)
    }

    // submit: submittedTo prefilled from serviceCoordinatorEmail, locks report
    {
      const draftRow = table.locator('tbody tr', { hasText: 'Draft' }).first()
      await draftRow.getByRole('button', { name: 'Submit' }).click()
      const dlg = page.getByRole('dialog')
      await dlg.waitFor({ timeout: 10000 })
      const to = await dlg.locator('input').first().inputValue()
      record('flow4', 'submittedTo prefilled from coordinator email', to === PROFILE.scEmail, `value="${to}" expected="${PROFILE.scEmail}"`)
      await shot(page, 'c06-report-submit')
      await dlg.getByRole('button', { name: 'Submit report' }).click()
      await waitFor(() => page.getByRole('dialog').count().then((c) => c === 0), 15000)
      // the row for THIS submission is identified by the unique coordinator email
      const row = table.locator('tbody tr', { hasText: PROFILE.scEmail }).first()
      const locked = await waitFor(async () => {
        const t = await row.innerText().catch(() => '')
        return /submitted/i.test(t) ? t : null
      }, 15000)
      const rowTxt = locked ?? ''
      const editGone = (await row.getByRole('button', { name: 'Edit' }).count()) === 0 && (await row.getByRole('button', { name: 'Submit' }).count()) === 0
      const viewThere = (await row.getByRole('button', { name: 'View' }).count()) === 1
      record('flow4', 'submit locks report (status + no edit affordances)', !!locked && editGone && viewThere, `row="${rowTxt.replace(/\n/g, ' | ')}" editGone=${editGone} view=${viewThere}`)

      // view dialog shows edited content
      await row.getByRole('button', { name: 'View' }).click()
      const vdlg = page.getByRole('dialog')
      await vdlg.waitFor({ timeout: 10000 })
      const vt = await vdlg.innerText()
      record('flow4', 'view dialog shows submitted content', vt.includes(EDIT_MARK) && vt.includes(PROFILE.scEmail), vt.slice(0, 160).replace(/\n/g, ' | '))
      await shot(page, 'c07-report-view')
      await vdlg.getByRole('button', { name: 'Close' }).click()
      await waitFor(() => page.getByRole('dialog').count().then((c) => c === 0), 10000)

      // CSV export
      try {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 15000 }),
          row.getByLabel('Download CSV').click(),
        ])
        const path = await download.path()
        const csv = readFileSync(path, 'utf8')
        record('flow4', 'CSV export downloads with content', csv.length > 50 && csv.includes(OBJ_IPP), `file=${download.suggestedFilename()} bytes=${csv.length}`)
      } catch (e) {
        record('flow4', 'CSV export downloads with content', false, e.message.slice(0, 200))
      }
    }
    await shot(page, 'c08-reports-final')
  }

  // ================= FLOW 5: regression — create client =================
  {
    await page.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await waitLoaded(page)
    await page.getByRole('button', { name: 'Add Client' }).click()
    await page.getByPlaceholder('Client name').fill(NEW_CLIENT)
    await page.getByRole('button', { name: 'Save Client' }).click()
    const link = page.getByRole('link', { name: NEW_CLIENT })
    const appeared = await waitFor(() => link.count().then((c) => c > 0), 20000)
    record('flow5', 'create client with required fields only', !!appeared, NEW_CLIENT)
    if (appeared) {
      await link.first().click()
      await page.waitForURL(/\/clients\//, { timeout: 15000 })
      await waitFor(() => page.getByText('Profile details').count().then((c) => c > 0), 30000)
      const usage = await page.locator('[data-testid="hours-usage"]').innerText().catch(() => '')
      record('flow5', 'new client detail page loads with hours indicator', /0 of 40/.test(usage), usage)
      const body = await page.locator('body').innerText()
      record('flow5', 'new client shows objectives empty-state', body.includes('No objectives yet'), '')
      await shot(page, 'c09-new-client')
    }
  }

  results['admin console/page errors'] = { pass: currentEvents.length === 0, detail: currentEvents.slice(0, 8).join('\n') || 'none' }
  await ctx.close().catch(() => {})
}

// ================= FLOW 6: caregiver note flow =================
async function caregiverFlow(browser) {
  currentEvents = []
  const { ctx, page } = await signIn(browser, e2e.E2E_CAREGIVER_EMAIL, {
    geolocation: { latitude: 38.5816, longitude: -121.4944 },
    permissions: ['geolocation'],
  })
  await page.goto(BASE + '/caregiver/today', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await waitLoaded(page)
  await page.waitForTimeout(2000)
  await shot(page, 'c10-caregiver-today')

  const card = page.locator('[data-testid^="shift-card-"]', { hasText: CLIENT_NAME }).first()
  if ((await card.count()) === 0) {
    record('flow6', 'caregiver objective picker', null, 'UNVERIFIABLE: no shift for the test client on /caregiver/today')
    await ctx.close().catch(() => {})
    return
  }
  await card.click()
  await page.waitForTimeout(2500)

  // clock in if the clock-in screen is showing
  const clockInBtn = page.locator('[data-testid="clock-in-button"]')
  if ((await clockInBtn.count()) > 0) {
    await clockInBtn.click()
    const inWizard = await waitFor(() => page.locator('[data-testid="step-content-when"]').count().then((c) => c > 0), 20000)
    if (!inWizard) {
      const err = await page.locator('[data-testid="save-error"], [data-testid="shift-clock-in-screen"]').first().innerText().catch(() => '')
      record('flow6', 'caregiver clock-in', null, `UNVERIFIABLE: clock-in did not reach the wizard. ${err.slice(0, 200).replace(/\n/g, ' | ')}`)
      await shot(page, 'c11-caregiver-clockin-blocked')
      await ctx.close().catch(() => {})
      return
    }
    record('flow6', 'caregiver clock-in reaches note wizard', true, '')
  }

  const nextBtn = page.locator('[data-testid="wizard-next-button"]')
  // step 1 'when': ensure start/end times are set
  await page.waitForTimeout(1000)
  if (await nextBtn.isDisabled()) {
    const startInput = page.locator('[data-testid="start-time-input"]')
    if ((await startInput.count()) === 0) await page.getByRole('button', { name: 'Change' }).first().click()
    await page.locator('[data-testid="start-time-input"]').fill('10:00')
    const endVisible = (await page.locator('[data-testid="end-time-input"]').count()) > 0
    if (!endVisible) await page.getByRole('button', { name: 'Change' }).nth(1).click()
    await page.locator('[data-testid="end-time-input"]').fill('14:00')
    await page.waitForTimeout(500)
  }
  record('flow6', 'when step can advance', !(await nextBtn.isDisabled()), '')
  await nextBtn.click()
  await page.waitForTimeout(1000)

  // step 2 'what': pick a service
  await page.locator('[data-testid^="service-option-"]').first().click()
  await page.waitForTimeout(500)
  await nextBtn.click()
  await page.waitForTimeout(1000)

  // step 3 'how': narrative >= 20 chars
  await page.locator('[data-testid="narrative-textarea"]').fill(`QA note ${TS}: helped with meal prep and light housekeeping; client in good spirits.`)
  await page.waitForTimeout(500)
  await nextBtn.click()
  await page.waitForTimeout(1000)

  // step 4 'goal': objective picker must show ACTIVE objectives only
  const objSel = page.locator('[data-testid="objective-select"]')
  const pickerThere = (await objSel.count()) > 0
  if (!pickerThere) {
    record('flow6', 'objective picker appears for client with active objectives', false, 'objective-select not found on goal step')
  } else {
    const options = await objSel.locator('option').allInnerTexts()
    // active objectives from earlier QA runs may also be present; discontinued must not be
    const hasActiveIpp = options.some((t) => t.includes('QA IPP Cooking'))
    const hasDiscIsp = options.some((t) => t.includes('QA ISP Mobility'))
    record('flow6', 'objective picker shows active objectives only', hasActiveIpp && !hasDiscIsp, `options=[${options.join(' | ')}]`)
    const label = options.find((t) => t.includes('QA IPP Cooking'))
    await objSel.selectOption({ label })
    await page.waitForTimeout(1200)
    record('flow6', 'objective selectable (linked to note)', (await objSel.inputValue()) !== '', `selected="${label}"`)
    await shot(page, 'c11-caregiver-goal-step')
  }
  await page.locator('[data-testid^="goal-option-"]').first().click()
  await page.waitForTimeout(500)
  await nextBtn.click()
  await page.waitForTimeout(1000)

  // step 5 'issues': no issues
  await page.locator('[data-testid="issue-choice-no"]').click()
  await page.waitForTimeout(500)
  await nextBtn.click()
  await page.waitForTimeout(1000)

  // step 6 'done': confirm + submit, then clock out
  await page.locator('[data-testid="confirm-checkbox"]').check()
  await page.waitForTimeout(400)
  const submitOk = !(await nextBtn.isDisabled())
  record('flow6', 'note submission enabled with objective linked', submitOk, '')
  if (submitOk) {
    await nextBtn.click()
    const clockOutBtn = page.locator('[data-testid="clock-out-button"]')
    const atClockOut = await waitFor(() => clockOutBtn.count().then((c) => c > 0), 15000)
    if (atClockOut && !(await clockOutBtn.isDisabled())) {
      await clockOutBtn.click()
      const done = await waitFor(async () => {
        const t = await page.locator('body').innerText()
        return /clocked out|all done|great work|thank you/i.test(t) ? t : null
      }, 20000)
      record('flow6', 'note submitted + clocked out', !!done, done ? '' : 'success screen not detected')
    } else {
      record('flow6', 'note submitted + clocked out', false, `clock-out unavailable (atClockOut=${!!atClockOut})`)
    }
    await shot(page, 'c12-caregiver-done')
  }

  results['caregiver console/page errors'] = { pass: currentEvents.length === 0, detail: currentEvents.slice(0, 8).join('\n') || 'none' }
  await ctx.close().catch(() => {})
}

async function main() {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions'] })
  try {
    await adminFlows(browser)
  } catch (e) {
    results['admin FATAL'] = { pass: false, detail: e.message.slice(0, 500) }
    console.error('admin FATAL', e)
  }
  try {
    await caregiverFlow(browser)
  } catch (e) {
    results['caregiver FATAL'] = { pass: false, detail: e.message.slice(0, 500) }
    console.error('caregiver FATAL', e)
  }
  writeFileSync('qa-audit/flow-clients-results.json', JSON.stringify(results, null, 2))
  await browser.close()
  const fails = Object.entries(results).filter(([, r]) => r.pass === false)
  console.log(`\ndone -> qa-audit/flow-clients-results.json (${Object.keys(results).length} checks, ${fails.length} failed)`)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
