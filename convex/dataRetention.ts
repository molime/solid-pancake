import { ConvexError, v } from 'convex/values'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { assertTenantDoc, requireTenantRole } from './authHelpers'
import { normalizeEmail } from './adpSync'

// ---------------------------------------------------------------------------
// Data lifecycle (compliance mini-phase, Stage 2): automated retention purge
// with a fully visible deletion log. Offboarded employees' data (files +
// storage objects, SSN fields in applications/drafts) is purged once
// `offboardedAt` is older than the retention window (17 CCR §54326, default 5
// years, per-tenant override in tenantSettings.purgeRetentionYears), and
// document-archive items are purged once past `retentionUntil`. Records under
// legal hold are never deleted — they are logged as skipped instead. Every
// deletion (or skip) writes a `deletionEvents` row: the visible track of what
// was deleted, when, on what legal basis, and by whom ('system' for the daily
// cron sweep).
// ---------------------------------------------------------------------------

export const DEFAULT_PURGE_RETENTION_YEARS = 5

export const OFFBOARDED_LEGAL_BASIS = '17 CCR 54326 five-year retention'
export const DOCUMENT_LEGAL_BASIS = 'document retention schedule'

// Max subjects purged per sweep run; when more remain, the action schedules a
// continuation via ctx.scheduler.runAfter.
const SWEEP_CAP = 100

/** ISO cutoff: profiles offboarded before this are past the retention window. */
function retentionCutoffIso(retentionYears: number, nowMs = Date.now()): string {
  const date = new Date(nowMs)
  date.setUTCFullYear(date.getUTCFullYear() - retentionYears)
  return date.toISOString()
}

/**
 * Redact the SSN fields inside an application/draft JSON blob while keeping
 * the rest of the record (name, dates) intact for the legal record. Returns
 * the patched blob, or null when nothing needed redacting.
 */
const SSN_SECTION_KEYS = ['personal', 'i9', 'w4'] as const

function redactSsnSections(fields: unknown): Record<string, unknown> | null {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null
  const source = fields as Record<string, unknown>
  let changed = false
  const result: Record<string, unknown> = { ...source }
  for (const key of SSN_SECTION_KEYS) {
    const section = source[key]
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue
    const record = section as Record<string, unknown>
    if (record.ssn === undefined || record.ssn === null) continue
    result[key] = { ...record, ssn: null }
    changed = true
  }
  return changed ? result : null
}

/** Per-tenant retention override, defaulting to the 17 CCR five-year window. */
async function retentionYearsForTenant(
  ctx: { db: QueryCtx['db'] },
  tenantId: Id<'tenants'>,
): Promise<number> {
  const settings = await ctx.db
    .query('tenantSettings')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .unique()
  return settings?.purgeRetentionYears ?? DEFAULT_PURGE_RETENTION_YEARS
}

export const getRetentionYearsInternal = internalQuery({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => retentionYearsForTenant(ctx, args.tenantId),
})

/** Employee profiles whose offboarding is older than the retention window. */
export const listDueOffboardedProfiles = internalQuery({
  args: { tenantId: v.id('tenants'), retentionYears: v.number() },
  handler: async (ctx, args) => {
    const cutoff = retentionCutoffIso(args.retentionYears)
    const profiles = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', args.tenantId))
      .collect()
    return profiles
      .filter(
        (profile) =>
          !profile.purgedAt &&
          profile.offboardedAt &&
          profile.offboardedAt <= cutoff,
      )
      .map((profile) => profile._id)
  },
})

export const listTenantsForSweep = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('tenants').collect()
  },
})

export const listTenantAdmins = internalQuery({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    const admins = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', args.tenantId).eq('role', 'org:admin'),
      )
      .collect()
    return admins.map((admin) => ({
      clerkUserId: admin.clerkUserId,
      email: admin.email,
    }))
  },
})

/**
 * Admin preview of everything the next purge will touch. No destructive
 * action — lists offboarded employees past the retention window and archive
 * items past retentionUntil (excluding legal holds), with counts.
 */
export const getPurgePreview = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const retentionYears = await retentionYearsForTenant(ctx, tenantId)
    const cutoff = retentionCutoffIso(retentionYears)
    const nowIso = new Date().toISOString()

    const profiles = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const offboardedEmployees = profiles
      .filter(
        (profile) =>
          !profile.purgedAt &&
          profile.offboardedAt &&
          profile.offboardedAt <= cutoff,
      )
      .map((profile) => ({
        _id: profile._id,
        displayName: profile.displayName,
        email: profile.email,
        offboardedAt: profile.offboardedAt as string,
      }))

    const items = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .collect()
    const pastRetention = items.filter(
      (item) => item.retentionUntil && item.retentionUntil <= nowIso,
    )
    const due = pastRetention.filter((item) => !item.legalHold)
    const expiredDocuments = []
    for (const item of due.slice(0, 100)) {
      const file = await ctx.db.get(item.fileId)
      expiredDocuments.push({
        _id: item._id,
        category: item.category,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        retentionUntil: item.retentionUntil as string,
        fileName: file?.fileName ?? null,
      })
    }

    return {
      retentionYears,
      generatedAt: nowIso,
      offboardedEmployees,
      expiredDocuments,
      counts: {
        offboardedEmployees: offboardedEmployees.length,
        expiredDocuments: due.length,
        heldPastRetention: pastRetention.length - due.length,
      },
    }
  },
})

/**
 * Purge one offboarded employee's data (internal — invoked by the daily sweep
 * with actorId 'system' and by requestOffboardedPurge with the admin's id):
 * deletes their archived documents and uploaded files from Convex Storage,
 * redacts SSN fields in their applications/drafts, skips anything under legal
 * hold, and writes the deletionEvents row (the visible track).
 */
export const purgeOffboardedEmployee = internalMutation({
  args: {
    employeeProfileId: v.id('employeeProfiles'),
    tenantId: v.id('tenants'),
    actorId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.employeeProfileId)
    if (!profile) throw new ConvexError('Employee profile not found.')
    assertTenantDoc(profile, args.tenantId)
    const tenantId = args.tenantId
    const now = new Date().toISOString()

    // Archive items may reference the employee by profile id or clerk user id
    // (same convention as documentArchive.addEmployeeCredentialDocument).
    const subjectIds = [profile._id as string]
    if (profile.clerkUserId) subjectIds.push(profile.clerkUserId)

    let documentsPurged = 0
    let legalHoldSkipped = 0
    const archivedFileIds = new Set<Id<'files'>>()
    const heldFileIds = new Set<Id<'files'>>()

    for (const subjectId of subjectIds) {
      const items = await ctx.db
        .query('documentArchiveItems')
        .withIndex('by_tenant_subject', (q) =>
          q.eq('tenantId', tenantId).eq('subjectType', 'employee').eq('subjectId', subjectId),
        )
        .collect()
      for (const item of items) {
        archivedFileIds.add(item.fileId)
        if (item.legalHold) {
          // Legal hold suspends the retention window — never delete.
          legalHoldSkipped += 1
          heldFileIds.add(item.fileId)
          await ctx.db.insert('deletionEvents', {
            tenantId,
            actorId: args.actorId,
            subjectType: 'offboarded_employee',
            subjectId: profile._id as string,
            legalBasis: OFFBOARDED_LEGAL_BASIS,
            status: 'skipped_legal_hold',
            detail: `Archive item ${item._id} (category: ${item.category}) left intact under legal hold.`,
            createdAt: now,
          })
          continue
        }
        const file = await ctx.db.get(item.fileId)
        if (file) {
          // Legacy/seed rows can carry a non-storage placeholder id — delete
          // best-effort, same as the seed cleanup mutations.
          await ctx.storage.delete(file.storageId as Id<'_storage'>).catch(() => {})
          await ctx.db.delete(file._id)
        }
        await ctx.db.delete(item._id)
        documentsPurged += 1
      }
    }

    // Files the person uploaded that are not part of an archived item.
    let filesDeleted = 0
    if (profile.clerkUserId) {
      const uploaded = await ctx.db
        .query('files')
        .withIndex('by_tenant_uploaded', (q) =>
          q.eq('tenantId', tenantId).eq('uploadedBy', profile.clerkUserId as string),
        )
        .collect()
      for (const file of uploaded) {
        if (archivedFileIds.has(file._id)) continue
        if (heldFileIds.has(file._id)) continue
        await ctx.storage.delete(file.storageId as Id<'_storage'>).catch(() => {})
        await ctx.db.delete(file._id)
        filesDeleted += 1
      }
    }

    // Redact SSN in the person's candidate application/draft history. The
    // person links to a candidate row by clerkUserId or normalized email.
    const candidateIds = new Set<Id<'candidates'>>()
    if (profile.clerkUserId) {
      const byClerkUser = await ctx.db
        .query('candidates')
        .withIndex('by_tenant_clerk_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', profile.clerkUserId as string),
        )
        .unique()
      if (byClerkUser) candidateIds.add(byClerkUser._id)
    }
    const byEmail = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) =>
        q.eq('tenantId', tenantId).eq('email', normalizeEmail(profile.email)),
      )
      .unique()
    if (byEmail) candidateIds.add(byEmail._id)

    let applicationsRedacted = 0
    let draftsRedacted = 0
    for (const candidateId of candidateIds) {
      const applications = await ctx.db
        .query('applications')
        .withIndex('by_candidate', (q) => q.eq('candidateId', candidateId))
        .collect()
      for (const application of applications) {
        const redacted = redactSsnSections(application.fields)
        if (!redacted) continue
        await ctx.db.patch(application._id, { fields: redacted })
        applicationsRedacted += 1
      }
      const drafts = await ctx.db
        .query('drafts')
        .withIndex('by_tenant_candidate', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId),
        )
        .collect()
      for (const draft of drafts) {
        const redacted = redactSsnSections(draft.data)
        if (!redacted) continue
        await ctx.db.patch(draft._id, { data: redacted })
        draftsRedacted += 1
      }
    }

    await ctx.db.insert('deletionEvents', {
      tenantId,
      actorId: args.actorId,
      subjectType: 'offboarded_employee',
      subjectId: profile._id as string,
      legalBasis: OFFBOARDED_LEGAL_BASIS,
      status: 'executed',
      executedAt: now,
      detail:
        `Purged ${documentsPurged} archived document(s) and ${filesDeleted} uploaded file(s); ` +
        `redacted SSN in ${applicationsRedacted} application(s) and ${draftsRedacted} draft(s); ` +
        `${legalHoldSkipped} item(s) skipped under legal hold.`,
      createdAt: now,
    })

    // Mark the profile purged so the daily sweep does not re-process it
    // (the profile row itself stays as the minimal legal record).
    await ctx.db.patch(profile._id, { purgedAt: now })

    return {
      documentsPurged,
      filesDeleted,
      applicationsRedacted,
      draftsRedacted,
      legalHoldSkipped,
    }
  },
})

/**
 * Purge document-archive items past retentionUntil (legal-hold items are
 * never due). Deletes the storage object + file row + archive row and writes
 * a deletionEvents row per item.
 */
export const purgeExpiredDocuments = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    actorId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString()
    const items = (
      await ctx.db
        .query('documentArchiveItems')
        .withIndex('by_tenant_created', (q) => q.eq('tenantId', args.tenantId))
        .collect()
    ).filter(
      (item) => item.retentionUntil && item.retentionUntil <= now && !item.legalHold,
    )

    const due = items.slice(0, args.limit)
    let deleted = 0
    for (const item of due) {
      const file = await ctx.db.get(item.fileId)
      if (file) {
        await ctx.storage.delete(file.storageId as Id<'_storage'>).catch(() => {})
        await ctx.db.delete(file._id)
      }
      await ctx.db.delete(item._id)
      await ctx.db.insert('deletionEvents', {
        tenantId: args.tenantId,
        actorId: args.actorId,
        subjectType: 'expired_document',
        subjectId: item._id as string,
        legalBasis: DOCUMENT_LEGAL_BASIS,
        status: 'executed',
        executedAt: now,
        detail: `Archive item (category: ${item.category}; file: ${file?.fileName ?? 'unknown'}) past retentionUntil ${item.retentionUntil}.`,
        createdAt: now,
      })
      deleted += 1
    }

    return { deleted, remaining: items.length - deleted }
  },
})

/**
 * Daily cron (06:45 UTC): purges due offboarded employees and expired
 * documents across all tenants, capped per run — when more subjects remain,
 * a continuation is scheduled via ctx.scheduler.runAfter. Each affected
 * tenant's org:admins get one summary notification (counts only, never
 * sensitive content). Purges are naturally deduped: a purged subject is no
 * longer due, so the next run has nothing to repeat.
 */
export const runRetentionSweep = internalAction({
  args: {},
  // Explicit return type: the handler self-references the module through
  // `internal.dataRetention.*` (including this action for continuations), so
  // without an annotation TS cannot break the inference cycle.
  handler: async (
    ctx,
  ): Promise<{
    tenantsScanned: number
    tenantsPurged: number
    hasMore: boolean
  }> => {
    const tenants = await ctx.runQuery(internal.dataRetention.listTenantsForSweep)
    let budget = SWEEP_CAP
    const summaries: Array<{
      tenantId: Id<'tenants'>
      offboarded: number
      documents: number
    }> = []
    let hasMore = false

    for (const tenant of tenants) {
      if (budget <= 0) {
        hasMore = true
        break
      }
      const retentionYears = await ctx.runQuery(
        internal.dataRetention.getRetentionYearsInternal,
        { tenantId: tenant._id },
      )
      const dueProfiles = await ctx.runQuery(
        internal.dataRetention.listDueOffboardedProfiles,
        { tenantId: tenant._id, retentionYears },
      )

      let offboarded = 0
      for (const profileId of dueProfiles) {
        if (budget <= 0) {
          hasMore = true
          break
        }
        await ctx.runMutation(internal.dataRetention.purgeOffboardedEmployee, {
          employeeProfileId: profileId,
          tenantId: tenant._id,
          actorId: 'system',
        })
        offboarded += 1
        budget -= 1
      }

      let documents = 0
      if (!hasMore && budget > 0) {
        const docResult = await ctx.runMutation(
          internal.dataRetention.purgeExpiredDocuments,
          { tenantId: tenant._id, actorId: 'system', limit: budget },
        )
        documents = docResult.deleted
        budget -= docResult.deleted
        if (docResult.remaining > 0) hasMore = true
      }

      if (offboarded > 0 || documents > 0) {
        summaries.push({ tenantId: tenant._id, offboarded, documents })
      }
      if (hasMore) break
    }

    if (hasMore) {
      await ctx.scheduler.runAfter(
        60 * 1000,
        internal.dataRetention.runRetentionSweep,
        {},
      )
    }

    for (const summary of summaries) {
      const admins = await ctx.runQuery(internal.dataRetention.listTenantAdmins, {
        tenantId: summary.tenantId,
      })
      const message =
        `Automated retention sweep purged data for ${summary.offboarded} offboarded ` +
        `employee(s) and ${summary.documents} expired document(s). ` +
        `See Data lifecycle for the full deletion log.`
      for (const admin of admins) {
        await ctx.runMutation(internal._utils.notifications.insertNotification, {
          tenantId: summary.tenantId,
          clerkUserId: admin.clerkUserId,
          type: 'data_retention_sweep',
          message,
        })
      }
    }

    return {
      tenantsScanned: tenants.length,
      tenantsPurged: summaries.length,
      hasMore,
    }
  },
})

/**
 * Manual admin purge of one offboarded employee from the Data lifecycle
 * preview. Runs the purge immediately with the admin as actor and writes the
 * audited `data_lifecycle.purge_executed` event (category derives to
 * 'data_lifecycle' automatically).
 */
export const requestOffboardedPurge = mutation({
  args: {
    clerkOrgId: v.string(),
    employeeProfileId: v.id('employeeProfiles'),
  },
  // Explicit return type — the handler calls back into this module via
  // `internal.dataRetention.*`, which otherwise circularizes inference.
  handler: async (
    ctx,
    args,
  ): Promise<{
    documentsPurged: number
    filesDeleted: number
    applicationsRedacted: number
    draftsRedacted: number
    legalHoldSkipped: number
  }> => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const profile = await ctx.db.get(args.employeeProfileId)
    if (!profile) throw new ConvexError('Employee profile not found.')
    assertTenantDoc(profile, tenantId)

    const result = await ctx.runMutation(
      internal.dataRetention.purgeOffboardedEmployee,
      {
        employeeProfileId: args.employeeProfileId,
        tenantId,
        actorId: identity.subject,
      },
    )

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'data_lifecycle.purge_executed',
      metadata: {
        subjectType: 'offboarded_employee',
        subjectId: args.employeeProfileId as string,
        ...result,
      },
    })

    return result
  },
})

/**
 * The deletion log: every deletionEvents row for this tenant, newest first,
 * with an optional date window. This is the "completely visible track" of
 * what was deleted, when, on what legal basis, and by whom.
 */
export const listDeletionEvents = query({
  args: {
    clerkOrgId: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    // Date-only end bounds are treated as inclusive end-of-day.
    const endBound =
      args.endDate !== undefined
        ? args.endDate.length === 10
          ? `${args.endDate}T23:59:59.999Z`
          : args.endDate
        : undefined

    return await ctx.db
      .query('deletionEvents')
      .withIndex('by_tenant_created_at', (q) => {
        const base = q.eq('tenantId', tenantId)
        if (args.startDate && endBound) {
          return base.gte('createdAt', args.startDate).lte('createdAt', endBound)
        }
        if (args.startDate) return base.gte('createdAt', args.startDate)
        if (endBound) return base.lte('createdAt', endBound)
        return base
      })
      .order('desc')
      .take(500)
  },
})
