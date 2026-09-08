import { test, expect } from '@playwright/test'

/**
 * End-to-end check of the Golden Ages hiring flow in the "My Organization Test"
 * dev tenant. This spec exercises the public apply link, the built-in (not
 * dynamic) application form, and the agency-specific document generation.
 *
 * NOTE: this creates real candidate accounts in the dev Clerk instance. Each
 * run uses a unique Gmail address so repeated runs do not collide.
 */

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5173'
const AGENCY_SLUG = 'my-organization-test-1779197430198727447'

async function applyPublic(page: import('@playwright/test').Page) {
  const uniqueEmail = `golden.ages.e2e.${Date.now()}@gmail.com`
  await page.goto(`${BASE_URL}/apply?agency=${AGENCY_SLUG}`)
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('heading', { name: /Apply to/i })).toBeVisible({ timeout: 15000 })
  await page.getByLabel('Full name').fill('Golden Ages E2E Candidate')
  await page.getByLabel('Email address').fill(uniqueEmail)
  await page.getByLabel('Phone number').fill('555-555-5555')

  const branchSelect = page.locator('select').filter({ hasText: /Branch|Location/i }).first()
  if (await branchSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    const options = await branchSelect.locator('option').count()
    if (options > 1) await branchSelect.selectOption({ index: 1 })
  }
  const positionSelect = page.locator('select').filter({ hasText: /Position/i }).first()
  if (await positionSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    const options = await positionSelect.locator('option').count()
    if (options > 1) await positionSelect.selectOption({ index: 1 })
  }

  await page.getByRole('button', { name: /Apply|Submit|Start/i }).click()
  await expect(page.getByText('Application started!')).toBeVisible({ timeout: 45000 })

  return uniqueEmail
}

async function setPasswordAndContinue(page: import('@playwright/test').Page) {
  await page.locator('#newPassword').fill('GoldenAges2026!E2E')
  await page.locator('#confirmPassword').fill('GoldenAges2026!E2E')
  await page.getByRole('button', { name: /Set password and continue/i }).click()
  await page.waitForURL(/onboarding\/application/, { timeout: 45000 })
}

async function acceptJobDescriptionAndLegalValidity(page: import('@playwright/test').Page) {
  // Golden Ages: disclaimer card and agency-specific JD must be visible.
  await expect(page.getByText('Important notice before you apply')).toBeVisible({ timeout: 15000 })
  await page.locator('#jdPositionApplyingFor').selectOption('Caregiver')
  await expect(page.getByText('Golden Ages Home Care', { exact: false }).first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/Morning: 9:00 AM/i)).toBeVisible()
  await page.getByLabel(/I have read and understand the job description/i).check()
  await page.getByLabel(/I understand that typing my name/i).check()
  await page.getByRole('button', { name: /Save and continue/i }).click()
}

async function fillPersonalInfo(page: import('@playwright/test').Page) {
  await page.getByLabel('First name').fill('Golden')
  await page.getByLabel('Last name').fill('Ages')
  await page.locator('#idType').selectOption('ssn')
  await page.getByLabel('SSN').fill('123-45-6789')
  await page.getByLabel('Street address').fill('123 Main St')
  await page.getByLabel('Apt / suite').fill('Apt 1')
  await page.getByLabel('City').first().fill('San Jose')
  await page.locator('#state').first().selectOption('CA')
  await page.getByLabel('ZIP').first().fill('95131')
  await page.getByLabel('Home phone').fill('555-111-2222')
  await page.getByLabel('Cell phone').fill('555-333-4444')
  await page.locator('#email').fill('golden.ages.e2e@example.com')
  await page.locator('#dateOfBirth').fill('06/15/1990')
  await page.locator('#gender').selectOption('female')
  await page.locator('#availability').selectOption('full_time')
  const shiftRadio = page.locator('#shift-full_time')
  await shiftRadio.scrollIntoViewIfNeeded()
  await shiftRadio.check()
  await page.locator('#day-monday').check()
  await page.locator('#day-tuesday').check()
  await page.getByLabel('I am 18 years of age or older').check()
}

async function fillEmploymentAndReferences(page: import('@playwright/test').Page) {
  await page.getByLabel('Company name').fill('Previous Employer')
  await page.getByLabel('Position').first().fill('Caregiver')
  await page.getByLabel('From (MM/YYYY)').fill('01/2020')
  await page.getByLabel('To (MM/YYYY)').fill('12/2023')
  await page.getByLabel('Supervisor contact').fill('Former Supervisor')
  await page.getByLabel('Job duties').fill('Patient care')
  await page.getByLabel('Reason for leaving').fill('Relocation')

  await page.getByLabel('Full name').first().fill('Reference Person')
  await page.getByLabel('Phone').first().fill('555-555-5555')
  await page.getByLabel('Relationship').first().fill('Friend')
}

async function fillI9AndW4(page: import('@playwright/test').Page) {
  await page.locator('#i9LastName').fill('Ages')
  await page.locator('#i9FirstName').fill('Golden')
  await page.locator('#i9Address').fill('123 Main St')
  await page.locator('#i9City').fill('San Jose')
  await page.locator('#i9State').selectOption('CA')
  await page.locator('#i9Zip').fill('95131')
  await page.locator('#i9DateOfBirth').fill('06/15/1990')
  await page.locator('#i9Ssn').fill('123-45-6789')
  await page.locator('#citizenshipStatus').selectOption('citizen')
  await page.locator('#i9Signature').fill('Golden Ages')
  await page.locator('#i9Date').fill('07/18/2026')

  await page.locator('#w4FirstName').fill('Golden')
  await page.locator('#w4LastName').fill('Ages')
  await page.locator('#w4Address').fill('123 Main St')
  await page.locator('#cityStateZip').fill('San Jose, CA 95131')
  await page.locator('#w4Ssn').fill('123-45-6789')
  await page.locator('#filingStatus').selectOption('single')
  await page.locator('#w4Signature').fill('Golden Ages')
  await page.locator('#w4Date').fill('07/18/2026')
}

async function fillDisbursement(page: import('@playwright/test').Page) {
  await page.locator('#disbursementMethod').selectOption('check')
}

async function continueFromAcknowledgments(page: import('@playwright/test').Page) {
  // Golden Ages uses the same five acknowledgments as Individuals Choice,
  // rewritten for Golden Ages Home Care — each needs agree + initials + date.
  await expect(page.getByText('Step 7 of 8: Acknowledgments')).toBeVisible()
  const docs = page.locator('div.flex.flex-col.gap-4.rounded-\\[var\\(--radius-atria-md\\)\\]')
  const count = await docs.count()
  expect(count).toBeGreaterThanOrEqual(5)
  for (let i = 0; i < 5; i++) {
    const doc = docs.nth(i)
    await doc.getByRole('checkbox').check()
    await doc.locator('input').nth(1).fill('GA')
    await doc.locator('input').nth(2).fill('09/01/2026')
  }
  await page.getByRole('button', { name: /Save and continue/i }).click()
}

test.describe('Golden Ages built-in application flow', { tag: '@no-auth' }, () => {
  test('creates an account and lands on the built-in application', async ({ page }) => {
    test.setTimeout(120_000)
    await applyPublic(page)
    await setPasswordAndContinue(page)

    await expect(page.getByText('Job application')).toBeVisible({ timeout: 15000 })
    await expect(page.url()).not.toContain('application-dynamic')
  })

  test('generates the criminal record PDF in the review step and uses the DOJ background-check link', async ({ page }) => {
    test.setTimeout(300_000)
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text())
    })
    await applyPublic(page)
    await setPasswordAndContinue(page)

    await acceptJobDescriptionAndLegalValidity(page)

    await fillPersonalInfo(page)
    await page.getByRole('button', { name: /Save and continue/i }).click()

    await fillEmploymentAndReferences(page)
    await page.getByRole('button', { name: /Save and continue/i }).click()

    // Criminal record step: leave defaults (no convictions) and continue.
    await expect(page.getByText('Have you ever been convicted of a crime in California?')).toBeVisible()
    await page.getByRole('button', { name: /Save and continue/i }).click()

    await fillI9AndW4(page)
    await page.getByRole('button', { name: /Save and continue/i }).click()

    await fillDisbursement(page)
    await page.getByRole('button', { name: /Save and continue/i }).click()

    await continueFromAcknowledgments(page)

    // Review step: the criminal record (LIC 508) prefilled PDF should appear.
    await expect(page.getByText('Review & submit', { exact: true })).toBeVisible({ timeout: 15000 })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const lic508Text = page.getByText(/Criminal Record Statement \(LIC 508\)/i)
    await expect(lic508Text).toBeVisible({ timeout: 15000 })

    // Submit the application so the checklist becomes available.
    await page.getByRole('button', { name: /Submit application/i }).click()
    await page.waitForURL(/onboarding\/status|onboarding\/checklist/, { timeout: 45000 })

    // Background check upload page should show the DOJ external link for Golden Ages.
    await page.goto(`${BASE_URL}/onboarding/upload/background_check`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Complete DOJ background check/i)).toBeVisible({ timeout: 15000 })
    const dojLink = page.locator('a[href="https://oag.ca.gov/fingerprints/locations"]')
    await expect(dojLink).toBeVisible()
  })
})
