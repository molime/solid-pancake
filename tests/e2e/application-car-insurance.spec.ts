import { test, expect } from '@playwright/test'
import {
  E2E_CANDIDATE_EMAIL,
  E2E_CANDIDATE_PASSWORD,
  E2E_HR_EMAIL,
  E2E_HR_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  extractClerkToken,
  signInWithClerk,
} from './helpers/auth'
import { callConvexMutation, resetE2ECandidate } from './helpers/seed'
import { e2eCredentialsAvailable, mockE2EEnabled } from './helpers/env'
import { attachCandidateDocumentForE2E, minimalPdfBuffer } from './helpers/upload'

const MILEAGE_NOTE = 'reimbursed for mileage'

function datePlusDays(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

async function acceptJobDescriptionAndLegalValidity(page: import('@playwright/test').Page) {
  await page.locator('#jdPositionApplyingFor').selectOption('Caregiver')
  await page.getByLabel('I have read and understand the job description').check()
  await page.getByLabel('I understand that typing my name').check()
  await page.getByRole('button', { name: /Save and continue/i }).click()
}

async function fillPersonalInfo(page: import('@playwright/test').Page, transport: boolean) {
  await page.getByLabel('First name').fill('E2E')
  await page.getByLabel('Last name').fill('Candidate')
  await page.locator('#idType').selectOption('ssn')
  await page.getByLabel('SSN').fill('123-45-6789')
  await page.getByLabel('Street address').fill('123 Main St')
  await page.getByLabel('Apt / suite').fill('Apt 1')
  await page.getByLabel('City').first().fill('San Jose')
  await page.locator('#state').first().selectOption('CA')
  await page.getByLabel('ZIP').first().fill('95131')
  await page.getByLabel('Home phone').fill('555-111-2222')
  await page.getByLabel('Cell phone').fill('555-333-4444')
  await page.locator('#email').fill(E2E_CANDIDATE_EMAIL)
  await page.locator('#dateOfBirth').fill('06/15/1990')
  await page.locator('#gender').selectOption('female')
  await page.locator('#availability').selectOption('full_time')
  await page.locator('#shift-morning').check()
  await page.locator('#day-monday').check()
  await page.locator('#day-tuesday').check()
  await page.getByLabel('I am 18 years of age or older').check()
  await page.locator(transport ? '#canTransportClients-yes' : '#canTransportClients-no').check()
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
  await page.locator('#i9LastName').fill('Candidate')
  await page.locator('#i9FirstName').fill('E2E')
  await page.locator('#i9Address').fill('123 Main St')
  await page.locator('#i9City').fill('San Jose')
  await page.locator('#i9State').selectOption('CA')
  await page.locator('#i9Zip').fill('95131')
  await page.locator('#i9DateOfBirth').fill('06/15/1990')
  await page.locator('#i9Ssn').fill('123-45-6789')
  await page.locator('#citizenshipStatus').selectOption('citizen')
  await page.locator('#i9Signature').fill('E2E Candidate')
  await page.locator('#i9Date').fill('07/18/2026')

  await page.locator('#w4FirstName').fill('E2E')
  await page.locator('#w4LastName').fill('Candidate')
  await page.locator('#w4Address').fill('123 Main St')
  await page.locator('#cityStateZip').fill('San Jose, CA 95131')
  await page.locator('#w4Ssn').fill('123-45-6789')
  await page.locator('#filingStatus').selectOption('single')
  await page.locator('#w4Signature').fill('E2E Candidate')
  await page.locator('#w4Date').fill('07/18/2026')
}

async function fillAcknowledgments(page: import('@playwright/test').Page) {
  const docs = ['jobDescription', 'employeeContract', 'employeeRights', 'hipaa', 'abuseNotice']
  for (const key of docs) {
    await page.locator(`#${key}-agreed`).check()
    await page.locator(`#${key}-initials`).fill('EC')
    await page.locator(`#${key}-date`).fill('07/18/2026')
  }
}

async function submitApplication(page: import('@playwright/test').Page, transport: boolean) {
  await page.goto('/onboarding/application')
  await page.waitForLoadState('networkidle')

  await acceptJobDescriptionAndLegalValidity(page)
  await fillPersonalInfo(page, transport)
  await page.getByRole('button', { name: /Save and continue/i }).click()

  await fillEmploymentAndReferences(page)
  await page.getByRole('button', { name: /Save and continue/i }).click()

  await expect(page.getByText('Have you ever been convicted of a crime in California?')).toBeVisible()
  await page.getByRole('button', { name: /Save and continue/i }).click()

  await fillI9AndW4(page)
  await page.getByRole('button', { name: /Save and continue/i }).click()

  await page.locator('#disbursementMethod').selectOption('check')
  await page.getByRole('button', { name: /Save and continue/i }).click()

  await fillAcknowledgments(page)
  await page.getByRole('button', { name: /Save and continue/i }).click()

  await expect(page.getByText('Review & submit', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Submit application/i }).click()
  await page.waitForURL(/onboarding\/status/)
}

// Complete every required task that precedes car_insurance so the policy can
// be uploaded, exactly like a candidate who finished the earlier steps.
async function completePrecedingTasks(token: string) {
  await attachCandidateDocumentForE2E(token, E2E_ORG_ID, 'photo_id', 'Upload photo ID', datePlusDays(365))
  await attachCandidateDocumentForE2E(token, E2E_ORG_ID, 'tax_id_ssn', 'Upload Tax ID or SSN')
  await attachCandidateDocumentForE2E(token, E2E_ORG_ID, 'cpr_certificate', 'Upload CPR certificate', datePlusDays(365))
  await attachCandidateDocumentForE2E(token, E2E_ORG_ID, 'health_screen', 'Upload signed health screen')
  await attachCandidateDocumentForE2E(token, E2E_ORG_ID, 'background_check', 'Upload stamped Live Scan receipt')
  // Completes employment_agreement (background_check must be uploaded first).
  await callConvexMutation(token, 'candidates:acknowledgeBackgroundCheck', {
    clerkOrgId: E2E_ORG_ID,
  })
}

async function openHrReviewPage(
  page: import('@playwright/test').Page,
  candidateId: string,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto('about:blank')
    await page.waitForTimeout(500)
    await page.goto(`/hr/candidates/${candidateId}`)
    await page.waitForLoadState('domcontentloaded')
    // Handle "ATRIA-X needs a refresh" interstitial.
    const refreshBtn = page.getByRole('button', { name: 'Refresh app' })
    if (await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await refreshBtn.click()
      await page.waitForLoadState('domcontentloaded')
      continue
    }
    // If redirected to /select-agency, wait for auto-select to complete.
    if (page.url().includes('/select-agency')) {
      await page.waitForTimeout(5000)
      continue
    }
    // If on the HR page, wait for content.
    try {
      await expect(page.getByText('Application Review')).toBeVisible({ timeout: 15000 })
      return
    } catch {
      // Retry on next iteration.
    }
  }
  await expect(page.getByText('Application Review')).toBeVisible({ timeout: 30000 })
}

test.describe('application car insurance (transport clients)', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    if (!e2eCredentialsAvailable() && !mockE2EEnabled()) {
      assertE2ECredentialsConfigured()
    }
  })

  let fixtureIds: Awaited<ReturnType<typeof resetE2ECandidate>>

  test.beforeEach(async ({ page }) => {
    fixtureIds = await resetE2ECandidate(page)
  })

  test('transport question appears and toggles the mileage note', async ({ page }) => {
    if (mockE2EEnabled()) {
      test.skip(true, 'This spec requires a live Clerk-backed candidate session.')
    }

    await signInWithClerk(page, E2E_CANDIDATE_EMAIL, E2E_CANDIDATE_PASSWORD, E2E_ORG_ID, 'org:candidate')
    await page.goto('/onboarding/application')
    await page.waitForLoadState('networkidle')
    await acceptJobDescriptionAndLegalValidity(page)

    await expect(
      page.getByText('Do you plan to use your personal vehicle to transport clients?'),
    ).toBeVisible()
    await expect(page.getByText(MILEAGE_NOTE)).toBeHidden()

    await page.locator('#canTransportClients-yes').check()
    await expect(page.getByText(MILEAGE_NOTE)).toBeVisible()

    await page.locator('#canTransportClients-no').check()
    await expect(page.getByText(MILEAGE_NOTE)).toBeHidden()
  })

  test('car_insurance step, expiry upload, and HR expiry warnings for transport=Yes', async ({
    page,
    browser,
  }) => {
    if (mockE2EEnabled()) {
      test.skip(true, 'This spec requires a live Clerk-backed candidate session.')
    }

    await signInWithClerk(page, E2E_CANDIDATE_EMAIL, E2E_CANDIDATE_PASSWORD, E2E_ORG_ID, 'org:candidate')
    await submitApplication(page, true)

    // The conditional checklist step is present when transport = Yes.
    await page.goto('/onboarding/checklist')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Your tasks')).toBeVisible()
    await expect(page.getByRole('button', { name: /Car insurance policy/ })).toBeVisible()

    // Finish the required preceding steps, then upload the policy in the UI.
    let candidateToken = await extractClerkToken(page)
    if (!candidateToken) throw new Error('Could not extract candidate session token.')
    await page.waitForTimeout(2000)
    await completePrecedingTasks(candidateToken)

    await page.goto('/onboarding/upload/car_insurance')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Car Insurance Policy' })).toBeVisible()
    await expect(page.getByLabel('EXPIRY DATE')).toBeVisible()

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'car_insurance.pdf',
      mimeType: 'application/pdf',
      buffer: minimalPdfBuffer(),
    })
    await page.locator('#expiresAt').fill(datePlusDays(60))
    await page.getByRole('button', { name: /Submit document/i }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/onboarding/upload'))

    // HR sees a green "Valid" badge for a policy expiring beyond 30 days.
    const hrContext = await browser.newContext()
    const hrPage = await hrContext.newPage()
    try {
      await signInWithClerk(hrPage, E2E_HR_EMAIL, E2E_HR_PASSWORD, E2E_ORG_ID, 'org:hr')
      await openHrReviewPage(hrPage, fixtureIds.candidateId)
      const section = hrPage.getByTestId('car-insurance-section')
      await expect(section).toBeVisible()
      await expect(section.getByText('Valid', { exact: true })).toBeVisible()
      await expect(section.getByText('Uploaded', { exact: true })).toBeVisible()

      // Re-upload with an expiry inside 30 days -> yellow "Expiring soon".
      candidateToken = await extractClerkToken(page)
      if (!candidateToken) throw new Error('Could not extract candidate session token.')
      await attachCandidateDocumentForE2E(
        candidateToken,
        E2E_ORG_ID,
        'car_insurance',
        'Car Insurance Policy',
        datePlusDays(20),
      )
      await hrPage.reload()
      await hrPage.waitForLoadState('networkidle')
      await expect(section.getByText('Expiring soon', { exact: true })).toBeVisible({
        timeout: 30000,
      })
      await expect(section.getByText(/expires within 30 days/)).toBeVisible()

      // Re-upload with a past expiry -> red "Expired".
      candidateToken = await extractClerkToken(page)
      if (!candidateToken) throw new Error('Could not extract candidate session token.')
      await attachCandidateDocumentForE2E(
        candidateToken,
        E2E_ORG_ID,
        'car_insurance',
        'Car Insurance Policy',
        datePlusDays(-5),
      )
      await hrPage.reload()
      await hrPage.waitForLoadState('networkidle')
      await expect(section.getByText('Expired', { exact: true })).toBeVisible({ timeout: 30000 })
      await expect(section.getByText(/has expired/)).toBeVisible()
    } finally {
      await hrContext.close()
    }
  })

  test('car_insurance step is hidden and HR shows Not applicable for transport=No', async ({
    page,
    browser,
  }) => {
    if (mockE2EEnabled()) {
      test.skip(true, 'This spec requires a live Clerk-backed candidate session.')
    }

    await signInWithClerk(page, E2E_CANDIDATE_EMAIL, E2E_CANDIDATE_PASSWORD, E2E_ORG_ID, 'org:candidate')
    await submitApplication(page, false)

    await page.goto('/onboarding/checklist')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Your tasks')).toBeVisible()
    await expect(page.getByText('Photo ID').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Car insurance policy/ })).toBeHidden()

    const hrContext = await browser.newContext()
    const hrPage = await hrContext.newPage()
    try {
      await signInWithClerk(hrPage, E2E_HR_EMAIL, E2E_HR_PASSWORD, E2E_ORG_ID, 'org:hr')
      await openHrReviewPage(hrPage, fixtureIds.candidateId)
      const section = hrPage.getByTestId('car-insurance-section')
      await expect(section).toBeVisible()
      await expect(section.getByText('Not applicable', { exact: true })).toBeVisible()
      await expect(section.getByText('No', { exact: true })).toBeVisible()
    } finally {
      await hrContext.close()
    }
  })
})
