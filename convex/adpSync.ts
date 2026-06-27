import { v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { assertTenantDoc, requireTenantRole } from './authHelpers'
import { adpEnvVarNames, isAdpConfigured } from './integrations/adp/config'

type ClaimResult =
  | {
      type: 'already_synced'
      eventId: Id<'integrationEvents'>
      response?: unknown
    }
  | { type: 'in_flight'; eventId: Id<'integrationEvents'> }
  | { type: 'max_attempts'; attempt: number }
  | { type: 'claimed'; eventId: Id<'integrationEvents'>; attempt: number }

const RETRY_DELAYS_MS = [30_000, 120_000, 300_000, 900_000, 1_800_000]
const IN_FLIGHT_STALE_MS = 5 * 60 * 1000

const adpPunchSyncStatus = v.union(
  v.literal('pending_credentials'),
  v.literal('queued'),
  v.literal('synced'),
  v.literal('error'),
)

const adpEmployeeSyncStatus = v.union(
  v.literal('pending_credentials'),
  v.literal('queued'),
  v.literal('synced'),
  v.literal('error'),
  v.literal('matched'),
  v.literal('created'),
)

export function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return redactSecrets(message.slice(0, 500))
}

function redactSecrets(message: string): string {
  let redacted = message

  for (const name of adpEnvVarNames()) {
    const value = process.env[name]?.trim()
    if (value) {
      redacted = redacted.split(value).join(`[REDACTED:${name}]`)
    }
  }

  redacted = redacted.replace(
    /Basic\s+[A-Za-z0-9+/=]{10,}/g,
    'Basic [REDACTED]',
  )
  redacted = redacted.replace(
    /Bearer\s+[A-Za-z0-9_\-./=]{10,}/g,
    'Bearer [REDACTED]',
  )
  redacted = redacted.replace(
    /(token['"]?\s*[:=]\s*)['"]?[A-Za-z0-9_\-./=]{8,}['"]?/gi,
    '$1[REDACTED]',
  )

  return redacted
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function idempotencyKey(kind: string, refId: string): string {
  return `${kind}:${refId}`
}

export function chooseRetryDelayMs(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length) - 1]
}

export const loadPunchForAdpSync = internalQuery({
  args: { timePunchId: v.id('timePunches') },
  handler: async (ctx: QueryCtx, { timePunchId }) => {
    const punch = await ctx.db.get(timePunchId)
    if (!punch) throw new Error('Time punch not found.')
    return punch
  },
})

export const loadEmployeeProfileForAdpSync = internalQuery({
  args: { employeeProfileId: v.id('employeeProfiles') },
  handler: async (ctx: QueryCtx, { employeeProfileId }) => {
    const profile = await ctx.db.get(employeeProfileId)
    if (!profile) throw new Error('Employee profile not found.')
    return profile
  },
})

export const findEmployeeProfileByClerkUserId = internalQuery({
  args: { tenantId: v.id('tenants'), clerkUserId: v.string() },
  handler: async (ctx: QueryCtx, { tenantId, clerkUserId }) => {
    return ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant_clerk_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId),
      )
      .unique()
  },
})

export const findEmployeeProfilesByTenant = internalQuery({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx: QueryCtx, { tenantId }) => {
    return ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
  },
})

export const isAdpConfiguredForTenant = internalQuery({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx: QueryCtx, { tenantId }) => {
    return isAdpConfigured(ctx, tenantId)
  },
})

export const patchPunchAdpStatus = internalMutation({
  args: {
    timePunchId: v.id('timePunches'),
    tenantId: v.id('tenants'),
    adpSyncStatus: adpPunchSyncStatus,
    adpPunchId: v.optional(v.string()),
    adpError: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const punch = await ctx.db.get(args.timePunchId)
    if (!punch) throw new Error('Time punch not found.')
    assertTenantDoc(punch, args.tenantId)

    const patch: {
      adpSyncStatus: 'pending_credentials' | 'queued' | 'synced' | 'error'
      adpPunchId?: string
      adpError?: string
    } = { adpSyncStatus: args.adpSyncStatus }
    if (args.adpPunchId !== undefined) patch.adpPunchId = args.adpPunchId
    if (args.adpError !== undefined || args.adpSyncStatus === 'synced') {
      patch.adpError = args.adpError
    }
    await ctx.db.patch(args.timePunchId, patch)
  },
})

export const patchWorkerAdpStatus = internalMutation({
  args: {
    employeeProfileId: v.id('employeeProfiles'),
    tenantId: v.id('tenants'),
    adpSyncStatus: adpEmployeeSyncStatus,
    adpAssociateOid: v.optional(v.string()),
    adpWorkerId: v.optional(v.string()),
    adpError: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const profile = await ctx.db.get(args.employeeProfileId)
    if (!profile) throw new Error('Employee profile not found.')
    assertTenantDoc(profile, args.tenantId)

    const isSuccessStatus =
      args.adpSyncStatus === 'synced' ||
      args.adpSyncStatus === 'matched' ||
      args.adpSyncStatus === 'created'

    const patch: {
      adpSyncStatus:
        | 'pending_credentials'
        | 'queued'
        | 'synced'
        | 'error'
        | 'matched'
        | 'created'
      adpAssociateOid?: string
      adpWorkerId?: string
      adpError?: string
    } = { adpSyncStatus: args.adpSyncStatus }
    if (args.adpAssociateOid !== undefined) {
      patch.adpAssociateOid = args.adpAssociateOid
    }
    if (args.adpWorkerId !== undefined) patch.adpWorkerId = args.adpWorkerId
    if (args.adpError !== undefined || isSuccessStatus) {
      patch.adpError = args.adpError
    }
    await ctx.db.patch(args.employeeProfileId, patch)
  },
})

export const upsertMatchedEmployeeProfile = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    associateOID: v.string(),
    workerID: v.optional(v.string()),
    displayName: v.string(),
    email: v.string(),
    matchProfileId: v.optional(v.id('employeeProfiles')),
  },
  handler: async (ctx: MutationCtx, args) => {
    if (args.matchProfileId) {
      const match = await ctx.db.get(args.matchProfileId)
      if (!match) throw new Error('Employee profile not found.')
      assertTenantDoc(match, args.tenantId)
      await ctx.db.patch(args.matchProfileId, {
        adpAssociateOid: args.associateOID,
        adpWorkerId: args.workerID,
        adpSyncStatus: 'matched',
      })
      return args.matchProfileId
    }

    return ctx.db.insert('employeeProfiles', {
      tenantId: args.tenantId,
      displayName: args.displayName,
      email: args.email,
      adpAssociateOid: args.associateOID,
      adpWorkerId: args.workerID,
      adpSyncStatus: 'created',
      createdAt: new Date().toISOString(),
    })
  },
})

export const claimIntegrationEvent = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    kind: v.string(),
    refId: v.string(),
    idempotencyKey: v.string(),
    request: v.optional(v.any()),
    maxAttempts: v.number(),
  },
  handler: async (ctx: MutationCtx, args): Promise<ClaimResult> => {
    const events = await ctx.db
      .query('integrationEvents')
      .withIndex('by_tenant_idemp', (q) =>
        q.eq('tenantId', args.tenantId).eq('idempotencyKey', args.idempotencyKey),
      )
      .order('desc')
      .collect()

    for (const event of events) {
      if (event.status === 'success') {
        return {
          type: 'already_synced',
          eventId: event._id,
          response: event.response,
        }
      }
      if (event.status === 'attempting') {
        const createdAt = new Date(event.createdAt).getTime()
        if (Date.now() - createdAt < IN_FLIGHT_STALE_MS) {
          return { type: 'in_flight', eventId: event._id }
        }
      }
    }

    const latestAttempt = events.find((e) => typeof e.attempt === 'number')
    const attempt = (latestAttempt?.attempt ?? 0) + 1
    if (attempt > args.maxAttempts) {
      return { type: 'max_attempts', attempt }
    }

    const eventId = await ctx.db.insert('integrationEvents', {
      tenantId: args.tenantId,
      provider: 'adp',
      kind: args.kind,
      refId: args.refId,
      idempotencyKey: args.idempotencyKey,
      status: 'attempting',
      attempt,
      request: args.request,
      createdAt: new Date().toISOString(),
    })

    return { type: 'claimed', eventId, attempt }
  },
})

export const patchIntegrationEvent = internalMutation({
  args: {
    eventId: v.id('integrationEvents'),
    status: v.string(),
    response: v.optional(v.any()),
    completedAt: v.optional(v.string()),
    nextRetryAt: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    await ctx.db.patch(args.eventId, {
      status: args.status,
      response: args.response,
      completedAt: args.completedAt,
      nextRetryAt: args.nextRetryAt,
    })
  },
})

export const triggerInitialWorkerLoad = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
    ])
    await ctx.scheduler.runAfter(
      0,
      internal.adpOutbound.adpInitialWorkerLoad,
      { tenantId },
    )
    return { status: 'queued' }
  },
})

export const adpSyncStatusLiterals = {
  adpPunchSyncStatus,
  adpEmployeeSyncStatus,
}

export type AdpPunchSyncStatus =
  | 'pending_credentials'
  | 'queued'
  | 'synced'
  | 'error'

export type AdpEmployeeSyncStatus =
  | 'pending_credentials'
  | 'queued'
  | 'synced'
  | 'error'
  | 'matched'
  | 'created'
