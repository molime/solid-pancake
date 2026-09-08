// SIR module interactive e2e QA.
// Flows: admin files SIR -> detail transitions -> overdue incident -> CSV export
// -> caregiver entry point + role guards -> audit trail events.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5180'
const SHOTS = 'qa-audit/shots'
mkdirSync(SHOTS, { recursive: true })

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

const results = []
function record(flow, name, pass, evidence) {
  results.push({ flow, name, pass, evidence: String(evidence).slice(0, 500) })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${flow} :: ${name} — ${String(evidence).slice(0, 220)}`)
}

async function clerkTicket(email) {
  const headers = { Authorization: `Bearer ${local.CLERK_SECRET_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
  const res = await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`, { headers })
  const users = await res.json()
  const user = Array.isArray(users) ? users.find((u) => u.email_addresses.some((x) => x.email_address.toLowerCase() === email.toLowerCase())) : null
  if (!user) throw new Error(`clerk user not found: ${email}`)
  const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST', headers,
    body: JSON.stringify({ user_id: user.id, expires_in_seconds: 900 }),
  })
  if (!tokRes.ok) throw new Error(`sign_in_tokens failed: HTTP ${tokRes.status}`)
  return (await tokRes.json()).token
}

async function signIn(browser, email, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, acceptDownloads: true })
  const page = await ctx.newPage()
  page.on('pageerror', (err) => record('runtime', `pageerror (${tag})`, false, err.message))
  const ticket = await clerkTicket(email)
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
  await page.waitForTimeout(3000)
  // No-org users (caregiver) may land on the agency picker first.
  if (page.url().includes('/select-agency')) {
    await page.getByText(/Diego/i).first().click().catch(() => {})
    await page.waitForTimeout(5000)
  }
  console.log(`[auth:${tag}] landed on ${page.url()}`)
  return { ctx, page }
}

const SHELL_PENDING = /Opening agency workspace|Securing agency workspace|Preparing workspace|Loading [a-z- ]*…/i

async function waitForContent(page, re, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000)
    const body = await page.locator('body').innerText().catch(() => '')
    if (SHELL_PENDING.test(body)) continue
    if (re.test(body)) return body
  }
  throw new Error(`waitForContent timed out waiting for ${re}`)
}

function dateParts(offsetMs) {
  const d = new Date(Date.now() - offsetMs)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return { date: `${mm}/${dd}/${d.getFullYear()}`, time: `${hh}:${mi}` }
}

function fieldControl(page, label, selector) {
  return page.locator(`xpath=//label[contains(normalize-space(),"${label}")]/following-sibling::div//${selector}`).first()
}

async function fillIncidentForm(page, { occurred, learned, location, description, actions, checkAgency = true }) {
  await waitForContent(page, /File a special incident report/i)
  // wait for client options to load
  const clientSelect = fieldControl(page, 'Client', 'select')
  await page.waitForFunction(
    () => {
      const labels = Array.from(document.querySelectorAll('label'))
      const l = labels.find((x) => x.textContent.includes('Client'))
      const sel = l?.parentElement?.querySelector('select')
      return sel && sel.options.length > 1
    },
    { timeout: 60000 },
  )
  await clientSelect.selectOption({ index: 1 })
  const clientName = await clientSelect.locator('option:checked').innerText()
  await fieldControl(page, 'Category', 'select').selectOption('medication_error')
  await fieldControl(page, 'Date of incident', 'input').fill(occurred.date)
  await fieldControl(page, 'Time of incident', 'input').fill(occurred.time)
  await fieldControl(page, 'Date learned', 'input').fill(learned.date)
  await fieldControl(page, 'Time learned', 'input').fill(learned.time)
  await fieldControl(page, 'Location', 'input').fill(location)
  await page.locator('textarea[placeholder*="What happened"]').fill(description)
  await page.locator('textarea[placeholder*="Immediate actions"]').fill(actions)
  if (checkAgency) {
    await page.locator('label', { hasText: 'Adult Protective Services' }).first().click()
  }
  return clientName.trim()
}

async function main() {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] })

  // ---------- Flows 1+2: admin files a complete SIR, then drives transitions ----------
  const admin = await signIn(browser, e2e.E2E_ADMIN_EMAIL, 'admin')
  const page = admin.page

  await page.goto(BASE + '/incidents/new', { waitUntil: 'domcontentloaded' })
  const recent = dateParts(60 * 60 * 1000) // 1h ago -> inside both SLA windows
  const desc1 = `QA SIR flow1 ${new Date().toISOString()}: client given 5mg dose 30 minutes late; no adverse reaction observed.`
  const clientName = await fillIncidentForm(page, {
    occurred: recent,
    learned: recent,
    location: "Client's residence — kitchen",
    description: desc1,
    actions: 'Notified administrator on duty, monitored client vitals, documented in med log.',
  })
  await page.screenshot({ path: `${SHOTS}/sir-flow1-form-filled.png`, fullPage: true }).catch(() => {})

  const submitBtn = page.getByRole('button', { name: /^File incident$/ })
  record('flow1', 'submit button enabled after filling form', await submitBtn.isEnabled(), 'enabled=' + (await submitBtn.isEnabled()))
  await submitBtn.click()

  let incidentId = null
  const detailUrl = (u) => /\/incidents\/(?!new$)[^/]+$/.test(u.pathname)
  try {
    await page.waitForURL(detailUrl, { timeout: 30000 })
    incidentId = page.url().split('/incidents/')[1]
    record('flow1', 'submit navigates to incident detail', true, page.url())
  } catch {
    const body = await page.locator('body').innerText().catch(() => '')
    record('flow1', 'submit navigates to incident detail', false, 'url=' + page.url() + ' body=' + body.slice(0, 300))
  }
  await page.screenshot({ path: `${SHOTS}/sir-flow1-detail-after-create.png`, fullPage: true }).catch(() => {})

  // Flow 1 cont.: verify on /incidents with pending SLA badges
  await page.goto(BASE + '/incidents', { waitUntil: 'domcontentloaded' })
  const listBody = await waitForContent(page, /Special Incident Reports|No incidents/i)
  record('flow1', 'incident appears in log', listBody.includes(clientName) && /Medication error/i.test(listBody), `client="${clientName}" in table=${listBody.includes(clientName)}`)
  record('flow1', '24h pending badge shown', /24h report pending/i.test(listBody), 'badges: ' + (listBody.match(/\d+h report (pending|overdue|late)/gi) || []).join(', '))
  record('flow1', '48h pending badge shown', /48h report pending/i.test(listBody), '')
  await page.screenshot({ path: `${SHOTS}/sir-flow1-list.png`, fullPage: true }).catch(() => {})

  // ---------- Flow 2: detail page transitions ----------
  if (incidentId) {
    await page.goto(`${BASE}/incidents/${incidentId}`, { waitUntil: 'domcontentloaded' })
    const detailBody = await waitForContent(page, /Initial report \(immutable\)/i)
    record('flow2', 'detail shows immutable initial report', detailBody.includes(desc1), 'description present=' + detailBody.includes(desc1))

    // read-only check: the Initial report card contains no editable controls
    const heading = page.locator('text=Initial report (immutable)').first()
    const card = heading.locator('xpath=./ancestor::div[2]')
    const editable = await card.locator('input, textarea, select, button, [contenteditable="true"]').count()
    record('flow2', 'initial narrative is read-only (no edit affordance)', editable === 0, `editable controls in card=${editable}`)

    // Mark verbal reported
    await page.getByRole('button', { name: 'Mark verbal reported' }).click()
    let body = await waitForContent(page, /Verbal reported/i)
    record('flow2', 'mark verbal reported flips status/badge', /Verbal reported/i.test(body), 'status badges: ' + (body.match(/Report pending|Verbal reported|Written submitted|Closed/g) || []).join(','))
    record('flow2', 'verbal button gone after transition', (await page.getByRole('button', { name: 'Mark verbal reported' }).count()) === 0, '')

    // Mark written submitted
    await page.getByRole('button', { name: 'Mark written submitted' }).click()
    body = await waitForContent(page, /Written submitted/i)
    record('flow2', 'mark written submitted flips status', /Written submitted/i.test(body), '')

    // Append follow-up update
    const note = `QA follow-up ${new Date().toISOString()}: regional center confirmed receipt of written report.`
    await page.locator('textarea[placeholder*="follow-up"]').fill(note)
    await page.getByRole('button', { name: 'Add update' }).click()
    body = await waitForContent(page, /QA follow-up/)
    record('flow2', 'follow-up update appended', body.includes(note), 'note visible=' + body.includes(note))

    // Close incident
    await page.getByRole('button', { name: 'Close incident' }).click()
    await page.waitForTimeout(2500)
    body = await waitForContent(page, /Initial report \(immutable\)/i)
    const closedBadge = /Closed/i.test(body)
    const buttonsGone = (await page.getByRole('button', { name: 'Close incident' }).count()) === 0 &&
      (await page.getByRole('button', { name: 'Mark written submitted' }).count()) === 0
    const textareaGone = (await page.locator('textarea[placeholder*="follow-up"]').count()) === 0
    record('flow2', 'close incident -> Closed badge', closedBadge, 'badges: ' + (body.match(/Report pending|Verbal reported|Written submitted|Closed/g) || []).join(','))
    record('flow2', 'close removes transition buttons + update box', buttonsGone && textareaGone, `buttonsGone=${buttonsGone} textareaGone=${textareaGone}`)
    await page.screenshot({ path: `${SHOTS}/sir-flow2-closed.png`, fullPage: true }).catch(() => {})
  }

  // ---------- Flow 3: incident with past learnedAt -> overdue badges ----------
  await page.goto(BASE + '/incidents/new', { waitUntil: 'domcontentloaded' })
  const past = dateParts(3 * 24 * 60 * 60 * 1000) // 3 days ago -> both SLAs breached
  const desc2 = `QA SIR flow3 ${new Date().toISOString()}: historical incident filed late for overdue-badge verification.`
  await fillIncidentForm(page, {
    occurred: past,
    learned: past,
    location: 'Day program — activity room',
    description: desc2,
    actions: 'Retroactive entry for QA of overdue SLA badges.',
    checkAgency: false,
  })
  await page.getByRole('button', { name: /^File incident$/ }).click()
  try {
    await page.waitForURL(detailUrl, { timeout: 30000 })
    record('flow3', 'past learnedAt accepted by form', true, page.url())
  } catch {
    record('flow3', 'past learnedAt accepted by form', false, 'still on ' + page.url())
  }
  await page.goto(BASE + '/incidents', { waitUntil: 'domcontentloaded' })
  const list2 = await waitForContent(page, /Special Incident Reports/i)
  record('flow3', '"24h report overdue" danger badge on log', /24h report overdue/i.test(list2), 'badges: ' + (list2.match(/\d+h report (pending|overdue|late)/gi) || []).join(', '))
  record('flow3', '"48h report overdue" danger badge on log', /48h report overdue/i.test(list2), '')
  await page.screenshot({ path: `${SHOTS}/sir-flow3-overdue.png`, fullPage: true }).catch(() => {})

  // ---------- Flow 4: CSV export ----------
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.getByRole('button', { name: /Download SIR log/i }).click(),
    ])
    const path = 'qa-audit/sir-log.csv'
    await download.saveAs(path)
    const csv = readFileSync(path, 'utf8')
    const hasHeader = /"Client","Category","Occurred At","Learned At","Location"/.test(csv)
    const dataRows = csv.split(/\r?\n/).filter((l) => l.includes('medication_error')).length
    record('flow4', 'CSV downloads with proper headers', hasHeader, `file=${download.suggestedFilename()} header=${hasHeader}`)
    record('flow4', 'CSV contains incident rows', dataRows >= 2, `medication_error rows=${dataRows}`)
  } catch (e) {
    record('flow4', 'CSV export', false, e.message)
  }

  // ---------- Flow 5: caregiver entry point + guards ----------
  const caregiver = await signIn(browser, e2e.E2E_CAREGIVER_EMAIL, 'caregiver')
  const cpage = caregiver.page
  await cpage.goto(BASE + '/caregiver/today', { waitUntil: 'domcontentloaded' })
  await waitForContent(cpage, /Report an incident/i)
  await cpage.getByRole('link', { name: /Report an incident/i }).click()
  await cpage.waitForURL((u) => u.pathname === '/incidents/new', { timeout: 20000 })
  record('flow5', 'caregiver "Report an incident" lands on /incidents/new', true, cpage.url())

  const now = dateParts(30 * 60 * 1000)
  let caregiverClient = null
  try {
    caregiverClient = await fillIncidentForm(cpage, {
      occurred: now,
      learned: now,
      location: 'Community outing — park',
      description: `QA SIR flow5 ${new Date().toISOString()}: caregiver-filed incident, minor scrape on knee during outing.`,
      actions: 'Cleaned and bandaged scrape, notified coordinator by phone.',
      checkAgency: false,
    })
    await cpage.getByRole('button', { name: /^File incident$/ }).click()
    const cbody = await waitForContent(cpage, /Incident filed|Could not file|File a special incident report/i)
    const ok = /Incident filed\. Your coordinator/i.test(cbody)
    record('flow5', 'caregiver can file an incident', ok, ok ? 'success banner shown for client "' + caregiverClient + '"' : cbody.slice(0, 250))
    await cpage.screenshot({ path: `${SHOTS}/sir-flow5-caregiver-filed.png`, fullPage: true }).catch(() => {})
  } catch (e) {
    record('flow5', 'caregiver can file an incident', false, e.message)
  }

  await cpage.goto(BASE + '/incidents', { waitUntil: 'domcontentloaded' })
  await cpage.waitForTimeout(5000)
  record('flow5', 'caregiver blocked from /incidents (redirected)', /\/caregiver\/today/.test(cpage.url()), 'final url=' + cpage.url())

  if (incidentId) {
    await cpage.goto(`${BASE}/incidents/${incidentId}`, { waitUntil: 'domcontentloaded' })
    await cpage.waitForTimeout(5000)
    record('flow5', 'caregiver blocked from /incidents/:id (redirected)', /\/caregiver\/today/.test(cpage.url()), 'final url=' + cpage.url())
  }

  // ---------- Flow 6: audit trail on /logs (admin) ----------
  await page.goto(BASE + '/logs', { waitUntil: 'domcontentloaded' })
  // wait for the events card to finish its first load ("Loading audit events…" clears)
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000)
    const body = await page.locator('body').innerText().catch(() => '')
    if (/Opening agency workspace|Securing agency workspace/i.test(body)) continue
    if (body.includes('Every recorded action') && !body.includes('Loading audit events')) break
  }
  const actionInput = page.locator('input[placeholder="Any action"]')
  for (const action of ['incident_created', 'incident_verbal_reported', 'incident_written_submitted', 'incident_update_added', 'incident_closed']) {
    await actionInput.fill('')
    await actionInput.fill(action)
    // poll until the filtered query settles
    let found = false
    let body = ''
    const label = action.replace(/_/g, ' ')
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000)
      body = await page.locator('body').innerText().catch(() => '')
      if (body.includes('Loading audit events')) continue
      found = new RegExp(label, 'i').test(body) && !/Events matching these filters will appear here/i.test(body)
      break
    }
    record('flow6', `audit event ${action}`, found, found ? 'row(s) shown when filtered' : body.slice(0, 200))
  }
  await page.screenshot({ path: `${SHOTS}/sir-flow6-audit.png`, fullPage: true }).catch(() => {})

  await browser.close()
  const fails = results.filter((r) => !r.pass)
  writeFileSync('qa-audit/incidents-results.json', JSON.stringify(results, null, 2))
  console.log(`\n==== ${results.length - fails.length}/${results.length} passed ====`)
  if (fails.length) console.log('FAILURES:\n' + fails.map((f) => `- ${f.flow} :: ${f.name} :: ${f.evidence}`).join('\n'))
}

main().catch((e) => {
  console.error('FATAL', e)
  writeFileSync('qa-audit/incidents-results.json', JSON.stringify(results, null, 2))
  process.exit(1)
})
