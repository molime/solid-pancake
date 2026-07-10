import { test, expect } from '@playwright/test'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  extractClerkToken,
  signInWithClerk,
  signOut,
} from './helpers/auth'
import {
  callConvexMutation,
  callConvexQuery,
  getE2EUserIds,
  resetE2ECandidate,
} from './helpers/seed'

function formatDateInput(d: Date): string {
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function nextMonday(from: Date): Date {
  const d = new Date(from)
  const day = d.getDay()
  const diff = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

test.describe('scheduling flow', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(assertE2ECredentialsConfigured)

  let userIds: Awaited<ReturnType<typeof getE2EUserIds>>

  test.beforeEach(async ({ page }) => {
    await resetE2ECandidate(page)
    userIds = await getE2EUserIds()
  })

  test('admin creates shift, conflict detection, availability warning, coverage resolved', async ({
    page,
  }) => {
    // Pick a Monday far enough in the future that no leftover demo shifts exist.
    const monday = nextMonday(addDays(new Date(), 365))
    const mondayStr = formatDateInput(monday)
    const tuesdayStr = formatDateInput(addDays(monday, 1))

    await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID, 'org:admin')
    await page.goto('/scheduling')
    await expect(page).toHaveURL(/scheduling/)
    await page.waitForLoadState('networkidle')

    const adminToken = await extractClerkToken(page)
    if (!adminToken) throw new Error('Could not extract admin session token.')

    // Remove any previously-scheduled fixture/demo shifts for the caregiver and
    // coordinator so the conflict-detection and coverage-resolution steps are
    // deterministic.
    async function cleanupShiftsFor(token: string, caregiverId: string) {
      const shifts = (((await callConvexQuery(
        token,
        'scheduling:listShifts',
        {
          clerkOrgId: E2E_ORG_ID,
          caregiverId,
          status: 'scheduled',
        },
      )) as { items?: Array<{ _id: string }> } | null)?.items) ?? []
      for (const shift of shifts) {
        try {
          await callConvexMutation(token, 'scheduling:deleteShift', {
            clerkOrgId: E2E_ORG_ID,
            shiftId: shift._id,
          })
        } catch {
          // best-effort cleanup
        }
      }
    }
    await cleanupShiftsFor(adminToken, userIds.caregiverUserId)
    await cleanupShiftsFor(adminToken, userIds.coordinatorUserId)

    // First shift: should succeed and show availability coverage.
    await page.locator('[data-testid="add-shift-button"]').first().click()
    await page
      .locator('[data-testid="shift-client-select"]')
      .selectOption({ label: 'Phase 2 Client' })
    await page
      .locator('[data-testid="shift-caregiver-select"]')
      .selectOption(userIds.caregiverUserId)
    await page.locator('[data-testid="shift-date-input"]').fill(mondayStr)
    await page.locator('[data-testid="shift-start-input"]').fill('10:00')
    await page.locator('[data-testid="shift-end-input"]').fill('14:00')
    await expect(
      page.locator('[data-testid="availability-banner"]'),
    ).toContainText('Eligible — safe to schedule', { timeout: 15000 })
    await page.locator('[data-testid="save-shift-button"]').click()
    await expect(page.locator('text=Shift created')).toBeVisible({
      timeout: 15000,
    })

    // Overlapping shift: should be rejected with a conflict message.
    await page.locator('[data-testid="add-shift-button"]').first().click()
    await page
      .locator('[data-testid="shift-client-select"]')
      .selectOption({ label: 'Phase 2 Client' })
    await page
      .locator('[data-testid="shift-caregiver-select"]')
      .selectOption(userIds.caregiverUserId)
    await page.locator('[data-testid="shift-date-input"]').fill(mondayStr)
    await page.locator('[data-testid="shift-start-input"]').fill('11:00')
    await page.locator('[data-testid="shift-end-input"]').fill('15:00')
    await page.locator('[data-testid="save-shift-button"]').click()
    await expect(page.locator('text=Schedule conflict')).toBeVisible({
      timeout: 15000,
    })
    await page.locator('button:has-text("Cancel")').click({ force: true })

    // Tuesday shift: caregiver has no availability declared.
    await page.locator('[data-testid="add-shift-button"]').first().click()
    await page
      .locator('[data-testid="shift-client-select"]')
      .selectOption({ label: 'Phase 2 Client' })
    await page
      .locator('[data-testid="shift-caregiver-select"]')
      .selectOption(userIds.caregiverUserId)
    await page.locator('[data-testid="shift-date-input"]').fill(tuesdayStr)
    await page.locator('[data-testid="shift-start-input"]').fill('10:00')
    await page.locator('[data-testid="shift-end-input"]').fill('14:00')
    await expect(
      page.locator('[data-testid="availability-banner"]'),
    ).toContainText('No availability declared', { timeout: 15000 })
    await page.locator('[data-testid="save-shift-button"]').click()
    await expect(page.locator('text=Shift created')).toBeVisible({
      timeout: 15000,
    })

    // Coverage flow: promote the coordinator to caregiver, request coverage for
    // Monday's shift, then assign the coordinator as coverage.
    try {
      await callConvexMutation(adminToken, 'members:updateRole', {
        clerkOrgId: E2E_ORG_ID,
        clerkUserId: userIds.coordinatorUserId,
        role: 'org:caregiver',
      })

      await signOut(page)
      await signInWithClerk(
        page,
        E2E_CAREGIVER_EMAIL,
        E2E_CAREGIVER_PASSWORD,
        E2E_ORG_ID,
        'org:caregiver',
      )
      const caregiverToken = await extractClerkToken(page)
      if (!caregiverToken) {
        throw new Error('Could not extract caregiver session token.')
      }
      const myShifts = await callConvexQuery(
        caregiverToken,
        'scheduling:listCaregiverShifts',
        { clerkOrgId: E2E_ORG_ID },
      )
      const mondayShift = (
        myShifts as Array<{ _id: string; scheduledStart: string }>
      ).find((s) => s.scheduledStart.startsWith(mondayStr))
      expect(mondayShift).toBeDefined()

      const coverageResult = (await callConvexMutation(
        caregiverToken,
        'scheduling:requestCoverage',
        {
          clerkOrgId: E2E_ORG_ID,
          shiftId: mondayShift!._id,
          reason: 'Family emergency',
        },
      )) as { value?: { coverageRequestId: string } }
      const coverageRequestId = coverageResult.value?.coverageRequestId
      expect(coverageRequestId).toBeTruthy()

      await signOut(page)
      await signInWithClerk(
        page,
        E2E_ADMIN_EMAIL,
        E2E_ADMIN_PASSWORD,
        E2E_ORG_ID,
        'org:admin',
      )
      const resolveToken = await extractClerkToken(page)
      if (!resolveToken) throw new Error('Could not extract admin session token.')

      await page.goto('/scheduling')
      await expect(page).toHaveURL(/scheduling/)
      const newCoverageRow = page
        .locator('[data-testid="coverage-request-row"]')
        .filter({ hasText: 'Family emergency' })
      await expect(newCoverageRow).toBeVisible({ timeout: 15000 })

      await callConvexMutation(resolveToken, 'scheduling:resolveCoverage', {
        clerkOrgId: E2E_ORG_ID,
        coverageRequestId: coverageRequestId,
        reassignedTo: userIds.coordinatorUserId,
      })
      await expect(newCoverageRow).toHaveCount(0, { timeout: 15000 })
    } finally {
      try {
        await callConvexMutation(adminToken, 'members:updateRole', {
          clerkOrgId: E2E_ORG_ID,
          clerkUserId: userIds.coordinatorUserId,
          role: 'org:coordinator',
        })
      } catch {
        // best-effort cleanup
      }
    }
  })
})
