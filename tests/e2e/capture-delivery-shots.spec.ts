import { expect, test, type Page } from '@playwright/test'
import path from 'path'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  extractClerkToken,
  signInWithClerk,
  signOut,
} from './helpers/auth'
import { callConvexMutation, callConvexQuery } from './helpers/seed'
import { e2eCredentialsAvailable, mockE2EEnabled } from './helpers/env'

// Delivery-packet evidence screenshots for the Oct 2026 feature batches.
// Serial, admin role unless noted. Each shot is its own test so failures map
// to filenames; cleanup (tenant billing, compliance fixture, isTest flag)
// lives in afterAll so it runs even when serial mode aborts.

const SHOTS = path.resolve('docs/delivery-packet-2026-10-11/screenshots')
const E2E_TENANT_ID = 'kh78xybezjc9hgkfqt1az5k81x89w9h1'
const E2E_TENANT_SLUG = 'diego-s-agency-1779273753437877327'
const AUTH_TIMEOUT = 300_000

let fixtureMemberId: string | null = null
let fixtureSeeded = false
let billingSeeded = false
let tenantFlaggedTest = false

async function signInAsAdmin(page: Page) {
  await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID, 'org:admin')
}

async function adminToken(page: Page): Promise<string> {
  let token: string | null = null
  await expect(async () => {
    token = await extractClerkToken(page)
    expect(token).toBeTruthy()
  }).toPass({ timeout: 20000 })
  if (!token) throw new Error('Could not extract admin token.')
  return token
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, name) })
  console.log(`captured ${name}`)
}

// The ARC/compliance queries are heavy on the dev tenant (thousands of
// archive rows). Wait for the loader to appear AND disappear — 'detached'
// alone resolves immediately if the loader has not rendered yet.
async function waitForLoader(page: Page, text: string) {
  const loader = page.getByText(text)
  await loader.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {})
  await loader.waitFor({ state: 'detached', timeout: 120000 }).catch(() => {})
}

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
    body: Buffer.from('%PDF-1.4 delivery-packet fixture'),
  })
  if (!uploadResponse.ok) throw new Error(`Fixture upload failed: ${uploadResponse.status}`)
  const { storageId } = (await uploadResponse.json()) as { storageId: string }
  const seeded = (await callConvexMutation(token, 'seed:seedExpiredEmployeeCredential', {
    clerkOrgId: E2E_ORG_ID,
    storageId,
  })) as { value?: { employeeName?: string; memberId?: string | null } }
  fixtureMemberId = seeded.value?.memberId ?? null
  fixtureSeeded = true
}

test.describe('delivery packet screenshots', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ viewport: { width: 1440, height: 900 } })

  test.beforeAll(() => {
    if (!e2eCredentialsAvailable() && !mockE2EEnabled()) {
      assertE2ECredentialsConfigured()
    }
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    try {
      await signInAsAdmin(page)
      const token = await adminToken(page)
      if (fixtureSeeded) {
        await callConvexMutation(token, 'seed:deleteE2EOct4ComplianceFixture', { clerkOrgId: E2E_ORG_ID })
      }
      if (billingSeeded) {
        await callConvexMutation(token, 'seed:resetE2ETenantBilling', { clerkOrgId: E2E_ORG_ID })
      }
      if (tenantFlaggedTest) {
        await callConvexMutation(token, 'platform:updateTenantInfo', {
          tenantId: E2E_TENANT_ID,
          isTest: false,
        })
      }
    } finally {
      await page.close()
    }
  })

  test('agency pages part 1: hr home, ARC, compliance, employee', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)
    await seedComplianceFixture(page)

    // 1. hr-home.png
    await page.goto('/hr')
    await expect(page.getByText('Candidate pipeline')).toBeVisible({ timeout: 30000 })
    await shot(page, 'hr-home.png')

    // 2. arc-simple.png
    await page.goto('/audit')
    await waitForLoader(page, 'Checking your agency…')
    await expect(page.getByLabel('Search fixes')).toBeVisible({ timeout: 90000 })
    await shot(page, 'arc-simple.png')

    // 3. arc-fix-dialog.png — open the credential fix-it dialog (try the
    // first few Fix it buttons; non-credential items open a console link).
    let fixDialogOpen = false
    const fixButtons = page.getByRole('button', { name: 'Fix it' })
    for (let i = 0; i < Math.min(await fixButtons.count(), 6) && !fixDialogOpen; i++) {
      await fixButtons.nth(i).click()
      fixDialogOpen = await page
        .getByText(/Choose the .* document to upload/)
        .isVisible({ timeout: 5000 })
        .catch(() => false)
      if (!fixDialogOpen) {
        await page.getByRole('button', { name: 'Close' }).click().catch(() => {})
        await page.waitForTimeout(300)
      }
    }
    if (fixDialogOpen) {
      await shot(page, 'arc-fix-dialog.png')
      await page.getByRole('button', { name: 'Close' }).click()
    } else {
      console.warn('SKIP arc-fix-dialog.png: no credential fix item produced the upload dialog.')
    }

    // 4. arc-full-checklist.png — expand an unmet credential checklist item.
    await page.goto('/audit?view=full')
    await expect(page.getByText('Regional center vendor-file review')).toBeVisible({ timeout: 90000 })
    const credentialItem = page
      .locator('button')
      .filter({ hasText: /All caregiver credentials current|All required credentials on file/ })
      .first()
    if (await credentialItem.isVisible().catch(() => false)) {
      await credentialItem.click()
      await expect(
        page.getByRole('link', { name: 'Open the Audit Ready Center to fix these →' }).first(),
      ).toBeVisible()
      await page.getByRole('link', { name: 'Open the Audit Ready Center to fix these →' })
        .first()
        .scrollIntoViewIfNeeded()
      await shot(page, 'arc-full-checklist.png')
    } else {
      console.warn('SKIP arc-full-checklist.png: no unmet credential checklist item.')
    }

    // 5. compliance-dots.png
    await page.goto('/compliance')
    await expect(page.getByRole('heading', { name: 'Compliance', exact: true })).toBeVisible({ timeout: 20000 })
    await waitForLoader(page, 'Loading compliance items…')
    await expect(page.locator('span[role="img"][aria-label*="items"]').first()).toBeVisible({ timeout: 30000 })
    await shot(page, 'compliance-dots.png')

    // 6. compliance-upload-renewal.png — in-page clicks survive the page churn.
    let renewalOpen = false
    for (let attempt = 0; attempt < 20 && !renewalOpen; attempt++) {
      await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')]
        const row = buttons.find(
          (b) => b.textContent?.includes('QA Caregiver One') && /of \d+ current/.test(b.textContent ?? ''),
        )
        row?.click()
      })
      const opened = await page.waitForTimeout(400).then(() =>
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
      renewalOpen = await page
        .getByText(/Choose the renewed .* document/)
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    }
    if (renewalOpen) {
      await shot(page, 'compliance-upload-renewal.png')
      await page.getByRole('button', { name: 'Close' }).dispatchEvent('click').catch(() => {})
    } else {
      console.warn('SKIP compliance-upload-renewal.png: dialog would not stay open (page churn).')
    }

    // 7. obligations-custom.png — add, shoot, delete.
    const qaRow = page.locator('tr').filter({ hasText: 'QA task' })
    for (let attempt = 0; attempt < 10; attempt++) {
      if (await qaRow.first().isVisible({ timeout: 2000 }).catch(() => false)) break
      const submitted = await page.evaluate(() => {
        const setVal = (el: HTMLInputElement, value: string) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
          setter.call(el, value)
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }
        const title = document.querySelector<HTMLInputElement>('input[placeholder="e.g. Renew facility license"]')
        const url = document.querySelector<HTMLInputElement>('input[placeholder="https://…"]')
        const submit = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Add task')
        if (!title || !url || !submit) return false
        setVal(title, 'QA task')
        setVal(url, 'https://example.com/qa-guideline')
        submit.click()
        return true
      })
      if (!submitted) continue
      if (await qaRow.first().isVisible({ timeout: 10000 }).catch(() => false)) break
    }
    await expect(qaRow.first()).toBeVisible({ timeout: 15000 })
    await qaRow.first().scrollIntoViewIfNeeded()
    await shot(page, 'obligations-custom.png')
    for (let attempt = 0; attempt < 10; attempt++) {
      if ((await qaRow.count()) === 0) break
      await qaRow.getByRole('button', { name: 'Delete' }).first().dispatchEvent('click')
      if ((await qaRow.count()) === 0) break
      await page.waitForTimeout(1000)
    }
    await expect(qaRow).toHaveCount(0, { timeout: 15000 })

    // 8. employee-profile.png — profile tab with WORK EMAIL + PHONE.
    if (fixtureMemberId) {
      await page.goto(`/hr/employees/${fixtureMemberId}`)
    } else {
      await page.goto('/hr/employees')
      await page.locator('tr', { hasText: 'QA Caregiver One' }).getByRole('link', { name: /View/ }).first().click()
    }
    await expect(page.getByText('WORK EMAIL')).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('PHONE')).toBeVisible()
    await shot(page, 'employee-profile.png')

    // 9. employee-documents.png — Documents tab with the archive table.
    let docsSeen = false
    for (let attempt = 0; attempt < 10 && !docsSeen; attempt++) {
      await page.evaluate(() => {
        const tab = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Documents')
        tab?.click()
      })
      try {
        await expect(page.getByText('Current & Archived Documents').first()).toBeVisible({ timeout: 10000 })
        docsSeen = true
      } catch { /* retry */ }
    }
    if (docsSeen) {
      if (!(await page.getByText('Hiring documents').first().isVisible().catch(() => false))) {
        console.warn('Note: employee has no hiring-document versions — only Current & Archived table in shot.')
      }
      await shot(page, 'employee-documents.png')
    } else {
      console.warn('SKIP employee-documents.png: no archived documents on the fixture employee.')
    }
    await signOut(page)
  })

  test('agency pages part 2: candidates, billing, training, topbar, notifications, account', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)

    // 10. candidate-notes.png — recruiter notes filled, then cleared.
    await page.goto('/hr/candidates')
    const firstRow = page.locator('[data-testid^="candidate-row-"]').first()
    await expect(firstRow).toBeVisible({ timeout: 30000 })
    await firstRow.locator('a[href^="/hr/candidates/"]:not([href$="/hire"])').first().click()
    await expect(page).toHaveURL(/\/hr\/candidates\/[^/]+$/, { timeout: 15000 })
    const notes = page.getByTestId('hr-notes-input')
    await expect(notes).toBeVisible({ timeout: 30000 })
    await notes.fill('QA evidence note')
    await page.locator('h1').first().click()
    await page.waitForTimeout(1500)
    await notes.scrollIntoViewIfNeeded()
    await shot(page, 'candidate-notes.png')
    await notes.fill('')
    await page.locator('h1').first().click()
    await page.waitForTimeout(1500)

    // 11. candidate-passport.png — photo-ID row with the type label.
    await page.goto('/hr/candidates/mx7adspwkvsc7935c5z0xkvptn8bhj0a')
    await expect(page.getByTestId('hr-notes-input')).toBeVisible({ timeout: 45000 })
    const passportRow = page.getByText(/Photo identification — (Passport|Driver's License|Foreign Passport)/).first()
    if (await passportRow.isVisible({ timeout: 10000 }).catch(() => false)) {
      await passportRow.scrollIntoViewIfNeeded()
      await shot(page, 'candidate-passport.png')
    } else {
      console.warn('SKIP candidate-passport.png: no photo-ID row with a type label on the fixture candidate.')
    }

    // 12. versions-panel.png — the panel starts empty on this candidate, so
    // upload two small versions through the panel's own HR upload control
    // (creates real demo data on this demo candidate), then shoot the
    // collapsed groups with their chips.
    const versionsSection = page.getByText('Document versions (history)')
    await versionsSection.scrollIntoViewIfNeeded()
    await expect(versionsSection).toBeVisible()
    if (await page.getByText('No uploaded versions yet.').isVisible({ timeout: 5000 }).catch(() => false)) {
      const versionFile = { name: 'qa-evidence-version.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 delivery evidence') }
      const uploadBox = page.locator('xpath=//*[contains(text(),"Upload a new version (HR)")]/ancestor::div[1]')
      for (let i = 0; i < 2; i++) {
        await uploadBox.locator('input[type="file"]').setInputFiles(versionFile)
        await uploadBox.getByRole('button', { name: 'Upload version' }).click()
        // A successful upload clears the file (button disables again) and the
        // group chip gains a version — wait for the count, not the button.
        await expect(
          page.locator('button[aria-expanded]').filter({ hasText: `${i + 1} version` }).first(),
        ).toBeVisible({ timeout: 30000 })
      }
    }
    const chip = page.locator('button[aria-expanded]').filter({ hasText: /versions?/ }).first()
    if (await chip.isVisible({ timeout: 10000 }).catch(() => false)) {
      await shot(page, 'versions-panel.png')
    } else {
      console.warn('SKIP versions-panel.png: no document versions available and HR upload did not produce one.')
    }

    // 13. billing-invoice-dialog.png — the client-first Ready-to-bill panel
    // (year/month selects + client checkboxes replace the old dialog).
    await page.goto('/billing')
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible({ timeout: 30000 })
    await expect(page.locator('#clientInvoiceMode')).toBeVisible()
    await shot(page, 'billing-invoice-dialog.png')

    // 14. billing-calendar.png
    await page.getByRole('button', { name: /Payment calendars/ }).click()
    await expect(page.locator('#calClient')).toBeVisible({ timeout: 15000 })
    await shot(page, 'billing-calendar.png')

    // 15. training-assign.png
    await page.goto('/training/admin')
    await expect(page.getByRole('heading', { name: 'Training Admin' })).toBeVisible({ timeout: 30000 })
    const assignToggles = page.getByRole('button', { name: 'Assign', exact: true })
    const assignPanel = page.locator('div.space-y-3.border-t', {
      has: page.getByRole('button', { name: 'Assign training' }),
    })
    const pickerToggle = assignPanel.getByRole('button', { name: /Select members…|\d+ selected/ })
    let pickerOpen = false
    for (let i = 0; i < Math.min(await assignToggles.count(), 6) && !pickerOpen; i++) {
      await assignToggles.nth(i).click()
      if (!(await pickerToggle.isVisible({ timeout: 5000 }).catch(() => false))) continue
      await pickerToggle.click()
      if ((await assignPanel.locator('label:has(input[type="checkbox"])').count()) > 0) {
        pickerOpen = true
      } else {
        await pickerToggle.click()
        await assignToggles.nth(i).click()
      }
    }
    if (pickerOpen) {
      await expect(assignPanel.getByPlaceholder('Search by name…')).toBeVisible()
      await shot(page, 'training-assign.png')
    } else {
      console.warn('SKIP training-assign.png: no course has unassigned members.')
    }

    // 16. training-builder.png
    await page.getByRole('button', { name: 'New course' }).click()
    await expect(page.getByPlaceholder('Course title')).toBeVisible()
    await shot(page, 'training-builder.png')
    await page.getByRole('button', { name: 'Cancel' }).first().click()

    // 17. topbar-search.png — dropdown open with "bill" typed (no click/blur).
    await page.goto('/hr')
    const search = page.getByLabel('Search navigation')
    await search.click()
    await search.pressSequentially('bill', { delay: 40 })
    await expect(page.getByRole('button', { name: /^Billing\s/ })).toBeVisible()
    await shot(page, 'topbar-search.png')

    // 18. notifications-composer.png
    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: 'Send agency alert' })).toBeVisible({ timeout: 30000 })
    await shot(page, 'notifications-composer.png')

    // 19. account-page.png
    await page.goto('/account')
    await expect(page.getByTestId('account-email')).toHaveText(E2E_ADMIN_EMAIL, { timeout: 30000 })
    await expect(page.getByRole('heading', { name: 'Profile details' })).toBeVisible({ timeout: 45000 })
    await shot(page, 'account-page.png')
    await signOut(page)
  })

  test('past-due banner + subscription page, then billing cleanup', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    try {
      await signInAsAdmin(page)
      const token = await adminToken(page)
      await callConvexMutation(token, 'seed:seedPastDuePlatformInvoice', { clerkOrgId: E2E_ORG_ID })
      billingSeeded = true
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

      // 20. banner-past-due.png
      await page.goto('/')
      await expect(page.getByText('Payment required.')).toBeVisible({ timeout: 15000 })
      await shot(page, 'banner-past-due.png')

      // 21. subscription-page.png
      await page.goto('/subscription')
      await expect(page.getByText('$42.00 / month')).toBeVisible({ timeout: 15000 })
      await shot(page, 'subscription-page.png')
    } finally {
      // 22. MANDATORY cleanup — tenant must end ACTIVE.
      const signOutButton = page.getByRole('button', { name: 'Sign out' })
      for (let attempt = 0; attempt < 2; attempt++) {
        if (await signOutButton.isVisible({ timeout: 5000 }).catch(() => false)) break
        await signInAsAdmin(page)
      }
      const token = await adminToken(page)
      await callConvexMutation(token, 'seed:resetE2ETenantBilling', { clerkOrgId: E2E_ORG_ID })
      billingSeeded = false
      await page.goto('/')
      await expect(page.getByText(/Payment required/)).toHaveCount(0, { timeout: 20000 })
      await signOut(page)
    }
  })

  test('platform admin pages (e2e admin is already a platform admin on dev)', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)
    const token = await adminToken(page)

    // Flag the e2e tenant as a test agency so the Test badge renders; the
    // afterAll unflags it again.
    await callConvexMutation(token, 'platform:updateTenantInfo', {
      tenantId: E2E_TENANT_ID,
      isTest: true,
    })
    tenantFlaggedTest = true

    // 23. platform-subscriptions.png
    await page.goto('/platform/subscriptions')
    await expect(page.getByText('Test').first()).toBeVisible({ timeout: 30000 })
    await shot(page, 'platform-subscriptions.png')

    // 24. platform-account.png
    await page.goto('/platform/account')
    await expect(page.getByText('Email', { exact: true })).toBeVisible({ timeout: 30000 })
    await shot(page, 'platform-account.png')

    // 25. platform-dev-tools.png — subscription detail, dev tools collapsed.
    await page.goto(`/platform/subscriptions/${E2E_TENANT_SLUG}`)
    await expect(page.getByText('Developer tools (QA only)')).toBeVisible({ timeout: 30000 })
    await page.getByText('Developer tools (QA only)').scrollIntoViewIfNeeded()
    await shot(page, 'platform-dev-tools.png')
    await signOut(page)
  })
})
