import { query, mutation, internalAction, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'
import type { QueryCtx } from './_generated/server'

// ═══════════════════════════════════════════════════════════════
// Provider abstraction — pluggable background check providers
// ═══════════════════════════════════════════════════════════════

type ProviderResult = {
  providerReportId: string
  status: 'pending' | 'clear' | 'consider' | 'suspended' | 'expired' | 'error'
  result: string
}

/**
 * Mock provider — returns a 'clear' result after a short delay.
 * Used for dev/QA when no real provider credentials are available.
 */
async function mockProvider(
  candidateName: string,
): Promise<ProviderResult> {
  await new Promise((r) => setTimeout(r, 500))
  return {
    providerReportId: `mock_${Date.now()}`,
    status: 'clear',
    result: JSON.stringify({
      provider: 'mock',
      candidate: candidateName,
      summary: 'No records found (mock sandbox)',
      checks: [
        { type: 'national_criminal', status: 'clear', records: 0 },
        { type: 'sex_offender_registry', status: 'clear', records: 0 },
        { type: 'ssn_trace', status: 'clear', records: 0 },
      ],
    }),
  }
}

/**
 * Real provider call — implements the BackgroundChecks.com API.
 * Activated when BG_CHECK_PROVIDER is set to 'backgroundchecks_dot_com'
 * and BG_CHECK_API_TOKEN is configured.
 *
 * API docs: https://www.backgroundchecks.com/developers/api
 * Sandbox: https://sandbox.backgroundchecks.com/api?api_token={token}
 * Production: https://app.backgroundchecks.com/api?api_token={token}
 */
async function backgroundChecksDotComProvider(
  candidate: { firstName: string; lastName: string; email: string },
  _package: string,
): Promise<ProviderResult> {
  const token = process.env.BG_CHECK_API_TOKEN
  if (!token) throw new Error('BG_CHECK_API_TOKEN not configured')

  const baseUrl = process.env.BG_CHECK_ENVIRONMENT === 'production'
    ? 'https://app.backgroundchecks.com/api'
    : 'https://sandbox.backgroundchecks.com/api'

  // Step 1: Create order
  const orderResp = await fetch(`${baseUrl}?api_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      package: _package,
      first_name: candidate.firstName,
      last_name: candidate.lastName,
      email: candidate.email,
    }),
  })

  if (!orderResp.ok) {
    const err = await orderResp.text()
    throw new Error(`BackgroundChecks.com order failed (${orderResp.status}): ${err}`)
  }

  const order = await orderResp.json()
  const orderId = order.id ?? order.order_id

  // Step 2: Poll for status (in production, use webhooks instead)
  // For now, return the order as pending — webhook will update it
  return {
    providerReportId: String(orderId),
    status: 'pending',
    result: JSON.stringify({ provider: 'backgroundchecks_dot_com', orderId, status: 'pending' }),
  }
}

function getProvider(): string {
  return process.env.BG_CHECK_PROVIDER ?? 'mock'
}

// ═══════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════

export const getBackgroundCheck = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:candidate',
      'org:caregiver',
      'org:admin',
      'org:hr',
    ])

    // For candidate/caregiver, find their own; for admin/hr, find by candidateId
    const candidate = await getOwnCandidate(ctx, tenantId, identity.subject, identity.email)
    if (!candidate) return null

    return await ctx.db
      .query('backgroundChecks')
      .withIndex('by_tenant_candidate', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidate._id),
      )
      .order('desc')
      .first()
  },
})

export const getBackgroundCheckForHR = query({
  args: { clerkOrgId: v.string(), candidateId: v.id('candidates') },
  handler: async (ctx, { clerkOrgId, candidateId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
    ])
    const candidate = await ctx.db.get(candidateId)
    if (!candidate) throw new Error('Candidate not found.')
    assertTenantDoc(candidate, tenantId)

    return await ctx.db
      .query('backgroundChecks')
      .withIndex('by_tenant_candidate', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidateId),
      )
      .order('desc')
      .first()
  },
})

// ═══════════════════════════════════════════════════════════════
// Mutations
// ═══════════════════════════════════════════════════════════════

export const initiateBackgroundCheck = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
  },
  handler: async (ctx, { clerkOrgId, candidateId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const candidate = await ctx.db.get(candidateId)
    if (!candidate) throw new Error('Candidate not found.')
    assertTenantDoc(candidate, tenantId)

    // Check if one already exists and is not expired/errored.
    // This read-check-insert is atomic: Convex mutations run with
    // serializable optimistic concurrency control, so a concurrent
    // initiate for the same candidate conflicts on this index-range
    // read and is retried, observing the row inserted by the winner.
    const existing = await ctx.db
      .query('backgroundChecks')
      .withIndex('by_tenant_candidate', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidateId),
      )
      .order('desc')
      .first()

    if (existing && !['expired', 'error'].includes(existing.status)) {
      return existing._id
    }

    const provider = getProvider()
    const now = new Date().toISOString()

    const checkId = await ctx.db.insert('backgroundChecks', {
      tenantId,
      candidateId,
      provider,
      providerReportId: undefined,
      status: 'pending',
      package: process.env.BG_CHECK_PACKAGE ?? 'basic',
      initiatedAt: now,
    })

    // Schedule the actual provider call as an action
    await ctx.scheduler.runAfter(0, internal.backgroundChecks.runProviderCheck, {
      candidateId,
      checkId,
      provider,
    })

    return checkId
  },
})

export const getBackgroundCheckInternal = internalQuery({
  args: {
    checkId: v.id('backgroundChecks'),
  },
  handler: async (ctx, { checkId }) => {
    return await ctx.db.get(checkId)
  },
})

/**
 * Internal query for fetching a candidate from internal actions.
 * Internal actions have no user identity, so they cannot call the
 * authenticated public `candidates.getCandidateById` query.
 */
export const getCandidateInternal = internalQuery({
  args: {
    candidateId: v.id('candidates'),
  },
  handler: async (ctx, { candidateId }) => {
    return await ctx.db.get(candidateId)
  },
})

/**
 * Internal action that calls the provider and updates the result.
 * This runs asynchronously after initiateBackgroundCheck.
 */
export const runProviderCheck = internalAction({
  args: {
    candidateId: v.id('candidates'),
    checkId: v.id('backgroundChecks'),
    provider: v.string(),
  },
  handler: async (ctx, { candidateId, checkId, provider }) => {
    // Fetch the check first so we always have the tenantId for scoping.
    const check = await ctx.runQuery(internal.backgroundChecks.getBackgroundCheckInternal, {
      checkId,
    })
    if (!check) {
      throw new Error('Background check not found.')
    }

    // Idempotency guard: if a previous attempt already produced a result,
    // do not call the provider again (avoids duplicate orders/charges and
    // overwriting a finalized result when the scheduled action is retried).
    if (check.status !== 'pending' && check.status !== 'error') {
      return
    }

    // Fetch candidate details via the internal query — internal actions have
    // no user identity and cannot call the authenticated public query.
    const candidate = await ctx.runQuery(internal.backgroundChecks.getCandidateInternal, {
      candidateId,
    })

    if (!candidate) {
      await ctx.runMutation(internal.backgroundChecks.updateCheckResult, {
        checkId,
        tenantId: check.tenantId,
        status: 'error',
        result: JSON.stringify({ error: 'Candidate not found' }),
      })
      return
    }

    const name = candidate.displayName
    const nameParts = name.split(' ')
    const firstName = nameParts[0] ?? name
    const lastName = nameParts.slice(1).join(' ') || firstName

    let providerResult: ProviderResult
    try {
      if (provider === 'backgroundchecks_dot_com') {
        providerResult = await backgroundChecksDotComProvider(
          { firstName, lastName, email: candidate.email },
          process.env.BG_CHECK_PACKAGE ?? 'basic',
        )
      } else {
        // Default: mock provider
        providerResult = await mockProvider(name)
      }

      await ctx.runMutation(internal.backgroundChecks.updateCheckResult, {
        checkId,
        tenantId: check.tenantId,
        providerReportId: providerResult.providerReportId,
        status: providerResult.status,
        result: providerResult.result,
      })
    } catch (err) {
      await ctx.runMutation(internal.backgroundChecks.updateCheckResult, {
        checkId,
        tenantId: check.tenantId,
        status: 'error',
        result: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      })
    }
  },
})

/**
 * Internal mutation to update a background check result.
 */
export const updateCheckResult = internalMutation({
  args: {
    checkId: v.id('backgroundChecks'),
    tenantId: v.id('tenants'),
    providerReportId: v.optional(v.string()),
    status: v.string(),
    result: v.string(),
  },
  handler: async (ctx, { checkId, tenantId, providerReportId, status, result }) => {
    const check = await ctx.db.get(checkId)
    if (!check) throw new Error('Background check not found.')
    assertTenantDoc(check, tenantId)

    // Idempotency guard: only a check still awaiting a provider result may be
    // updated. A retried runProviderCheck must not overwrite a finalized
    // (or manually uploaded) result.
    if (check.status !== 'pending' && check.status !== 'error') return

    await ctx.db.patch(checkId, {
      providerReportId,
      status,
      result,
      completedAt: status !== 'pending' ? new Date().toISOString() : undefined,
    })
  },
})

/**
 * Upload the official background-check result PDF/file.
 * Called by HR after receiving the certified result from the provider.
 */
export const uploadBackgroundCheckResult = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
    storageId: v.string(),
    fileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) throw new Error('Candidate not found.')
    assertTenantDoc(candidate, tenantId)

    const existing = await ctx.db
      .query('backgroundChecks')
      .withIndex('by_tenant_candidate', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', args.candidateId),
      )
      .order('desc')
      .first()

    const now = new Date().toISOString()
    // The check stays 'pending_scan' until the async document scan completes;
    // scanUploadedResult transitions it to 'completed' (clean) or
    // 'scan_failed' (rejected). Never mark an unscanned upload as completed.
    let checkId: Id<'backgroundChecks'>
    if (existing) {
      checkId = existing._id
      await ctx.db.patch(existing._id, {
        officialResultStorageId: args.storageId,
        officialResultUploadedAt: now,
        officialResultUploadedBy: identity.subject,
        status: 'pending_scan',
      })
    } else {
      checkId = await ctx.db.insert('backgroundChecks', {
        tenantId,
        candidateId: args.candidateId,
        provider: 'manual_upload',
        status: 'pending_scan',
        package: process.env.BG_CHECK_PACKAGE ?? 'basic',
        initiatedAt: now,
        officialResultStorageId: args.storageId,
        officialResultUploadedAt: now,
        officialResultUploadedBy: identity.subject,
      })
    }

    // Scan the uploaded result (type/size validation now; Scanii virus scan
    // when DOCUMENT_SCAN_ENABLED=true), then flip the check status based on
    // the scan outcome.
    await ctx.scheduler.runAfter(0, internal.backgroundChecks.scanUploadedResult, {
      checkId,
      tenantId,
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType,
      size: args.size,
    })

    return args.candidateId
  },
})

/**
 * Internal action: scan the uploaded official result and transition the
 * background check out of 'pending_scan' based on the outcome.
 */
export const scanUploadedResult = internalAction({
  args: {
    checkId: v.id('backgroundChecks'),
    tenantId: v.id('tenants'),
    storageId: v.string(),
    fileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let clean: boolean
    let reason: string | undefined
    try {
      const scan = await ctx.runAction(internal._utils.documentSecurity.scanDocument, {
        storageId: args.storageId,
        fileName: args.fileName,
        contentType: args.contentType,
        size: args.size,
      })
      clean = scan.clean
      reason = scan.reason
    } catch (err) {
      // Fail closed: a scanner error must not leave the check completed.
      clean = false
      reason = err instanceof Error ? err.message : 'Document scan failed.'
    }

    await ctx.runMutation(internal.backgroundChecks.completeScan, {
      checkId: args.checkId,
      tenantId: args.tenantId,
      clean,
      reason,
    })
  },
})

/**
 * Internal mutation: record the scan outcome on a 'pending_scan' check.
 * Idempotent — only transitions checks still awaiting their scan result.
 */
export const completeScan = internalMutation({
  args: {
    checkId: v.id('backgroundChecks'),
    tenantId: v.id('tenants'),
    clean: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { checkId, tenantId, clean, reason }) => {
    const check = await ctx.db.get(checkId)
    if (!check) throw new Error('Background check not found.')
    assertTenantDoc(check, tenantId)
    if (check.status !== 'pending_scan') return

    if (clean) {
      await ctx.db.patch(checkId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
    } else {
      // Delete the rejected file from storage so a flagged document (malware,
      // wrong file, or PII) does not remain stored, then unlink it from the
      // record so it cannot be used downstream (e.g. hiring). A storage-layer
      // failure must not leave the check stuck in 'pending_scan' — the file
      // is still unlinked from the record in that case.
      if (check.officialResultStorageId) {
        try {
          await ctx.storage.delete(check.officialResultStorageId as Id<'_storage'>)
        } catch (err) {
          console.error('Failed to delete rejected background-check file from storage', err)
        }
      }
      await ctx.db.patch(checkId, {
        status: 'scan_failed',
        result: JSON.stringify({ scanRejected: true, reason }),
        officialResultStorageId: undefined,
      })
    }
  },
})

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

async function getOwnCandidate(
  ctx: QueryCtx,
  tenantId: Id<'tenants'>,
  subject: string,
  email?: string,
) {
  // Try by clerkUserId first
  const byUser = await ctx.db
    .query('candidates')
    .withIndex('by_tenant_clerk_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', subject),
    )
    .first()
  if (byUser) return byUser

  // Fall back to email
  if (email) {
    const byEmail = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) =>
        q.eq('tenantId', tenantId).eq('email', email),
      )
      .first()
    if (byEmail) return byEmail
  }

  return null
}
