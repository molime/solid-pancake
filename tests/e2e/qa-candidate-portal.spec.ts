// Focused QA verification spec for candidate-portal items 2-6:
//   2. Position persistence from /apply into the application form (step 0)
//   3. ProgressSteps stepper layout/overflow (desktop + 375px)
//   4. SSN/ITIN dynamic label on the Personal Info step
//   5. "Skip this step" on additional certifications -> "Skipped" badge
//   6. "Candidate Portal" subtitle on all candidate-facing pages
// Run with: node scripts/run-playwright-with-env.js qa-candidate-portal --project=chromium
import { test, expect, type Page } from '@playwright/test'
import {
  E2E_CANDIDATE_EMAIL,
  E2E_CANDIDATE_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  signInWithClerk,
} from './helpers/auth'
import { resetE2ECandidate } from './helpers/seed'
import { e2eCredentialsAvailable, mockE2EEnabled } from './helpers/env'

async function fetchAgencySlug(): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) throw new Error('CLERK_SECRET_KEY not set')
  const response = await fetch(`https://api.clerk.com/v1/organizations/${E2E_ORG_ID}`, {
    headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Clerk org lookup failed: ${response.status}`)
  const json = (await response.json()) as { slug?: string }
  return json.slug ?? E2E_ORG_ID
}

async function circleBox(nav: ReturnType<Page['locator']>, index: number) {
  const circle = nav.locator('li').nth(index).locator('div.rounded-full').first()
  return circle.boundingBox()
}

test.describe('QA candidate portal items 2-6', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    if (!e2eCredentialsAvailable() && !mockE2EEnabled()) {
      assertE2ECredentialsConfigured()
    }
  })

  test('items 2, 3, 4: apply flow preserves position, stepper layout, SSN/ITIN label', async ({ page }) => {
    test.setTimeout(300_000)
    if (mockE2EEnabled()) {
      test.skip(true, 'Requires a live Clerk-backed session.')
    }

    const slug = await fetchAgencySlug()
    console.log('QA item 2: agency slug =', slug)

    // --- /apply entry flow -------------------------------------------------
    await page.goto(`/apply?agency=${slug}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /Apply to join/i })).toBeVisible({ timeout: 30000 })

    const email = `e2e.qa.apply.${Date.now()}@atriax.example.com`
    await page.locator('#fullName').fill('QA Apply Candidate')
    await page.locator('#email').fill(email)
    await page.locator('#phone').fill('(555) 123-4567')

    // Multi-branch agencies ask for a branch before showing positions.
    const branchPrompt = page.getByText('Which branch are you applying to?')
    if (await branchPrompt.isVisible().catch(() => false)) {
      await page
        .locator('xpath=//p[contains(.,"Which branch are you applying to?")]/following-sibling::div//button[1]')
        .click()
    }

    const positionSelect = page.locator('#applyPosition')
    await expect(positionSelect).toBeVisible({ timeout: 15000 })
    const firstOptionValue = await positionSelect.locator('option').nth(1).getAttribute('value')
    console.log('QA item 2: selecting position =', firstOptionValue)
    await positionSelect.selectOption(firstOptionValue)

    await page.getByRole('button', { name: /Start application/i }).click()

    // New-account success screen: skip password setup and use the sign-in link.
    await expect(page.getByText(/Application started!|already applied/i)).toBeVisible({ timeout: 30000 })
    const skipPassword = page.getByRole('button', { name: /Skip for now and use sign-in link instead/i })
    if (await skipPassword.isVisible().catch(() => false)) {
      await skipPassword.click()
    } else {
      await page.getByRole('button', { name: /Sign in now/i }).click()
    }

    // Ticket redemption lands somewhere inside the app.
    await expect(page).not.toHaveURL(/apply\?/, { timeout: 60000 })
    await page.waitForLoadState('networkidle')
    if (page.url().includes('/select-agency')) {
      const agencyButton = page.locator('button', { hasText: /Role:/ }).first()
      if (await agencyButton.isVisible().catch(() => false)) {
        await agencyButton.click()
        await expect(page).not.toHaveURL(/select-agency/, { timeout: 30000 })
      }
    }

    // --- Item 2: position pre-selected on application form step 0 ----------
    await page.goto('/onboarding/application')
    await page.waitForLoadState('networkidle')
    const jdPosition = page.locator('#jdPositionApplyingFor')
    await expect(jdPosition).toBeVisible({ timeout: 30000 })
    await expect(jdPosition).toHaveValue(firstOptionValue ?? '', { timeout: 30000 })
    console.log('QA item 2 PASS: position pre-selected =', await jdPosition.inputValue())

    // --- Item 3: ProgressSteps layout --------------------------------------
    const stepper = page.locator('nav[aria-label="Progress"]')
    await expect(stepper).toBeVisible()

    // Desktop: 32px circles, labels visible, overflow-x-auto on the nav.
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.waitForTimeout(300)
    const desktopCircle = await circleBox(stepper, 0)
    console.log('QA item 3: desktop circle box =', desktopCircle)
    expect(Math.round(desktopCircle?.width ?? 0)).toBe(32)
    expect(Math.round(desktopCircle?.height ?? 0)).toBe(32)
    await expect(stepper.getByText('Job description')).toBeVisible()
    await expect(stepper.getByText('Review & submit')).toBeVisible()
    const overflowX = await stepper.evaluate((el) => getComputedStyle(el).overflowX)
    expect(overflowX).toBe('auto')

    // Mobile 375px: labels hidden, circles still 32px, no page-level overflow.
    await page.setViewportSize({ width: 375, height: 800 })
    await page.waitForTimeout(300)
    const mobileCircle = await circleBox(stepper, 0)
    console.log('QA item 3: mobile circle box =', mobileCircle)
    expect(Math.round(mobileCircle?.width ?? 0)).toBe(32)
    expect(Math.round(mobileCircle?.height ?? 0)).toBe(32)
    await expect(stepper.getByText('Job description')).toBeHidden()
    const pageScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    console.log('QA item 3: 375px scrollWidth =', pageScrollWidth)
    expect(pageScrollWidth).toBeLessThanOrEqual(375)
    console.log('QA item 3 PASS: stepper fits at 375px with overflow-x-auto')

    // --- Item 4: SSN/ITIN dynamic label ------------------------------------
    await page.setViewportSize({ width: 1280, height: 800 })
    // Finish step 0 to reach Personal Info.
    await page.getByLabel('I have read and understand the job description').check()
    await page.getByLabel('I understand that typing my name').check()
    await page.getByRole('button', { name: /Save and continue/i }).click()

    const ssnLabel = page.locator('label[for="ssn"]')
    await expect(ssnLabel).toBeVisible({ timeout: 15000 })
    await expect(ssnLabel).toContainText('SSN / ITIN')
    await page.locator('#idType').selectOption('ssn')
    await expect(ssnLabel).toContainText('SSN')
    await expect(ssnLabel).not.toContainText('SSN / ITIN')
    await page.locator('#idType').selectOption('itin')
    await expect(ssnLabel).toContainText('ITIN')
    await expect(ssnLabel).not.toContainText('SSN / ITIN')
    console.log('QA item 4 PASS: SSN/ITIN label switches dynamically')
  })

  test('item 5: skip additional certifications shows Skipped badge on checklist', async ({ page }) => {
    test.setTimeout(180_000)
    if (mockE2EEnabled()) {
      test.skip(true, 'Requires a live Clerk-backed session.')
    }

    await resetE2ECandidate(page)
    await signInWithClerk(page, E2E_CANDIDATE_EMAIL, E2E_CANDIDATE_PASSWORD, E2E_ORG_ID, 'org:candidate')

    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('BROWSER CONSOLE ERROR:', msg.text())
    })

    await page.goto('/onboarding/upload/additional_certifications')
    await page.waitForLoadState('networkidle')
    const skipButton = page.getByRole('button', { name: /Skip this step/i })
    await expect(skipButton).toBeVisible({ timeout: 30000 })
    // Debug: report how soon after navigation the skip button is clicked, and
    // whether the tasks query had resolved (the skip is a silent no-op when
    // the task row has not loaded yet).
    await skipButton.click()
    await page.waitForTimeout(2000)
    const { extractClerkToken } = await import('./helpers/auth')
    const { callConvexQuery } = await import('./helpers/seed')
    const token = await extractClerkToken(page)
    const tasksAfter = (await callConvexQuery(token!, 'candidates:listCandidateTasks', {
      clerkOrgId: E2E_ORG_ID,
    })) as Array<{ type: string; status: string }>
    console.log(
      'QA item 5 DEBUG task statuses after skip:',
      JSON.stringify(tasksAfter.map((t) => `${t.type}:${t.status}`)),
    )

    await expect(page).toHaveURL(/onboarding/, { timeout: 30000 })
    await page.goto('/onboarding/checklist')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Your tasks')).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('Skipped optional steps')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Additional certifications')).toBeVisible()
    await expect(page.getByText('Skipped', { exact: true })).toBeVisible()
    console.log('QA item 5 PASS: skipped task shows Skipped badge')
  })

  test('item 6: candidate-facing pages show "Candidate Portal" subtitle', async ({ page }) => {
    test.setTimeout(180_000)
    if (mockE2EEnabled()) {
      test.skip(true, 'Requires a live Clerk-backed session.')
    }

    await resetE2ECandidate(page)
    await signInWithClerk(page, E2E_CANDIDATE_EMAIL, E2E_CANDIDATE_PASSWORD, E2E_ORG_ID, 'org:candidate')

    // portalLabel: 'required' = must show "Candidate Portal"; 'or-empty' =
    // legit empty state without a logo is acceptable (offer page when no offer
    // is pending); 'record' = subtitle is recorded but not asserted (training
    // shows "Required Training" by design).
    const routes: Array<{ path: string; portalLabel: 'required' | 'or-empty' | 'record' }> = [
      { path: '/onboarding/checklist', portalLabel: 'required' },
      { path: '/onboarding/application', portalLabel: 'required' },
      { path: '/onboarding/status', portalLabel: 'required' },
      { path: '/onboarding/upload/photo_id', portalLabel: 'required' },
      { path: '/onboarding/acknowledgment', portalLabel: 'required' },
      { path: '/onboarding/employment-agreement', portalLabel: 'required' },
      { path: '/onboarding/profile', portalLabel: 'required' },
      { path: '/onboarding/offer', portalLabel: 'or-empty' },
      { path: '/onboarding/training', portalLabel: 'record' },
    ]

    const results: string[] = []
    for (const route of routes) {
      await page.goto(route.path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
      const landed = page.url()
      const portalVisible = await page
        .getByText('Candidate Portal', { exact: true })
        .first()
        .isVisible()
        .catch(() => false)
      const emptyStateVisible = await page
        .getByText(/No pending offer|There is no offer available/i)
        .first()
        .isVisible()
        .catch(() => false)
      // The old label must never appear as the subtitle under the logo.
      const oldLabelVisible = await page
        .getByText('Onboarding', { exact: true })
        .first()
        .isVisible()
        .catch(() => false)
      results.push(
        `${route.path} -> ${landed} | Candidate Portal: ${portalVisible} | empty state: ${emptyStateVisible} | bare "Onboarding" text: ${oldLabelVisible}`,
      )
      expect(oldLabelVisible).toBe(false)
      if (route.portalLabel === 'required' && landed.includes(route.path)) {
        expect(portalVisible).toBe(true)
      }
      if (route.portalLabel === 'or-empty' && landed.includes(route.path)) {
        expect(portalVisible || emptyStateVisible).toBe(true)
      }
    }
    console.log('QA item 6 results:\n' + results.join('\n'))
  })
})
