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
  signOut,
} from './helpers/auth'
import { callConvexMutation, callConvexQuery, resetE2ECandidate } from './helpers/seed'
import { e2eCredentialsAvailable, mockE2EEnabled } from './helpers/env'
import { attachCandidateDocumentForE2E, minimalPdfBuffer } from './helpers/upload'

async function uploadFile(page: import('@playwright/test').Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const input = page.locator('input[type="file"]').first()
  await input.setInputFiles(file)
}

async function acceptJobDescriptionAndLegalValidity(page: import('@playwright/test').Page) {
  // Step 1 of 8: job description + legal-validity consent (Session 29).
  await page.locator('#jdPositionApplyingFor').selectOption('Caregiver')
  await page.getByLabel('I have read and understand the job description').check()
  await page.getByLabel('I understand that typing my name').check()
  await page.getByRole('button', { name: /Save and continue/i }).click()
}

async function fillPersonalInfo(page: import('@playwright/test').Page) {
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

async function fillCriminalRecord(page: import('@playwright/test').Page) {
  // All checkboxes default to unchecked; no additional fields required.
  await expect(page.getByText('Have you ever been convicted of a crime in California?')).toBeVisible()
}

async function fillI9AndW4(page: import('@playwright/test').Page) {
  // I-9 Section 1
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

  // W-4
  await page.locator('#w4FirstName').fill('E2E')
  await page.locator('#w4LastName').fill('Candidate')
  await page.locator('#w4Address').fill('123 Main St')
  await page.locator('#cityStateZip').fill('San Jose, CA 95131')
  await page.locator('#w4Ssn').fill('123-45-6789')
  await page.locator('#filingStatus').selectOption('single')
  await page.locator('#w4Signature').fill('E2E Candidate')
  await page.locator('#w4Date').fill('07/18/2026')
}

async function fillDisbursement(page: import('@playwright/test').Page) {
  await page.locator('#disbursementMethod').selectOption('check')
}

// Walk every section after step 1 and submit the application. The transport
// radios (canTransportClients) must be set before calling this if the test
// exercises the car insurance flow.
async function completeApplicationAndSubmit(page: import('@playwright/test').Page) {
  await fillPersonalInfo(page)
  await page.getByRole('button', { name: /Save and continue/i }).click()

  await fillEmploymentAndReferences(page)
  await page.getByRole('button', { name: /Save and continue/i }).click()

  await fillCriminalRecord(page)
  await page.getByRole('button', { name: /Save and continue/i }).click()

  await fillI9AndW4(page)
  await page.getByRole('button', { name: /Save and continue/i }).click()

  await fillDisbursement(page)
  await page.getByRole('button', { name: /Save and continue/i }).click()

  await fillAcknowledgments(page)
  await page.getByRole('button', { name: /Save and continue/i }).click()

  await expect(page.getByText('Review & submit', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Submit application/i }).click()
  await page.waitForURL(/onboarding\/status/)
  await page.waitForLoadState('networkidle')
}

// Navigate to the HR review page for a candidate, recovering from the
// "ATRIA-X needs a refresh" interstitial when it appears.
async function gotoHrReviewPage(page: import('@playwright/test').Page, candidateId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto('about:blank')
    await page.waitForTimeout(500)
    await page.goto(`/hr/candidates/${candidateId}`)
    await page.waitForLoadState('domcontentloaded')
    const refreshBtn = page.getByRole('button', { name: 'Refresh app' })
    if (await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await refreshBtn.click()
      await page.waitForLoadState('domcontentloaded')
      continue
    }
    if (page.url().includes('/select-agency')) {
      await page.waitForTimeout(5000)
      continue
    }
    try {
      await expect(page.getByText('Application Review')).toBeVisible({ timeout: 15000 })
      return
    } catch {
      // Retry on next iteration.
    }
  }
  await expect(page.getByText('Application Review')).toBeVisible({ timeout: 30000 })
}

async function fillAcknowledgments(page: import('@playwright/test').Page) {
  const docs = ['jobDescription', 'employeeContract', 'employeeRights', 'hipaa', 'abuseNotice']
  for (const key of docs) {
    await page.locator(`#${key}-agreed`).check()
    await page.locator(`#${key}-initials`).fill('EC')
    await page.locator(`#${key}-date`).fill('07/18/2026')
  }
}

test.describe('onboarding application and document upload', { tag: '@auth' }, () => {
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

  test('candidate submits application, uploads signed documents, and HR reviews', async ({ page }) => {
    // This end-to-end journey (two sign-ins, full 8-section form, two UI
    // uploads, HR review) runs close to the default 120s budget against the
    // live dev backend; give it headroom so a slow Clerk/Convex round-trip
    // does not flake the run.
    test.setTimeout(300_000)
    // Candidate fills and submits the multi-section application.
    if (mockE2EEnabled()) {
      test.skip(true, 'This spec requires a live Clerk-backed candidate session for file uploads.')
    }

    await signInWithClerk(
      page,
      E2E_CANDIDATE_EMAIL,
      E2E_CANDIDATE_PASSWORD,
      E2E_ORG_ID,
      'org:candidate',
    )

    await page.goto('/onboarding/application')
    await page.waitForLoadState('networkidle')

    await acceptJobDescriptionAndLegalValidity(page)
    await fillPersonalInfo(page)
    await page.getByRole('button', { name: /Save and continue/i }).click()

    await fillEmploymentAndReferences(page)
    await page.getByRole('button', { name: /Save and continue/i }).click()

    await fillCriminalRecord(page)
    await page.getByRole('button', { name: /Save and continue/i }).click()

    await fillI9AndW4(page)
    await page.getByRole('button', { name: /Save and continue/i }).click()

    await fillDisbursement(page)
    await page.getByRole('button', { name: /Save and continue/i }).click()

    await fillAcknowledgments(page)
    await page.getByRole('button', { name: /Save and continue/i }).click()

    await expect(page.getByText('Review & submit', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Submit application/i }).click()
    await page.waitForURL(/onboarding\/status/)

    // The checklist enforces order: complete the upload steps that precede the
    // health screen (photo ID, tax ID, CPR) so the signed uploads are accepted.
    const candidateToken = await extractClerkToken(page)
    if (!candidateToken) throw new Error('Could not extract candidate session token.')
    // Wait for the form_submission task to be marked complete before uploading documents.
    await page.waitForTimeout(2000)
    await attachCandidateDocumentForE2E(candidateToken, E2E_ORG_ID, 'photo_id', 'Upload photo ID', '2027-12-31')
    await attachCandidateDocumentForE2E(candidateToken, E2E_ORG_ID, 'tax_id_ssn', 'Upload Tax ID or SSN')
    await attachCandidateDocumentForE2E(candidateToken, E2E_ORG_ID, 'cpr_certificate', 'Upload CPR certificate', '2027-12-31')

    // Upload signed health screen.
    await page.goto('/onboarding/upload/health_screen')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Upload signed health screen')).toBeVisible()
    await expect(page.getByRole('button', { name: /Download prefilled Health Screen form/i })).toBeVisible()

    await uploadFile(page, {
      name: 'signed_health_screen.pdf',
      mimeType: 'application/pdf',
      buffer: minimalPdfBuffer(),
    })
    await page.getByRole('button', { name: /Submit document/i }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/onboarding/upload'))

    // Upload stamped Live Scan receipt.
    await page.goto('/onboarding/upload/background_check')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Upload stamped Live Scan receipt')).toBeVisible()
    await expect(page.getByRole('button', { name: /Download prefilled Live Scan form/i })).toBeVisible()

    await uploadFile(page, {
      name: 'stamped_live_scan.pdf',
      mimeType: 'application/pdf',
      buffer: minimalPdfBuffer(),
    })
    await page.getByRole('button', { name: /Submit document/i }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/onboarding/upload'))

    await signOut(page)

    // HR reviews the application and documents.
    await signInWithClerk(page, E2E_HR_EMAIL, E2E_HR_PASSWORD, E2E_ORG_ID, 'org:hr')
    const hrToken = await extractClerkToken(page)
    if (!hrToken) throw new Error('Could not extract HR session token.')

    // Navigate to a blank page first to clear any stale state
    await page.goto('about:blank')
    await page.waitForTimeout(500)
    await page.goto(`/hr/candidates/${fixtureIds.candidateId}`)
    await page.waitForLoadState('networkidle')
    // Handle "ATRIA-X needs a refresh" by clicking the button and re-navigating
    for (let attempt = 0; attempt < 3; attempt++) {
      const refreshBtn = page.getByRole('button', { name: 'Refresh app' })
      if (await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await refreshBtn.click()
        await page.waitForLoadState('networkidle')
        await page.goto(`/hr/candidates/${fixtureIds.candidateId}`)
        await page.waitForLoadState('networkidle')
      } else {
        break
      }
    }

    await expect(page.getByText('Application Review')).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('Personal information')).toBeVisible()
    await expect(page.getByText('Employment history')).toBeVisible()
    await expect(page.getByText('References')).toBeVisible()

    // Prefilled documents section shows signed uploads.
    await expect(page.getByText('Health Screen (LIC 503)')).toBeVisible()
    await expect(page.getByText('Live Scan (LIC 9163)')).toBeVisible()
    await expect(page.getByText('Signed/stamped upload:').first()).toBeVisible()

    // Upload official background check result.
    const bgInput = page.locator('input[accept="application/pdf,image/*"]').first()
    await bgInput.setInputFiles({
      name: 'official_bg_result.pdf',
      mimeType: 'application/pdf',
      buffer: minimalPdfBuffer(),
    })
    await page.getByRole('button', { name: /Upload official result/i }).click()
    await expect(page.getByText('Official background check result uploaded')).toBeVisible({ timeout: 15000 })

    // Fill and save W-4 employer section.
    await page.getByLabel('EMPLOYER NAME').fill("Diego's Agency")
    await page.getByLabel('EIN').fill('12-3456789')
    await page.getByLabel('FIRST DATE OF EMPLOYMENT').fill('2026-08-01')
    await page.getByRole('button', { name: /Save employer section & regenerate W-4 PDF/i }).click()
    await expect(page.getByText('W-4 employer section saved')).toBeVisible({ timeout: 15000 })

    // Verify the candidate still has the signed prefilled document records.
    const prefilledDocs = (await callConvexQuery(
      hrToken,
      'candidates:getPrefilledDocuments',
      { clerkOrgId: E2E_ORG_ID, candidateId: fixtureIds.candidateId },
    )) as Array<{ documentType: string; uploadedSignedStorageId?: string }> | undefined
    const healthDoc = prefilledDocs?.find((d) => d.documentType === 'health_screen')
    const liveScanDoc = prefilledDocs?.find((d) => d.documentType === 'live_scan')
    expect(healthDoc?.uploadedSignedStorageId).toBeTruthy()
    expect(liveScanDoc?.uploadedSignedStorageId).toBeTruthy()
  })

  test('transport question shows mileage note and gates the car insurance checklist step', async ({ page }) => {
    if (mockE2EEnabled()) {
      test.skip(true, 'This spec requires a live Clerk-backed candidate session for file uploads.')
    }

    await signInWithClerk(
      page,
      E2E_CANDIDATE_EMAIL,
      E2E_CANDIDATE_PASSWORD,
      E2E_ORG_ID,
      'org:candidate',
    )

    await page.goto('/onboarding/application')
    await page.waitForLoadState('networkidle')
    await acceptJobDescriptionAndLegalValidity(page)

    // Session 30: the transport question appears in personal info, and
    // answering Yes reveals the mileage/insurance note (No hides it again).
    await expect(
      page.getByText('Do you plan to use your personal vehicle to transport clients?'),
    ).toBeVisible()
    await page.locator('#canTransportClients-yes').check()
    await expect(page.getByText(/reimbursed for mileage/)).toBeVisible()
    await page.locator('#canTransportClients-no').check()
    await expect(page.getByText(/reimbursed for mileage/)).toBeHidden()
    // Final answer: Yes — the car insurance checklist step must appear.
    await page.locator('#canTransportClients-yes').check()
    await expect(page.getByText(/reimbursed for mileage/)).toBeVisible()

    await completeApplicationAndSubmit(page)

    // The checklist shows the car insurance step when transport = Yes.
    await page.goto('/onboarding/checklist')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Your tasks')).toBeVisible()
    await expect(page.getByText('Car insurance policy')).toBeVisible()

    // The car insurance upload step requires an expiry date before submit.
    await page.goto('/onboarding/upload/car_insurance')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Car Insurance Policy' })).toBeVisible()
    const expiryInput = page.locator('#expiresAt')
    await expect(expiryInput).toBeVisible()
    const submitButton = page.getByRole('button', { name: /Submit document/i })
    await expect(submitButton).toBeDisabled()
    await uploadFile(page, {
      name: 'car_insurance_policy.pdf',
      mimeType: 'application/pdf',
      buffer: minimalPdfBuffer(),
    })
    // A file alone is not enough — the expiry date is mandatory.
    await expect(submitButton).toBeDisabled()
    await expiryInput.fill('01/31/2027')
    await expect(submitButton).toBeEnabled()
  })

  test('hides the car insurance checklist step when the applicant does not transport clients', async ({ page }) => {
    if (mockE2EEnabled()) {
      test.skip(true, 'This spec requires a live Clerk-backed candidate session.')
    }

    await signInWithClerk(
      page,
      E2E_CANDIDATE_EMAIL,
      E2E_CANDIDATE_PASSWORD,
      E2E_ORG_ID,
      'org:candidate',
    )

    await page.goto('/onboarding/application')
    await page.waitForLoadState('networkidle')
    await acceptJobDescriptionAndLegalValidity(page)

    await page.locator('#canTransportClients-no').check()
    await completeApplicationAndSubmit(page)

    await page.goto('/onboarding/checklist')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Your tasks')).toBeVisible()
    await expect(page.getByText('Car insurance policy')).toBeHidden()
  })

  test('HR can see car insurance status and expiry warnings', async ({ page }) => {
    if (mockE2EEnabled()) {
      test.skip(true, 'This spec requires a live Clerk-backed candidate session.')
    }

    await signInWithClerk(
      page,
      E2E_CANDIDATE_EMAIL,
      E2E_CANDIDATE_PASSWORD,
      E2E_ORG_ID,
      'org:candidate',
    )

    await page.goto('/onboarding/application')
    await page.waitForLoadState('networkidle')
    await acceptJobDescriptionAndLegalValidity(page)

    await page.locator('#canTransportClients-yes').check()
    await completeApplicationAndSubmit(page)

    // Upload the car insurance policy with an expiry 10 days out. The ordered
    // checklist requires every earlier step first, so complete them the same
    // way the main flow does.
    const candidateToken = await extractClerkToken(page)
    if (!candidateToken) throw new Error('Could not extract candidate session token.')
    // Wait for the form_submission task to be marked complete before uploading documents.
    await page.waitForTimeout(2000)
    await attachCandidateDocumentForE2E(candidateToken, E2E_ORG_ID, 'photo_id', 'Upload photo ID', '2027-12-31')
    await attachCandidateDocumentForE2E(candidateToken, E2E_ORG_ID, 'tax_id_ssn', 'Upload Tax ID or SSN')
    await attachCandidateDocumentForE2E(candidateToken, E2E_ORG_ID, 'cpr_certificate', 'Upload CPR certificate', '2027-12-31')
    await attachCandidateDocumentForE2E(candidateToken, E2E_ORG_ID, 'health_screen', 'Upload signed health screen')
    await attachCandidateDocumentForE2E(candidateToken, E2E_ORG_ID, 'background_check', 'Upload stamped Live Scan receipt')
    // Signing the acknowledgment completes the background check and the
    // employment agreement steps.
    await callConvexMutation(candidateToken, 'candidates:acknowledgeBackgroundCheck', {
      clerkOrgId: E2E_ORG_ID,
    })
    const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await attachCandidateDocumentForE2E(candidateToken, E2E_ORG_ID, 'car_insurance', 'Car Insurance Policy', expiresAt)

    await signOut(page)

    // HR sees the car insurance section with the expiring-soon warning.
    await signInWithClerk(page, E2E_HR_EMAIL, E2E_HR_PASSWORD, E2E_ORG_ID, 'org:hr')
    await gotoHrReviewPage(page, fixtureIds.candidateId)

    const section = page.getByTestId('car-insurance-section')
    await expect(section).toBeVisible()
    await expect(section.getByText('Yes')).toBeVisible()
    await expect(section.getByText('Uploaded')).toBeVisible()
    await expect(section.getByText('Expiring soon')).toBeVisible()
    await expect(
      section.getByText('This car insurance policy expires within 30 days. Request a renewed policy.'),
    ).toBeVisible()
  })
})
