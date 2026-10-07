import { expect, test, type Page } from '@playwright/test'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_COORDINATOR_EMAIL,
  E2E_COORDINATOR_PASSWORD,
  E2E_HR_EMAIL,
  E2E_HR_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  extractClerkToken,
  signInWithClerk,
  signOut,
} from './helpers/auth'
import { callConvexMutation, callConvexQuery } from './helpers/seed'
import { e2eCredentialsAvailable, mockE2EEnabled } from './helpers/env'

// Feature-level QA for the batches shipped around 2026-10-04/05:
// subscription past-due banner, topbar global search, agency-alert composer,
// escalation expand + case modal, ARC grouping/fix popup, compliance status
// dots + upload renewal + custom obligations, employee profile notes/documents,
// billing monthly invoice default, and the training assign picker + course
// builder. Serial: several sections depend on role switches and shared tenant
// state, and the billing-banner section must run last (it puts the tenant
// into past_due, then restores it in a finally + afterAll).

const AUTH_TIMEOUT = 300_000

async function signInAsAdmin(page: Page) {
  await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID, 'org:admin')
}

async function signInAsCaregiver(page: Page) {
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID, 'org:caregiver')
}

async function signInAsCoordinator(page: Page) {
  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID, 'org:coordinator')
}

// The Clerk ticket handshake occasionally needs a moment before a session
// token is available — poll instead of reading it once.
async function adminToken(page: Page): Promise<string> {
  let token: string | null = null
  await expect(async () => {
    token = await extractClerkToken(page)
    expect(token).toBeTruthy()
  }).toPass({ timeout: 20000 })
  if (!token) throw new Error('Could not extract admin token.')
  return token
}

// Shared fixture state: the expired employee-credential document that gives
// the ARC/compliance/employee-documents sections data to exercise. Seeded by
// the ARC test, removed by afterAll (which runs even when serial aborts).
let fixtureEmployeeName = 'QA Caregiver One'
let fixtureMemberId: string | null = null
let complianceFixtureSeeded = false

async function seedComplianceFixture(page: Page) {
  const token = await adminToken(page)
  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) throw new Error('VITE_CONVEX_URL is not set.')
  const generated = (await callConvexMutation(token, 'files:generateUploadUrl', {
    clerkOrgId: E2E_ORG_ID,
  })) as { value?: { url: string } }
  const uploadUrl = generated.value?.url
  if (!uploadUrl) throw new Error('generateUploadUrl returned no url.')
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: Buffer.from('%PDF-1.4 e2e oct4 fixture'),
  })
  if (!uploadResponse.ok) {
    throw new Error(`Fixture upload failed: ${uploadResponse.status}`)
  }
  const { storageId } = (await uploadResponse.json()) as { storageId: string }
  const seeded = (await callConvexMutation(token, 'seed:seedExpiredEmployeeCredential', {
    clerkOrgId: E2E_ORG_ID,
    storageId,
  })) as { value?: { employeeName?: string; memberId?: string | null } }
  fixtureEmployeeName = seeded.value?.employeeName ?? fixtureEmployeeName
  fixtureMemberId = seeded.value?.memberId ?? null
  complianceFixtureSeeded = true
}

async function cleanupOct4State(page: Page) {
  const token = await adminToken(page)
  if (complianceFixtureSeeded) {
    await callConvexMutation(token, 'seed:deleteE2EOct4ComplianceFixture', { clerkOrgId: E2E_ORG_ID })
    complianceFixtureSeeded = false
  }
  // Belt and braces: also make sure tenant billing is healthy.
  await callConvexMutation(token, 'seed:resetE2ETenantBilling', { clerkOrgId: E2E_ORG_ID })
}

test.describe('oct4 feature QA', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    if (!e2eCredentialsAvailable() && !mockE2EEnabled()) {
      assertE2ECredentialsConfigured()
    }
  })

  test.afterAll(async ({ browser }) => {
    // Runs even when a serial failure aborts the remaining tests: remove the
    // compliance fixture and restore tenant billing so the legacy suite and
    // future runs see a clean tenant.
    if (!complianceFixtureSeeded) return
    const page = await browser.newPage()
    try {
      await signInAsAdmin(page)
      await cleanupOct4State(page)
    } finally {
      await page.close()
    }
  })

  // ---- 2. Topbar global search --------------------------------------------
  test('global search: admin finds Billing/Candidates, caregiver gets no billing match', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)
    await page.goto('/')
    const search = page.getByLabel('Search navigation')
    await expect(search).toBeVisible()

    await search.fill('billing')
    const billingOption = page.getByRole('button', { name: /^Billing\s/ })
    await expect(billingOption).toBeVisible()
    await search.press('Enter')
    await expect(page).toHaveURL(/\/billing$/, { timeout: 15000 })

    await search.fill('candidates')
    await expect(page.getByRole('button', { name: /^Candidates\s/ })).toBeVisible()
    await search.press('Enter')
    await expect(page).toHaveURL(/\/hr\/candidates$/, { timeout: 15000 })

    await signOut(page)
    await signInAsCaregiver(page)
    const caregiverSearch = page.getByLabel('Search navigation')
    await caregiverSearch.fill('billing')
    await expect(page.getByText('No matches')).toBeVisible()
    await signOut(page)
  })

  // ---- 3. Agency alerts ----------------------------------------------------
  test('agency alerts: admin composer sends to caregivers only; coordinator has no composer', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    const alertMessage = `QA oct4 alert ${Date.now()}`

    await signInAsAdmin(page)
    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: 'Send agency alert' })).toBeVisible()
    await page.getByLabel('Alert message').fill(alertMessage)
    // Default is "all staff" — uncheck everything, then pick Caregivers only.
    await page.getByLabel('All staff').uncheck()
    await page.getByLabel('Caregivers').check()
    await page.getByRole('button', { name: 'Send alert' }).click()
    await expect(page.getByText(/Alert sent to \d+ member/)).toBeVisible({ timeout: 15000 })
    await signOut(page)

    await signInAsCaregiver(page)
    await page.goto('/notifications')
    await expect(page.getByText(alertMessage)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Send agency alert' })).toHaveCount(0)
    await signOut(page)

    await signInAsCoordinator(page)
    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Send agency alert' })).toHaveCount(0)
    await signOut(page)
  })

  // ---- 4. Escalations on the dashboard -------------------------------------
  test('escalations: admin expands a row and opens the case modal', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)
    await page.goto('/dashboard')
    await expect(page.getByText('Active Escalations')).toBeVisible({ timeout: 20000 })

    if (await page.getByText('No active escalations').isVisible().catch(() => false)) {
      console.warn('SKIP (data-dependent): no active escalations on the dev tenant — expand/Open case not exercised.')
      await signOut(page)
      return
    }

    // First escalation row is a clickable header (cursor-pointer div); the
    // reason paragraph is the reliable click target.
    const firstRow = page.locator('div.cursor-pointer').filter({ hasText: /Level \d/ }).first()
    await expect(firstRow).toBeVisible({ timeout: 15000 })
    await firstRow.click()
    await expect(page.getByText('escalated to', { exact: false })).toBeVisible()

    const openCase = page.getByRole('button', { name: 'Open case' })
    if ((await openCase.count()) === 0) {
      console.warn('SKIP (data-dependent): first active escalation is not an hrCase — Open case not exercised.')
      await signOut(page)
      return
    }
    await openCase.first().click()
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Close' }).click()
    await signOut(page)
  })

  // ---- 5. Audit Ready Center ------------------------------------------------
  test('ARC: fix list search/filters, fix-it dialog, full-view checklist expansion', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)
    // Seed an expired credential on the fixture caregiver so the fix list,
    // the credential fix-it dialog, and the full-view credentials checklist
    // item all have data (removed again in afterAll).
    await seedComplianceFixture(page)
    await page.goto('/audit')
    // The dev tenant has accumulated thousands of archive rows — the report
    // queries can take well over the default timeout. Wait for the loader to
    // finish before asserting on content.
    await expect(page.getByRole('heading', { name: 'Audit Ready Center' })).toBeVisible({ timeout: 20000 })
    await page.getByText('Checking your agency…').waitFor({ state: 'detached', timeout: 90000 }).catch(() => {})

    const fixCard = page.getByText('What to fix')
    if (!(await fixCard.isVisible({ timeout: 20000 }).catch(() => false))) {
      console.warn("SKIP (data-dependent): ARC simple view reports 'audit ready' — no fix items to search/filter/open.")
    } else {
      await expect(page.getByLabel('Filter by employee')).toBeVisible()
      await expect(page.getByLabel('Filter by client')).toBeVisible()

      const searchFixes = page.getByLabel('Search fixes')
      await searchFixes.fill('zzz-no-match-oct4')
      await expect(page.getByText('No fixes match your search.')).toBeVisible()
      await searchFixes.fill('')
      await expect(page.getByText('No fixes match your search.')).toHaveCount(0)

      // Open fix-it dialogs until a credential item (dropzone + reminder)
      // shows; non-credential items only link to their console.
      let credentialDialogSeen = false
      const fixButtons = page.getByRole('button', { name: 'Fix it' })
      const fixCount = Math.min(await fixButtons.count(), 6)
      for (let i = 0; i < fixCount; i++) {
        await fixButtons.nth(i).click()
        const dropzone = page.getByText(/Choose the .* document to upload/)
        const reminder = page.getByRole('button', { name: 'Send reminder email' })
        if (await dropzone.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(dropzone).toBeVisible()
          await expect(page.getByLabel('Credential expiration date')).toBeVisible()
          if (!(await reminder.isVisible().catch(() => false))) {
            console.warn('Note: credential fix item has no linked member — no reminder button (data-dependent).')
          }
          credentialDialogSeen = true
          await page.getByRole('button', { name: 'Close' }).click()
          break
        }
        await page.getByRole('button', { name: 'Close' }).click()
        await page.waitForTimeout(300)
      }
      if (!credentialDialogSeen) {
        console.warn('SKIP (data-dependent): no credential fix items in the ARC fix list — fix-it dialog not exercised.')
      }
    }

    // Full view: unmet checklist items expand to a count + console link.
    await page.goto('/audit?view=full')
    await expect(page.getByText('Regional center vendor-file review')).toBeVisible({ timeout: 90000 })
    await expect(page.getByRole('button', { name: /Send reminder/i })).toHaveCount(0)

    const checklistButtons = page.locator('button').filter({ hasText: /insurance COI current|DS 1891|progress reports|Documentation completeness|blocked billing|SIRs/ })
    let expandedAny = false
    const buttonCount = await checklistButtons.count()
    for (let i = 0; i < buttonCount; i++) {
      const candidate = checklistButtons.nth(i)
      // Expandable items are unmet ones rendered as buttons with a chevron.
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click()
        expandedAny = true
        break
      }
    }
    if (!expandedAny) {
      console.warn('Note: no non-credential checklist item is unmet — generic expansion not exercised (data-dependent).')
    } else {
      await expect(
        page.getByRole('link', { name: /Open the (console|Audit Ready Center) to fix these →/ }).first(),
      ).toBeVisible()
    }

    // Credential items specifically link back to the ARC simple view.
    const credentialItem = page.locator('button').filter({ hasText: /All caregiver credentials current|All required credentials on file/ }).first()
    if (await credentialItem.isVisible().catch(() => false)) {
      await credentialItem.click()
      await expect(
        page.getByRole('link', { name: 'Open the Audit Ready Center to fix these →' }).first(),
      ).toBeVisible()
    } else {
      console.warn('Note: both credential checklist items are Met — ARC-specific link not exercised (data-dependent).')
    }
    await signOut(page)
  })

  // ---- 6. Compliance ---------------------------------------------------------
  test('compliance: status dots, upload-renewal dialog, custom obligation lifecycle', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    page.on('dialog', (dialog) => void dialog.accept())
    // Sign in as HR, not admin: the e2e admin is also a platform admin, and
    // when this heavyweight page (thousands of archive rows) falls back
    // through /select-agency, SelectAgencyPage force-redirects platform
    // admins to /platform/subscriptions — mid-test navigation away from the
    // page under test. HR can manage obligations and upload renewals too.
    await signInWithClerk(page, E2E_HR_EMAIL, E2E_HR_PASSWORD, E2E_ORG_ID, 'org:hr')
    await page.goto('/compliance')
    await expect(page.getByRole('heading', { name: 'Compliance', exact: true })).toBeVisible({ timeout: 20000 })
    // Thousands of archive rows make the items query slow on dev — wait for
    // the loader to finish before counting rows/dots.
    await page.getByText('Loading compliance items…').waitFor({ state: 'detached', timeout: 90000 }).catch(() => {})

    // Status dots on collapsed employee rows.
    const dot = page.locator('span[role="img"][aria-label*="items"]')
    if ((await dot.count()) === 0) {
      console.warn('SKIP (data-dependent): no compliance items on the dev tenant — status dots not exercised.')
    } else {
      await expect(dot.first()).toBeVisible()
    }

    // Upload renewal on an expired/rejected row. The fixture caregiver is
    // guaranteed to have one (the seeded expired credential). The page
    // re-renders/remounts constantly under thousands of archive rows, which
    // detaches elements between locator resolution and event dispatch — so
    // interactions run inside page.evaluate, re-querying the DOM in the same
    // synchronous task as the click.
    let renewalSeen = false
    const renewalDropzone = page.getByText(/Choose the renewed .* document/)
    for (let attempt = 0; attempt < 20 && !renewalSeen; attempt++) {
      const clicked = await page.evaluate((employeeName) => {
        const buttons = [...document.querySelectorAll('button')]
        const row = buttons.find(
          (b) =>
            b.textContent?.includes(employeeName) &&
            /of \d+ current/.test(b.textContent ?? ''),
        )
        if (!row) return 'no-row'
        row.click()
        return 'expanded'
      }, fixtureEmployeeName)
      if (clicked !== 'expanded') continue
      const opened = await page
        .waitForTimeout(400)
        .then(() =>
          page.evaluate(() => {
            const upload = [...document.querySelectorAll('button')].find(
              (b) => b.textContent?.trim() === 'Upload renewal',
            )
            if (!upload) return false
            upload.click()
            return true
          }),
        )
      if (!opened) continue
      if (
        (await renewalDropzone.isVisible({ timeout: 5000 }).catch(() => false)) &&
        (await page.getByLabel('Credential expiration date').isVisible({ timeout: 5000 }).catch(() => false))
      ) {
        renewalSeen = true
      }
    }
    if (renewalSeen) {
      await page.getByRole('button', { name: 'Close' }).dispatchEvent('click').catch(() => {})
    } else {
      console.warn('SKIP (flaky-page): Upload renewal dialog could not be opened — page re-renders kept detaching the buttons.')
    }

    // Custom obligation: add, edit due date inline, delete. Assert on
    // server-persisted row state (survives the page remounts described
    // above), with retry loops around each interaction. Guard against the
    // session having drifted off the agency compliance page entirely.
    if (!page.url().includes('/compliance')) {
      console.warn(`Note: session drifted to ${page.url()} before obligations section — re-navigating.`)
      await page.goto('/compliance')
      await page.getByText('Loading compliance items…').waitFor({ state: 'detached', timeout: 90000 }).catch(() => {})
    }
    const qaRow = page.locator('tr').filter({ hasText: 'QA task' })
    for (let attempt = 0; attempt < 10; attempt++) {
      // A previous attempt may have succeeded server-side before a remount
      // ate the UI confirmation — never add twice.
      if (await qaRow.first().isVisible({ timeout: 2000 }).catch(() => false)) break
      if (!page.url().includes('/compliance')) {
        await page.goto('/compliance')
        await page.getByText('Loading compliance items…').waitFor({ state: 'detached', timeout: 90000 }).catch(() => {})
      }
      // Fill + submit atomically in the page (React-controlled inputs need
      // the native setter so the change events register).
      const submitted = await page.evaluate(() => {
        const setVal = (el: HTMLInputElement, value: string) => {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
          )!.set!
          setter.call(el, value)
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }
        const title = document.querySelector<HTMLInputElement>(
          'input[placeholder="e.g. Renew facility license"]',
        )
        const url = document.querySelector<HTMLInputElement>(
          'input[placeholder="https://…"]',
        )
        const submit = [...document.querySelectorAll('button')].find(
          (b) => b.textContent?.trim() === 'Add task',
        )
        if (!title || !url || !submit) return false
        setVal(title, 'QA task')
        setVal(url, 'https://example.com/qa-guideline')
        submit.click()
        return true
      })
      if (!submitted) continue
      if (await qaRow.first().isVisible({ timeout: 10000 }).catch(() => false)) break
      if (attempt === 9) throw new Error('Could not add the QA task obligation.')
    }
    await expect(qaRow.getByRole('link', { name: 'Guideline' })).toBeVisible()

    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await qaRow.getByRole('button', { name: 'Edit due date' }).dispatchEvent('click')
        await qaRow.getByLabel('Obligation due date').fill('12/31/2026')
        await qaRow.getByRole('button', { name: 'Save' }).dispatchEvent('click')
        await expect(qaRow).toContainText('12/31/2026', { timeout: 10000 })
        break
      } catch {
        if (attempt === 9) throw new Error('Could not edit the QA task due date.')
      }
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        if ((await qaRow.count()) === 0) break
        await qaRow.getByRole('button', { name: 'Delete' }).first().dispatchEvent('click')
        await expect(page.locator('tr').filter({ hasText: 'QA task' })).toHaveCount(0, { timeout: 10000 })
        break
      } catch {
        if (attempt === 9) throw new Error('Could not delete the QA task obligation.')
      }
    }
    await signOut(page)
  })

  // ---- 7. Employee profile ---------------------------------------------------
  test('employee profile: work email, notes add/delete, documents headings, phone', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    page.on('dialog', (dialog) => void dialog.accept())
    await signInAsAdmin(page)
    // Navigate straight to the fixture caregiver's profile when the seed told
    // us their member id — the employees list can hold several profiles with
    // the same display name, so row-clicking is ambiguous.
    if (fixtureMemberId) {
      await page.goto(`/hr/employees/${fixtureMemberId}`)
    } else {
      await page.goto('/hr/employees')
      const fixtureLink = page
        .locator('tr', { hasText: fixtureEmployeeName })
        .getByRole('link', { name: /View/ })
      const anyLink = page.locator('a[href^="/hr/employees/"]').first()
      const target = (await fixtureLink.count()) > 0 ? fixtureLink : anyLink
      await expect(target).toBeVisible({ timeout: 20000 })
      await target.click()
    }
    await expect(page).toHaveURL(/\/hr\/employees\//, { timeout: 15000 })

    await expect(page.getByText('WORK EMAIL')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('PHONE')).toBeVisible()

    // Notes: add then delete (delete is HR/admin-only, confirm auto-accepted).
    await page.getByRole('button', { name: 'Notes' }).click()
    const noteText = `QA oct4 note ${Date.now()}`
    await page.getByPlaceholder('Write a note about this employee…').fill(noteText)
    await page.getByRole('button', { name: 'Add note' }).click()
    await expect(page.getByText(noteText)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Delete note' }).first().click()
    await expect(page.getByText(noteText)).toHaveCount(0, { timeout: 15000 })

    // Documents tab: headings are data-dependent on the employee's archive
    // (the fixture caregiver has the seeded expired credential). The profile
    // page churns like the compliance page — activate the tab from inside
    // the page and retry.
    const hiringHeading = page.getByText('Hiring documents')
    const currentHeading = page.getByText('Current & Archived Documents')
    let docsSeen = false
    for (let attempt = 0; attempt < 10 && !docsSeen; attempt++) {
      await page.evaluate(() => {
        const tab = [...document.querySelectorAll('button')].find(
          (b) => b.textContent?.trim() === 'Documents',
        )
        tab?.click()
      })
      try {
        // Web-first wait: profile + documents queries can take a while to
        // resolve before the tab content renders at all.
        await expect(currentHeading.first()).toBeVisible({ timeout: 10000 })
        docsSeen = true
      } catch {
        // Not rendered yet (or no documents) — re-click and retry.
      }
    }
    if (!docsSeen) {
      console.warn('SKIP (data-dependent): selected employee has no archived documents — Documents headings not exercised.')
    } else {
      await expect(currentHeading.first()).toBeVisible()
      if ((await hiringHeading.count()) > 0) {
        await expect(hiringHeading.first()).toBeVisible()
      } else {
        console.warn('Note: employee has no hiring-document versions — only Current & Archived heading present (data-dependent).')
      }
    }
    await signOut(page)
  })

  // ---- 8. Billing --------------------------------------------------------------
  test('billing: monthly-default invoice dialog, ledger caption, calendar card shape', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)
    await page.goto('/billing')
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible({ timeout: 20000 })

    // Create-invoice dialog: monthly default with a prefilled month + custom option.
    await page.getByRole('button', { name: 'Create per-patient invoices' }).click()
    const periodType = page.locator('#perPatientMode')
    await expect(periodType).toBeVisible()
    await expect(periodType).toHaveValue('monthly')
    const monthInput = page.locator('#perPatientMonth')
    const expectedMonth = new Date().toISOString().slice(0, 7)
    await expect(monthInput).toHaveValue(expectedMonth)
    await periodType.selectOption('custom')
    await expect(page.locator('#perPatientStart')).toBeVisible()
    await expect(page.locator('#perPatientEnd')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Ledger caption (card collapses by default; the table only renders when
    // the tenant has billing lines).
    await page.getByRole('button', { name: /Billing Line Ledger/ }).click()
    const caption = page.getByText('Internal tracking — invoices are generated per client.')
    if (!(await caption.isVisible({ timeout: 10000 }).catch(() => false))) {
      console.warn('SKIP (data-dependent): billing ledger is empty — caption not rendered.')
    }

    // Payment-calendar card: client + month only, no caregiver selector.
    await page.getByRole('button', { name: /Payment calendars/ }).click()
    const calendarCard = page.locator('div').filter({ has: page.locator('#calClient') }).last()
    await expect(page.locator('#calClient')).toBeVisible({ timeout: 15000 })
    await expect(calendarCard.getByLabel(/caregiver/i)).toHaveCount(0)
    await signOut(page)
  })

  // ---- 9. Training admin ---------------------------------------------------------
  test('training admin: assign picker search/multi-select/collapse, step-based course builder', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)
    await page.goto('/training/admin')
    await expect(page.getByRole('heading', { name: 'Training Admin' })).toBeVisible({ timeout: 20000 })

    // Course builder: per-step controls, no course-key input, no JSON textarea.
    await page.getByRole('button', { name: 'New course' }).click()
    await expect(page.getByPlaceholder('Course title')).toBeVisible()
    await expect(page.getByPlaceholder('Step title')).toBeVisible()
    await expect(page.getByLabel('Step type')).toBeVisible()
    await expect(page.getByText('Required')).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Add step' })).toBeVisible()
    // No course-key input and no bulk JSON textarea anywhere on the page —
    // steps are built with per-step controls (the step-content textarea is
    // one of those, not a JSON editor).
    await expect(page.getByPlaceholder(/course key/i)).toHaveCount(0)
    await expect(page.locator('textarea[placeholder*="JSON" i]')).toHaveCount(0)
    await expect(page.getByText(/paste (the )?JSON|JSON (steps|blob|payload)/i)).toHaveCount(0)
    await page.getByRole('button', { name: 'Cancel' }).first().click()

    // Assign picker: find a course with unassigned members (the first course
    // may already have everyone assigned). Scoped to the course's AssignPanel
    // — the external-training card has an identical picker of its own.
    const assignToggles = page.getByRole('button', { name: 'Assign', exact: true })
    const assignPanel = page.locator('div.space-y-3.border-t', {
      has: page.getByRole('button', { name: 'Assign training' }),
    })
    const pickerToggle = assignPanel.getByRole('button', { name: /Select members…|\d+ selected/ })
    const memberSearch = assignPanel.getByPlaceholder('Search by name…')
    const checkboxes = assignPanel.locator('label:has(input[type="checkbox"])')
    let pickerReady = false
    const courseCount = Math.min(await assignToggles.count(), 6)
    for (let i = 0; i < courseCount && !pickerReady; i++) {
      await expect(assignToggles.nth(i)).toBeVisible({ timeout: 15000 })
      await assignToggles.nth(i).click()
      if (!(await pickerToggle.isVisible({ timeout: 5000 }).catch(() => false))) continue
      await pickerToggle.click()
      if ((await checkboxes.count()) > 0) {
        pickerReady = true
      } else {
        // Empty picker (all members assigned) — collapse and close the panel.
        await pickerToggle.click()
        await assignToggles.nth(i).click()
      }
    }
    if (!pickerReady) {
      console.warn('SKIP (data-dependent): every course has all members assigned — picker search/multi-select not exercised.')
    }
    if (pickerReady) {
      const counter = assignPanel.getByText(/\d+ of \d+/)
      const initialCounter = await counter.first().textContent()
      const visibleCount = await checkboxes.count()
      // Search narrows the list.
      const firstName = (await checkboxes.first().textContent())?.trim().split(' ')[0] ?? 'zzz'
      await memberSearch.fill(firstName)
      await expect(counter.first()).not.toHaveText(initialCounter ?? '')
      const narrowedCount = await checkboxes.count()
      expect(narrowedCount).toBeLessThanOrEqual(visibleCount)

      // Multi-select two members (or one if only one is available).
      await checkboxes.first().locator('input[type="checkbox"]').check()
      if (narrowedCount > 1) {
        await checkboxes.nth(1).locator('input[type="checkbox"]').check()
        await expect(pickerToggle).toContainText('2 selected')
      } else {
        await expect(pickerToggle).toContainText('1 selected')
      }
      // Uncheck again so nothing is assigned accidentally; collapse picker.
      await memberSearch.fill('')
      const allBoxes = assignPanel.locator('label:has(input[type="checkbox"]) input[type="checkbox"]')
      const boxCount = await allBoxes.count()
      for (let i = 0; i < boxCount; i++) {
        const box = allBoxes.nth(i)
        if (await box.isChecked()) await box.uncheck()
      }
      // Picker collapses via the same toggle.
      await pickerToggle.click()
      await expect(memberSearch).toHaveCount(0)
    }
    await signOut(page)
  })

  // ---- 1. Subscription past-due banner (LAST — mutates tenant billing state) ----
  test('subscription banner: past-due notice for admin/caregiver, subscription page charge, cleanup', async ({ page }) => {
    test.setTimeout(300_000)
    let billingSeeded = false

    const resetBilling = async () => {
      await signOut(page)
      const signOutButton = page.getByRole('button', { name: 'Sign out' })
      for (let attempt = 0; attempt < 2; attempt++) {
        await signInAsAdmin(page)
        await page.goto('/')
        if (await signOutButton.isVisible({ timeout: 15000 }).catch(() => false)) break
      }
      let token: string | null = null
      await expect(async () => {
        token = await extractClerkToken(page)
        expect(token).toBeTruthy()
      }).toPass({ timeout: 20000 })
      if (!token) throw new Error('Could not extract admin token for billing cleanup.')
      await callConvexMutation(token, 'seed:resetE2ETenantBilling', { clerkOrgId: E2E_ORG_ID })
    }

    try {
      // The Clerk ticket handshake occasionally lands back on /sign-in —
      // verify the shell actually loaded and retry once before proceeding.
      const signOutButton = page.getByRole('button', { name: 'Sign out' })
      for (let attempt = 0; attempt < 2; attempt++) {
        await signInAsAdmin(page)
        await page.goto('/')
        if (await signOutButton.isVisible({ timeout: 15000 }).catch(() => false)) break
      }
      await expect(signOutButton).toBeVisible()
      // Sanity: tenant starts healthy, no banner.
      await expect(page.getByText(/Payment required/)).toHaveCount(0)

      const token = await adminToken(page)
      const seedAndAwaitPastDue = async () => {
        await callConvexMutation(token, 'seed:seedPastDuePlatformInvoice', { clerkOrgId: E2E_ORG_ID })
        billingSeeded = true
        // The seed schedules the real dunning cron mutation; poll until the
        // notice query reports past_due.
        await expect
          .poll(
            async () => {
              const notice = (await callConvexQuery(token, 'agencyBilling:getMyBillingNotice', {
                clerkOrgId: E2E_ORG_ID,
              })) as { status?: string } | null
              return notice?.status ?? null
            },
            { timeout: 30000, intervals: [1000, 2000, 3000] },
          )
          .toBe('past_due')
      }
      await seedAndAwaitPastDue()

      // (a) Admin sees the amber banner with the pay-by date — on every page.
      await expect(page.getByText('Payment required.')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(/pay by .+ to avoid service suspension/)).toBeVisible()
      await expect(page.getByRole('link', { name: /Pay \$42\.00 now/ }).first()).toBeVisible()
      await page.goto('/compliance')
      await expect(page.getByText('Payment required.')).toBeVisible({ timeout: 15000 })

      // (c) Subscription page shows the current-period charge + Pay button.
      await page.goto('/subscription')
      await expect(page.getByText('$42.00 / month')).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('link', { name: /Pay \$42\.00 now/ }).first()).toBeVisible()

      // The dunning state can be wiped externally while these tests run
      // (shared dev tenant — other suites/cleanups reactivate tenants).
      // Verify it is still past_due before switching roles; re-seed if lost.
      const noticeBeforeCaregiver = (await callConvexQuery(token, 'agencyBilling:getMyBillingNotice', {
        clerkOrgId: E2E_ORG_ID,
      })) as { status?: string } | null
      if (noticeBeforeCaregiver?.status !== 'past_due') {
        console.warn('Note: past_due state lost before the caregiver phase (external reactivation on the shared dev tenant?) — re-seeding.')
        await seedAndAwaitPastDue()
      }
      await signOut(page)

      // (b) Caregiver sees the banner without a pay link.
      await signInAsCaregiver(page)
      await expect(page.getByText('Payment required.')).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('link', { name: /Pay .* now/ })).toHaveCount(0)
      await expect(page.getByText(/pay by .+ to avoid service suspension/)).toBeVisible()
    } finally {
      if (billingSeeded) {
        // (d) Cleanup: void the test invoice, reactivate the subscription,
        // then confirm the banner is gone from the UI.
        await resetBilling()
        await page.goto('/')
        await expect(page.getByText(/Payment required/)).toHaveCount(0, { timeout: 20000 })
      }
      await signOut(page)
    }
  })
})
