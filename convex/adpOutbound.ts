'use node'

import { v } from 'convex/values'
import { internalAction, type ActionCtx } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { getSharedMockAdp } from './integrations/adp/mockAdp'
import { NotConfiguredError } from './integrations/adp/errors'
import type { AdpPort } from './integrations/adp/adpPort'
import {
  chooseRetryDelayMs,
  idempotencyKey,
  normalizeEmail,
  sanitizeError,
} from './adpSync'

declare const process: { env: Record<string, string | undefined> }

const MAX_ATTEMPTS = 5

async function getAdpPort(): Promise<AdpPort> {
  if (process.env.ADP_MOCK_ADAPTER === 'true') {
    return getSharedMockAdp()
  }
  const { AdpClient } = await import('./integrations/adp/adpClient')
  return new AdpClient()
}

async function patchEvent(
  ctx: ActionCtx,
  eventId: Id<'integrationEvents'>,
  patch: {
    status: string
    response?: unknown
    completedAt?: string
    nextRetryAt?: string
  },
) {
  await ctx.runMutation(internal.adpSync.patchIntegrationEvent, {
    eventId,
    ...patch,
  })
}

export const adpSyncPunch = internalAction({
  args: { timePunchId: v.id('timePunches') },
  handler: async (ctx: ActionCtx, { timePunchId }) => {
    const punch = await ctx.runQuery(internal.adpSync.loadPunchForAdpSync, {
      timePunchId,
    })
    const tenantId = punch.tenantId

    const configured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId },
    )
    if (!configured) {
      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'pending_credentials',
      })
      return { status: 'pending_credentials' }
    }

    const profile = await ctx.runQuery(
      internal.adpSync.findEmployeeProfileByClerkUserId,
      { tenantId, clerkUserId: punch.caregiverId },
    )

    if (!profile || !profile.adpAssociateOid) {
      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'error',
        adpError: 'Caregiver employee profile or ADP associate OID missing.',
      })
      return { status: 'error' }
    }

    const key = idempotencyKey('punch', timePunchId as string)
    const claim = await ctx.runMutation(
      internal.adpSync.claimIntegrationEvent,
      {
        tenantId,
        kind: 'punch',
        refId: timePunchId as string,
        idempotencyKey: key,
        request: {
          timePunchId: timePunchId as string,
          punchType: punch.punchType,
          associateOID: profile.adpAssociateOid,
        },
        maxAttempts: MAX_ATTEMPTS,
      },
    )

    if (claim.type === 'already_synced') {
      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'synced',
      })
      return { status: 'already_synced' }
    }

    if (claim.type === 'in_flight') {
      return { status: 'in_flight' }
    }

    if (claim.type === 'max_attempts') {
      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'error',
        adpError: 'Max ADP sync attempts exceeded.',
      })
      return { status: 'max_attempts' }
    }

    try {
      const port = await getAdpPort()
      const result = await port.postPunch({
        idempotencyKey: key,
        timePunchId: timePunchId as string,
        associateOID: profile.adpAssociateOid,
        punchType: punch.punchType,
        at: punch.at,
      })

      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'synced',
        adpPunchId: result.punchId,
      })

      await patchEvent(ctx, claim.eventId, {
        status: 'success',
        response: { adpPunchId: result.punchId },
        completedAt: new Date().toISOString(),
      })

      return { status: 'synced', adpPunchId: result.punchId }
    } catch (error) {
      const isNotConfigured = error instanceof NotConfiguredError
      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
      const adpError = sanitizeError(error)
      const nextRetryAt =
        !isNotConfigured && claim.attempt < MAX_ATTEMPTS
          ? new Date(
              Date.now() + chooseRetryDelayMs(claim.attempt),
            ).toISOString()
          : undefined

      await patchEvent(ctx, claim.eventId, {
        status: syncStatus,
        response: { error: adpError },
        completedAt: new Date().toISOString(),
        nextRetryAt,
      })

      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: syncStatus,
        adpError,
      })

      if (!isNotConfigured && claim.attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          chooseRetryDelayMs(claim.attempt),
          internal.adpOutbound.adpSyncPunch,
          { timePunchId },
        )
      }

      return { status: syncStatus, error: adpError }
    }
  },
})

export const adpSyncWorker = internalAction({
  args: { employeeProfileId: v.id('employeeProfiles') },
  handler: async (ctx: ActionCtx, { employeeProfileId }) => {
    const profile = await ctx.runQuery(
      internal.adpSync.loadEmployeeProfileForAdpSync,
      { employeeProfileId },
    )
    const tenantId = profile.tenantId

    if (profile.adpAssociateOid) {
      if (profile.adpSyncStatus !== 'synced') {
        await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
          employeeProfileId,
          tenantId,
          adpSyncStatus: 'synced',
        })
      }
      return { status: 'already_synced' }
    }

    const configured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId },
    )
    if (!configured) {
      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: 'pending_credentials',
      })
      return { status: 'pending_credentials' }
    }

    const key = idempotencyKey('worker', employeeProfileId as string)
    const claim = await ctx.runMutation(
      internal.adpSync.claimIntegrationEvent,
      {
        tenantId,
        kind: 'worker',
        refId: employeeProfileId as string,
        idempotencyKey: key,
        request: {
          employeeProfileId: employeeProfileId as string,
          displayName: profile.displayName,
          email: profile.email,
        },
        maxAttempts: MAX_ATTEMPTS,
      },
    )

    if (claim.type === 'already_synced') {
      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: 'synced',
      })
      return { status: 'already_synced' }
    }

    if (claim.type === 'in_flight') {
      return { status: 'in_flight' }
    }

    if (claim.type === 'max_attempts') {
      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: 'error',
        adpError: 'Max ADP sync attempts exceeded.',
      })
      return { status: 'max_attempts' }
    }

    try {
      const port = await getAdpPort()
      const result = await port.createWorker({
        idempotencyKey: key,
        employeeProfileId: employeeProfileId as string,
        displayName: profile.displayName,
        email: profile.email,
      })

      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: 'synced',
        adpAssociateOid: result.associateOID,
        adpWorkerId: result.workerID,
      })

      await patchEvent(ctx, claim.eventId, {
        status: 'success',
        response: {
          adpAssociateOid: result.associateOID,
          adpWorkerId: result.workerID,
        },
        completedAt: new Date().toISOString(),
      })

      return { status: 'synced', adpAssociateOid: result.associateOID }
    } catch (error) {
      const isNotConfigured = error instanceof NotConfiguredError
      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
      const adpError = sanitizeError(error)
      const nextRetryAt =
        !isNotConfigured && claim.attempt < MAX_ATTEMPTS
          ? new Date(
              Date.now() + chooseRetryDelayMs(claim.attempt),
            ).toISOString()
          : undefined

      await patchEvent(ctx, claim.eventId, {
        status: syncStatus,
        response: { error: adpError },
        completedAt: new Date().toISOString(),
        nextRetryAt,
      })

      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: syncStatus,
        adpError,
      })

      if (!isNotConfigured && claim.attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          chooseRetryDelayMs(claim.attempt),
          internal.adpOutbound.adpSyncWorker,
          { employeeProfileId },
        )
      }

      return { status: syncStatus, error: adpError }
    }
  },
})

export const adpDrainPendingRows = internalAction({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx: ActionCtx, { tenantId }) => {
    const configured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId },
    )
    if (!configured) {
      return {
        status: 'pending_credentials' as const,
        punchCount: 0,
        profileCount: 0,
      }
    }

    const [pendingPunches, pendingProfiles] = await Promise.all([
      ctx.runQuery(internal.adpSync.findPendingAdpPunches, { tenantId }),
      ctx.runQuery(internal.adpSync.findPendingAdpProfiles, { tenantId }),
    ])

    let punchCount = 0
    for (const punch of pendingPunches) {
      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
        timePunchId: punch._id,
      })
      punchCount++
    }

    let profileCount = 0
    for (const profile of pendingProfiles) {
      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
        employeeProfileId: profile._id,
      })
      profileCount++
    }

    return {
      status: 'draining' as const,
      punchCount,
      profileCount,
    }
  },
})

export const adpInitialWorkerLoad = internalAction({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx: ActionCtx, { tenantId }) => {
    const configured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId },
    )
    if (!configured) {
      return {
        status: 'pending_credentials',
        processed: 0,
        matched: 0,
        created: 0,
        errors: 0,
      }
    }

    const key = idempotencyKey('initial_worker_load', tenantId as string)
    const claim = await ctx.runMutation(
      internal.adpSync.claimIntegrationEvent,
      {
        tenantId,
        kind: 'initial_worker_load',
        refId: tenantId as string,
        idempotencyKey: key,
        request: { tenantId: tenantId as string },
        maxAttempts: MAX_ATTEMPTS,
      },
    )

    if (claim.type === 'already_synced') {
      const response = claim.response as
        | { processed: number; matched: number; created: number; errors: number }
        | undefined
      return {
        status: 'already_synced',
        processed: response?.processed ?? 0,
        matched: response?.matched ?? 0,
        created: response?.created ?? 0,
        errors: response?.errors ?? 0,
      }
    }

    if (claim.type === 'in_flight') {
      return {
        status: 'in_flight',
        processed: 0,
        matched: 0,
        created: 0,
        errors: 0,
      }
    }

    if (claim.type === 'max_attempts') {
      return {
        status: 'max_attempts',
        processed: 0,
        matched: 0,
        created: 0,
        errors: 0,
      }
    }

    try {
      const profiles = (await ctx.runQuery(
        internal.adpSync.findEmployeeProfilesByTenant,
        { tenantId },
      )) as Doc<'employeeProfiles'>[]

      const profilesByEmail = new Map(
        profiles.map((p: Doc<'employeeProfiles'>) => [
          normalizeEmail(p.email),
          p,
        ]),
      )
      const profilesByName = new Map(
        profiles.map((p: Doc<'employeeProfiles'>) => [
          p.displayName.trim(),
          p,
        ]),
      )
      const profilesByAoid = new Map(
        profiles
          .filter(
            (p: Doc<'employeeProfiles'>): p is Doc<'employeeProfiles'> & {
              adpAssociateOid: string
            } => Boolean(p.adpAssociateOid),
          )
          .map((p: Doc<'employeeProfiles'> & { adpAssociateOid: string }) => [
            p.adpAssociateOid,
            p,
          ]),
      )

      const port = await getAdpPort()
      let cursor: string | undefined
      let processed = 0
      let matched = 0
      let created = 0
      let errors = 0

      do {
        const page = await port.listWorkers(cursor)
        for (const worker of page.workers) {
          processed++

          if (!worker.associateOID || !worker.displayName.trim()) {
            errors++
            continue
          }

          try {
            const email = worker.email
              ? normalizeEmail(worker.email)
              : undefined
            const matchByAoid = worker.associateOID
              ? profilesByAoid.get(worker.associateOID)
              : undefined
            const matchByEmail = email
              ? profilesByEmail.get(email)
              : undefined
            const matchByName = profilesByName.get(worker.displayName.trim())
            const match = matchByAoid ?? matchByEmail ?? matchByName

            await ctx.runMutation(
              internal.adpSync.upsertMatchedEmployeeProfile,
              {
                tenantId,
                associateOID: worker.associateOID,
                workerID: worker.workerID,
                displayName: worker.displayName,
                email: email ?? worker.displayName,
                matchProfileId: match?._id,
              },
            )

            if (match) matched++
            else created++
          } catch (workerError) {
            errors++
            console.error('ADP worker load failed for a record:', workerError)
          }
        }
        cursor = page.nextCursor
      } while (cursor)

      const result = { processed, matched, created, errors }
      await patchEvent(ctx, claim.eventId, {
        status: 'success',
        response: result,
        completedAt: new Date().toISOString(),
      })

      return { status: 'success', ...result }
    } catch (error) {
      const isNotConfigured = error instanceof NotConfiguredError
      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
      const adpError = sanitizeError(error)
      const nextRetryAt =
        !isNotConfigured && claim.attempt < MAX_ATTEMPTS
          ? new Date(
              Date.now() + chooseRetryDelayMs(claim.attempt),
            ).toISOString()
          : undefined

      await patchEvent(ctx, claim.eventId, {
        status: syncStatus,
        response: { error: adpError },
        completedAt: new Date().toISOString(),
        nextRetryAt,
      })

      if (!isNotConfigured && claim.attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          chooseRetryDelayMs(claim.attempt),
          internal.adpOutbound.adpInitialWorkerLoad,
          { tenantId },
        )
      }

      return { status: syncStatus, error: adpError, errors: 0 }
    }
  },
})

export const exportPayrollToAdp = internalAction({
  args: {
    tenantId: v.id('tenants'),
    payPeriodId: v.id('payPeriods'),
    entries: v.array(
      v.object({
        caregiverId: v.string(),
        caregiverName: v.string(),
        hours: v.number(),
      }),
    ),
    punches: v.array(
      v.object({
        timePunchId: v.id('timePunches'),
        caregiverId: v.string(),
        punchType: v.union(v.literal('clock_in'), v.literal('clock_out')),
        at: v.string(),
      }),
    ),
  },
  handler: async (ctx: ActionCtx, { tenantId, payPeriodId, entries, punches }) => {
    const key = idempotencyKey('payroll_export', payPeriodId as string)
    const claim = await ctx.runMutation(
      internal.adpSync.claimIntegrationEvent,
      {
        tenantId,
        kind: 'payroll_export',
        refId: payPeriodId as string,
        idempotencyKey: key,
        request: {
          payPeriodId: payPeriodId as string,
          caregiverCount: entries.length,
          punchCount: punches.length,
        },
        maxAttempts: MAX_ATTEMPTS,
      },
    )

    if (claim.type === 'already_synced') {
      return { success: true, status: 'already_synced' }
    }

    if (claim.type === 'in_flight') {
      return { success: false, error: 'Payroll export already in flight.' }
    }

    if (claim.type === 'max_attempts') {
      return {
        success: false,
        error: 'Max ADP payroll export attempts exceeded.',
      }
    }

    try {
      const port = await getAdpPort()
      let posted = 0
      let skipped = 0

      for (const punch of punches) {
        const profile = await ctx.runQuery(
          internal.adpSync.findEmployeeProfileByClerkUserId,
          { tenantId, clerkUserId: punch.caregiverId },
        )
        if (!profile || !profile.adpAssociateOid) {
          skipped++
          continue
        }

        await port.postPunch({
          idempotencyKey: idempotencyKey(
            'payroll_punch',
            punch.timePunchId as string,
          ),
          timePunchId: punch.timePunchId as string,
          associateOID: profile.adpAssociateOid,
          punchType: punch.punchType,
          at: punch.at,
        })
        posted++
      }

      await patchEvent(ctx, claim.eventId, {
        status: 'success',
        response: { posted, skipped },
        completedAt: new Date().toISOString(),
      })

      return { success: true, posted, skipped }
    } catch (error) {
      const adpError = sanitizeError(error)

      await patchEvent(ctx, claim.eventId, {
        status: 'error',
        response: { error: adpError },
        completedAt: new Date().toISOString(),
      })

      return { success: false, error: adpError }
    }
  },
})
