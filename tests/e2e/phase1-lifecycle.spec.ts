import { test, expect } from '@playwright/test'
import {
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_COORDINATOR_EMAIL,
  E2E_COORDINATOR_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  resetE2EShifts,
  signInWithClerk,
  signOut,
} from './helpers/auth'

const CLIENT_NAME = 'Sam Lee'

test.describe.configure({ mode: 'serial' })

test.beforeAll(assertE2ECredentialsConfigured)

test('full caregiver-to-billing lifecycle with geofence disabled', async ({ page, context }) => {
  // Reset fixtures to a clean scheduled state with geofence disabled.
  await context.clearPermissions()
  await resetE2EShifts(page)

  // ---- Caregiver: clock in ----
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await page.goto('/caregiver/today')
  await expect(page).toHaveURL(/caregiver\/today/)

  const shiftCard = page.locator('[data-testid^="shift-card-"]', {
    hasText: CLIENT_NAME,
  })
  await expect(shiftCard).toBeVisible({ timeout: 15000 })

  // The button is a sibling of the card inside the same section wrapper.
  const shiftSection = shiftCard.locator('xpath=..')

  // Assert initial status word + color scoped to the target shift card.
  const statusBadge = shiftSection.locator('[data-testid="shift-status-badge"]')
  await expect(statusBadge).toHaveText('UPCOMING')
  await expect(statusBadge).toHaveClass(/bg-atria-info/)

  await shiftSection.locator('[data-testid="clock-in-start-button"]:visible').click()
  await expect(page.locator('[data-testid="shift-clock-in-screen"]')).toBeVisible()

  await page.locator('[data-testid="clock-in-button"]').click()
  await expect(page.locator('[data-testid="step-content-when"]')).toBeAttached({ timeout: 15000 })

  // ---- Complete 6-step note ----
  // Step 1: When (time inputs render after clicking Change)
  const whenStep = page.locator('[data-testid="step-content-when"]')
  await whenStep.locator('button:has-text("Change")').first().click()
  await page.locator('[data-testid="start-time-input"]').fill('09:00')
  await whenStep.locator('button:has-text("Change")').first().click()
  await page.locator('[data-testid="end-time-input"]').fill('13:00')
  await page.locator('[data-testid="wizard-next-button"]:visible').click()
  await expect(page.locator('[data-testid="step-content-what"]')).toBeAttached()

  // Step 2: What
  await page.locator('[data-testid="service-option-Bathing"]').click()
  await page.locator('[data-testid="wizard-next-button"]:visible').click()
  await expect(page.locator('[data-testid="step-content-how"]')).toBeAttached()

  // Step 3: How
  await page.locator('[data-testid="narrative-textarea"]').fill(
    'I helped Sam with a warm bath, breakfast, and light housekeeping. He was in good spirits and ate a full meal.',
  )
  await page.locator('[data-testid="wizard-next-button"]:visible').click()
  await expect(page.locator('[data-testid="step-content-goal"]')).toBeAttached()

  // Step 4: Goal
  await page.locator('[data-testid="goal-option-Walk a little each day"]').click({ force: true })
  await page.locator('[data-testid="wizard-next-button"]:visible').click()
  await expect(page.locator('[data-testid="step-content-issues"]')).toBeAttached()

  // Step 5: Issues + task proof
  await page.locator('[data-testid="issue-choice-no"]').click()
  const taskCheckbox = page.locator('[data-testid^="task-complete-checkbox-"]').first()
  await taskCheckbox.check()
  // Upload a tiny proof file
  const proofInput = page.locator('[data-testid^="task-proof-input-"]').first()
  await proofInput.setInputFiles({
    name: 'proof.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('shift proof'),
  })
  await expect(page.locator('text=proof.txt')).toBeVisible({ timeout: 10000 })
  await page.locator('[data-testid="wizard-next-button"]:visible').click()
  await expect(page.locator('[data-testid="step-content-done"]')).toBeAttached()

  // Step 6: Done / confirm
  // Clock Out (via the wizard submit button) is disabled until the note is complete.
  const nextButton = page.locator('[data-testid="wizard-next-button"]:visible')
  await expect(nextButton).toBeDisabled()

  await page.locator('[data-testid="confirm-checkbox"]').check()
  await expect(nextButton).toBeEnabled()

  await nextButton.click()
  await expect(page.locator('[data-testid="shift-clock-out-screen"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-testid="complete-checklist"]')).toBeVisible()
  const clockOutButton = page.locator('[data-testid="clock-out-button"]')
  await expect(clockOutButton).toBeEnabled()

  // ---- Clock out / submit ----
  await clockOutButton.click()
  await expect(page.locator('[data-testid="shift-success-screen"]')).toBeVisible({ timeout: 15000 })

  // ---- Coordinator: request correction ----
  await signOut(page)
  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
  await page.goto('/coordinator/review')
  await expect(page).toHaveURL(/coordinator\/review/)
  await page.reload()
  await expect(page.locator('[data-testid="filter-pending"]')).toBeVisible({ timeout: 15000 })

  const reviewRow = page.locator('[data-testid^="review-row-"][data-shift-status="submitted"]', {
    hasText: CLIENT_NAME,
  })
  await expect(reviewRow).toBeVisible({ timeout: 15000 })
  await expect(reviewRow).toHaveAttribute('data-shift-status', 'submitted')
  const reviewStatus = reviewRow.locator('[data-testid="review-status-badge"]')
  await expect(reviewStatus).toHaveText('Submitted')
  await expect(reviewStatus).toHaveClass(/bg-atria-info/)

  await reviewRow.locator('button:has-text("Review")').click()
  await expect(page.locator('[data-testid="review-comment-input"]')).toBeVisible()
  await page.locator('[data-testid="review-comment-input"]').fill('Please add the exact start time.')
  await page.locator('[data-testid="request-correction-button"]').click()

  // Wait to return to queue, then switch to the returned filter where correction rows live.
  await page.locator('[data-testid="filter-returned"]:visible').click()
  const returnedRow = page.locator('[data-testid^="review-row-"][data-shift-status="needs_correction"]', { hasText: CLIENT_NAME })
  await expect(returnedRow).toBeVisible({ timeout: 15000 })
  await expect(returnedRow).toHaveAttribute('data-shift-status', 'needs_correction')
  const returnedStatus = returnedRow.locator('[data-testid="review-status-badge"]')
  await expect(returnedStatus).toHaveText('Needs correction')
  await expect(returnedStatus).toHaveClass(/bg-atria-danger/)

  // ---- Caregiver: fix and resubmit ----
  await signOut(page)
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await page.goto('/caregiver/today')
  await expect(page).toHaveURL(/caregiver\/today/)

  const correctionCard = page.locator('[data-testid^="shift-card-"]', { hasText: CLIENT_NAME })
  await expect(correctionCard.locator('[data-testid="shift-status-badge"]')).toHaveText('CORRECTION')
  await expect(correctionCard.locator('[data-testid="shift-status-badge"]')).toHaveClass(/bg-atria-danger/)
  const correctionSection = correctionCard.locator('xpath=..')

  // The original clock-in/out punches are preserved; the caregiver resumes directly to the note.
  await correctionSection.locator('[data-testid="clock-in-start-button"]:visible').click()
  await expect(page.locator('[data-testid="step-content-when"]')).toBeVisible({ timeout: 15000 })

  const correctionWhen = page.locator('[data-testid="step-content-when"]:visible')
  await correctionWhen.locator('button:has-text("Change")').first().click()
  await page.locator('[data-testid="start-time-input"]').fill('09:15')
  // The remaining steps already contain valid values from the original note;
  // advance through them one at a time until the confirmation step.
  await page.locator('[data-testid="wizard-next-button"]:visible').click()
  await expect(page.locator('[data-testid="step-content-what"]')).toBeAttached()
  await page.locator('[data-testid="wizard-next-button"]:visible').click()
  await expect(page.locator('[data-testid="step-content-how"]')).toBeAttached()
  await page.locator('[data-testid="wizard-next-button"]:visible').click()
  await expect(page.locator('[data-testid="step-content-goal"]')).toBeAttached()
  await page.locator('[data-testid="wizard-next-button"]:visible').click()
  await expect(page.locator('[data-testid="step-content-issues"]')).toBeAttached()
  await page.locator('[data-testid="wizard-next-button"]:visible').click()
  await expect(page.locator('[data-testid="step-content-done"]')).toBeAttached({ timeout: 15000 })
  await page.locator('[data-testid="confirm-checkbox"]').check()
  await page.locator('[data-testid="wizard-next-button"]:visible').click()

  // The existing clock-out punch is reused, so no new geolocation is required.
  await expect(page.locator('[data-testid="shift-clock-out-screen"]')).toBeVisible({ timeout: 15000 })
  const resubmitClockOutButton = page.locator('[data-testid="clock-out-button"]')
  await expect(resubmitClockOutButton).toBeEnabled()
  await resubmitClockOutButton.click()
  await expect(page.locator('[data-testid="shift-success-screen"]')).toBeVisible({ timeout: 15000 })

  // ---- Coordinator: approve -> billing ready ----
  await signOut(page)
  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
  await page.goto('/coordinator/review')
  await expect(page).toHaveURL(/coordinator\/review/)

  const resubmittedRow = page.locator('[data-testid^="review-row-"][data-shift-status="submitted"]', { hasText: CLIENT_NAME })
  await expect(resubmittedRow).toBeVisible({ timeout: 15000 })
  await expect(resubmittedRow).toHaveAttribute('data-shift-status', 'submitted')
  const resubmittedStatus = resubmittedRow.locator('[data-testid="review-status-badge"]')
  await expect(resubmittedStatus).toHaveText('Submitted')
  await expect(resubmittedStatus).toHaveClass(/bg-atria-info/)

  await resubmittedRow.locator('button:has-text("Review")').click()
  await expect(page.locator('[data-testid="approve-button"]')).toBeVisible()
  await page.locator('[data-testid="approve-button"]').click()

  // Approved shifts appear under the Approved filter and are billing_ready.
  await page.locator('[data-testid="filter-approved"]:visible').click()
  const approvedRow = page.locator('[data-testid^="review-row-"][data-shift-status="billing_ready"]', { hasText: CLIENT_NAME })
  await expect(approvedRow).toBeVisible({ timeout: 15000 })
  await expect(approvedRow).toHaveAttribute('data-shift-status', 'billing_ready')
  const approvedStatus = approvedRow.locator('[data-testid="review-status-badge"]')
  await expect(approvedStatus).toHaveText('Approved')
  await expect(approvedStatus).toHaveClass(/bg-atria-success/)
})
