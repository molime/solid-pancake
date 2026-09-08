// Stage 2 interactive flow: credential pack apply + agency obligations.
// Signs in as admin via Clerk sign_in_tokens, drives /compliance, and uses a
// ConvexHttpClient (authenticated with the page's Clerk session token) for
// backend-level idempotency checks and due-date setup for badge states.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { ConvexHttpClient } from 'convex/browser'

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
const CONVEX_URL = local.VITE_CONVEX_URL

const results = { steps: [], bugs: [] }
function step(name, pass, detail) {
  results.steps.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function clerkTicket(email) {
  const headers = {
    Authorization: `Bearer ${local.CLERK_SECRET_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const res = await fetch(
    `https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`,
    { headers },
  )
  const users = await res.json()
  const user = Array.isArray(users)
    ? users.find((u) =>
        u.email_addresses.some(
          (x) => x.email_address.toLowerCase() === email.toLowerCase(),
        ),
      )
    : null
  if (!user) throw new Error(`clerk user not found: ${email}`)
  const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }),
  })
  if (!tokRes.ok) throw new Error(`sign_in_tokens failed: HTTP ${tokRes.status}`)
  return (await tokRes.json()).token
}

async function waitForContent(page, re, timeoutMs = 45000) {
  const start = Date.now()
  let body = ''
  while (Date.now() - start < timeoutMs) {
    body = await page.locator('body').innerText().catch(() => '')
    const t = body.trim()
    if (
      t.length > 50 &&
      !/Opening agency workspace|Securing agency workspace|Preparing workspace/i.test(t) &&
      re.test(t)
    ) {
      return body
    }
    await page.waitForTimeout(1000)
  }
  throw new Error(`timed out waiting for ${re}; last body: ${body.slice(0, 300)}`)
}

// Waits until every card's async query has resolved (no "Loading …" copy
// left) so conditional UI like the pack card / empty states has rendered.
async function waitForSettled(page, timeoutMs = 45000) {
  const start = Date.now()
  let body = ''
  while (Date.now() - start < timeoutMs) {
    body = await page.locator('body').innerText().catch(() => '')
    if (
      /Agency obligations/i.test(body) &&
      !/Loading compliance items…|Loading credential gaps…|Loading agency obligations…|Opening agency workspace|Securing agency workspace/i.test(body)
    ) {
      await page.waitForTimeout(1500)
      return page.locator('body').innerText()
    }
    await page.waitForTimeout(1000)
  }
  throw new Error(`page never settled; last body: ${body.slice(0, 300)}`)
}

async function convexClientFor(page) {
  const { token, orgId } = await page.evaluate(async () => {
    const session = window.Clerk?.session
    if (!session) throw new Error('no clerk session')
    return {
      token: await session.getToken({ skipCache: true }),
      orgId: window.Clerk.organization?.id,
    }
  })
  const client = new ConvexHttpClient(CONVEX_URL)
  client.setAuth(token)
  return { client, orgId }
}

function parseUsDate(text) {
  const m = text.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]))
}

function addMonthsLocal(date, months) {
  const d = new Date(date.getTime())
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return d
}

async function main() {
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--disable-gpu', '--js-flags=--max-old-space-size=512'],
  })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err).slice(0, 300)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text().slice(0, 300))
  })

  const ticket = await clerkTicket(e2e.E2E_ADMIN_EMAIL)
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
  await page.waitForTimeout(3000)
  console.log(`[auth] landed on ${page.url()}`)

  await page.goto(`${BASE}/compliance`, { waitUntil: 'domcontentloaded' })
  await waitForSettled(page)
  console.log('[page] /compliance loaded and settled')

  // ---- Flow 1: credential pack ----
  const packButton = page.getByRole('button', {
    name: /apply ca ils\/sls credential pack/i,
  })
  const { client, orgId } = await convexClientFor(page)

  // If caregiver requirements already exist (e.g. from a previous run), the
  // button is legitimately hidden. Delete the pack-created requirements so
  // the UI button click itself can be exercised end to end.
  let reqs = await client.query('compliance:listCredentialRequirements', {
    clerkOrgId: orgId,
  })
  const preExisting = reqs.filter((r) => r.role === 'org:caregiver')
  if (preExisting.length > 0) {
    console.log(`[setup] deleting ${preExisting.length} pre-existing caregiver requirements`)
    for (const req of preExisting) {
      await client.mutation('compliance:deleteCredentialRequirement', {
        clerkOrgId: orgId,
        requirementId: req._id,
      })
    }
    await page.goto(`${BASE}/compliance`, { waitUntil: 'domcontentloaded' })
    await waitForSettled(page)
  }

  const packVisible = (await packButton.count()) > 0
  if (packVisible) {
    step('pack: apply button visible (no caregiver requirements)', true)
    await packButton.click()
    await waitForContent(page, /credential pack|already exist/i, 20000)
    const body1 = await page.locator('body').innerText()
    const msg =
      body1.match(/Applied the CA ILS\/SLS credential pack[^.\n]*\./i)?.[0] ??
      body1.match(/All \d+ pack requirements already exist[^.\n]*\./i)?.[0] ??
      '(message not found)'
    step('pack: first apply result', /Applied|already exist/i.test(msg), msg)
    await page.screenshot({ path: `${SHOTS}/stage2_pack_applied.png` })

    // Button hides once requirements exist, so verify idempotency at the
    // mutation level with the same admin identity.
    const second = await client.mutation('credentialPacks:applyCredentialPack', {
      clerkOrgId: orgId,
    })
    step(
      'pack: idempotent re-apply (mutation level)',
      second.counts.created === 0 && second.counts.skipped > 0,
      JSON.stringify(second),
    )
    // Confirm the button is now hidden (requirements exist).
    await page.goto(`${BASE}/compliance`, { waitUntil: 'domcontentloaded' })
    await waitForSettled(page)
    step(
      'pack: button hidden after apply',
      (await packButton.count()) === 0,
    )
  } else {
    reqs = await client.query('compliance:listCredentialRequirements', {
      clerkOrgId: orgId,
    })
    const caregiverReqs = reqs.filter((r) => r.role === 'org:caregiver')
    step(
      'pack: button hidden because caregiver requirements exist',
      caregiverReqs.length > 0,
      `${caregiverReqs.length} caregiver requirements`,
    )
    results.bugs.push(
      caregiverReqs.length === 0
        ? 'BUG: pack button hidden despite zero caregiver requirements (showPackCard logic)'
        : null,
    )
    results.bugs = results.bugs.filter(Boolean)
    await page.screenshot({ path: `${SHOTS}/stage2_pack_hidden.png` })
  }

  // ---- Flow 2: agency obligations ----
  await page.goto(`${BASE}/compliance`, { waitUntil: 'domcontentloaded' })
  let body = await waitForSettled(page)

  if (/No agency obligations/i.test(body)) {
    const seedBtn = page.getByRole('button', { name: /seed standard ca obligations/i })
    if ((await seedBtn.count()) === 0) {
      step('obligations: seed button present for admin', false, 'empty state but no seed button')
    } else {
      await seedBtn.click()
      await waitForContent(page, /Seeded \d+ standard CA obligation|already exist/i, 20000)
      body = await page.locator('body').innerText()
      const msg = body.match(/Seeded \d+ standard CA obligations?[^.\n]*\./i)?.[0] ?? '(not found)'
      step('obligations: seeded via UI', /Seeded 9/.test(msg), msg)
    }
  } else {
    step('obligations: already seeded', true, 'table present')
  }
  await page.screenshot({ path: `${SHOTS}/stage2_obligations_table.png` })

  // Badge sanity: force one obligation due-soon and one overdue via the
  // admin mutation, then reload and check the badges render.
  const obligations = await client.query('agencyObligations:listObligations', {
    clerkOrgId: orgId,
  })
  step('obligations: 9 standard rows', obligations.length === 9, `count=${obligations.length}`)
  if (obligations.length < 2) {
    throw new Error('need at least 2 obligations to continue badge/complete flow')
  }

  const now = Date.now()
  const dueSoonIso = new Date(now + 10 * 86400000).toISOString()
  const overdueIso = new Date(now - 86400000).toISOString()
  await client.mutation('agencyObligations:updateDueDate', {
    clerkOrgId: orgId,
    obligationId: obligations[0]._id,
    dueAt: dueSoonIso,
  })
  await client.mutation('agencyObligations:updateDueDate', {
    clerkOrgId: orgId,
    obligationId: obligations[1]._id,
    dueAt: overdueIso,
  })
  await page.goto(`${BASE}/compliance`, { waitUntil: 'domcontentloaded' })
  body = await waitForSettled(page)
  step('obligations: Due soon badge renders', /Due soon/.test(body))
  step('obligations: Overdue badge renders', /Overdue/.test(body))
  step('obligations: On track badge renders', /On track/.test(body))
  await page.screenshot({ path: `${SHOTS}/stage2_obligations_badges.png` })

  // Complete the overdue obligation via the dialog.
  const overdueRow = page
    .getByRole('row')
    .filter({ hasText: 'Overdue' })
    .first()
  const targetLabel = (await overdueRow.locator('td').first().innerText()).trim()
  const cadenceText = (await overdueRow.locator('td').nth(2).innerText()).trim()
  const cadenceMonths = Number(cadenceText.match(/(\d+)/)?.[1])
  await overdueRow.getByRole('button', { name: /^complete$/i }).click()
  await page.getByRole('heading', { name: /complete obligation/i }).waitFor({ timeout: 10000 })
  await page.screenshot({ path: `${SHOTS}/stage2_complete_dialog.png` })

  // Link evidence if the dialog offers archive items.
  const evidenceSelect = page.locator('select').first()
  const optionCount = await evidenceSelect.locator('option').count()
  let evidencePicked = 'none offered'
  if (optionCount > 1) {
    await evidenceSelect.selectOption({ index: 1 })
    evidencePicked = await evidenceSelect
      .locator('option')
      .nth(1)
      .innerText()
  }
  await page.locator('textarea').first().fill('QA: completed during stage-2 e2e verification')
  await page.getByRole('button', { name: /mark complete/i }).click()
  await waitForContent(page, /Obligation completed/i, 20000)
  step('obligations: complete dialog submitted', true, `evidence: ${evidencePicked}`)

  // Verify due date rolled forward by cadence and badge flipped to ok.
  await page.waitForTimeout(1500)
  const completedRow = page.getByRole('row').filter({ hasText: targetLabel }).first()
  const newDueText = (await completedRow.locator('td').nth(1).innerText()).trim()
  const newBadge = (await completedRow.locator('td').nth(3).innerText()).trim()
  const expected = addMonthsLocal(new Date(), cadenceMonths)
  const actual = parseUsDate(newDueText)
  const diffDays = actual ? Math.abs(actual - expected) / 86400000 : Infinity
  step(
    'obligations: due date rolled forward by cadence',
    diffDays <= 1,
    `${targetLabel}: due=${newDueText}, expected ~${expected.toLocaleDateString('en-US')}, cadence=${cadenceMonths}mo`,
  )
  step('obligations: status flipped to On track', /On track/.test(newBadge), `badge=${newBadge}`)
  await page.screenshot({ path: `${SHOTS}/stage2_obligation_completed.png` })

  // Verify backend state matches (completedAt stamped, notes/evidence stored).
  const after = await client.query('agencyObligations:listObligations', { clerkOrgId: orgId })
  const updated = after.find((o) => o._id === obligations[1]._id)
  step(
    'obligations: backend completedAt/notes stored',
    !!updated?.completedAt && /QA: completed/.test(updated?.notes ?? ''),
    JSON.stringify({
      completedAt: updated?.completedAt,
      notes: updated?.notes,
      evidenceItemId: updated?.evidenceItemId ?? null,
    }),
  )

  step('no pageerrors/console errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  writeFileSync('qa-audit/flow-compliance-results.json', JSON.stringify(results, null, 2))
  await browser.close()
  const failed = results.steps.filter((s) => !s.pass)
  console.log(`\n${results.steps.length - failed.length}/${results.steps.length} steps passed`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL', e)
  writeFileSync('qa-audit/flow-compliance-results.json', JSON.stringify(results, null, 2))
  process.exit(1)
})
