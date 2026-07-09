import { test, expect } from '@playwright/test'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  extractClerkToken,
  mockSignInAsRole,
  signInWithClerk,
} from './helpers/auth'
import {
  callConvexMutation,
  callConvexQuery,
  resetE2ECandidate,
} from './helpers/seed'
import { e2eCredentialsAvailable, mockE2EEnabled } from './helpers/env'

type ArchiveItem = {
  _id: string
  status: string
  verifiedBy?: string
  verifiedAt?: string
  rejectionReason?: string
  expiresAt?: string
  category: string
}

async function signInAsAdmin(page: import('@playwright/test').Page) {
  if (mockE2EEnabled()) {
    await mockSignInAsRole(page, 'org:admin', E2E_ORG_ID)
  } else {
    await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID, 'org:admin')
  }
}

test.describe('document archive flow', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    if (!e2eCredentialsAvailable() && !mockE2EEnabled()) {
      assertE2ECredentialsConfigured()
    }
  })

  test('verify, reject, and filter documents', async ({ page }) => {
    const fixture = await resetE2ECandidate(page)
    const candidateId = fixture.candidateId

    await signInAsAdmin(page)
    const token = await extractClerkToken(page)
    if (!token) throw new Error('Could not extract admin session token.')

    const listResult = (await callConvexQuery(
      token,
      'documentArchive:listDocumentArchive',
      {
        clerkOrgId: E2E_ORG_ID,
        linkedTo: { subjectType: 'candidate', subjectId: candidateId },
        status: 'pending_review',
      },
    )) as ArchiveItem[]

    expect(listResult.length).toBeGreaterThanOrEqual(1)
    const itemId = listResult[0]._id

    await callConvexMutation(token, 'documentArchive:updateDocumentArchiveItem', {
      clerkOrgId: E2E_ORG_ID,
      itemId,
      status: 'verified',
    })

    const verifiedResult = (await callConvexQuery(
      token,
      'documentArchive:listDocumentArchive',
      { clerkOrgId: E2E_ORG_ID, linkedTo: { subjectType: 'candidate', subjectId: candidateId } },
    )) as ArchiveItem[]
    const verifiedItem = verifiedResult.find((item) => item._id === itemId)
    expect(verifiedItem?.status).toBe('verified')

    await callConvexMutation(token, 'documentArchive:updateDocumentArchiveItem', {
      clerkOrgId: E2E_ORG_ID,
      itemId,
      status: 'rejected',
      rejectionReason: 'Document is missing required signature.',
    })

    const rejectedResult = (await callConvexQuery(
      token,
      'documentArchive:listDocumentArchive',
      { clerkOrgId: E2E_ORG_ID, linkedTo: { subjectType: 'candidate', subjectId: candidateId } },
    )) as ArchiveItem[]
    const rejectedItem = rejectedResult.find((item) => item._id === itemId)
    expect(rejectedItem?.status).toBe('rejected')
    expect(rejectedItem?.rejectionReason).toBe('Document is missing required signature.')

    const expiringResult = (await callConvexQuery(
      token,
      'documentArchive:listDocumentArchive',
      { clerkOrgId: E2E_ORG_ID, expiringSoonDays: 30 },
    )) as ArchiveItem[]
    expect(expiringResult.find((item) => item._id === itemId)).toBeUndefined()
  })
})
