import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { ConvexError } from 'convex/values'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'
import { getFileMetadata } from './files'

const ALLOWED_STATUSES = ['active', 'verified', 'rejected'] as const
type DocumentStatus = (typeof ALLOWED_STATUSES)[number]

function isValidStatus(status: string): status is DocumentStatus {
  return (ALLOWED_STATUSES as readonly string[]).includes(status)
}

// ---------------------------------------------------------------------------
// Record retention (17 CCR §54326(a)(3)): service records must be retained at
// least 5 years, longer when under audit/legal hold. New archive items get
// retentionUntil = createdAt + 5 years at creation (see candidates.ts); the
// legalHold flag suspends the window for audits or litigation.
// ---------------------------------------------------------------------------

export const RETENTION_YEARS = 5
export const RETENTION_REPORT_WINDOW_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

/** Calendar-year addition on an ISO timestamp (UTC). */
export function computeRetentionUntil(createdAtIso: string): string {
  const date = new Date(createdAtIso)
  date.setUTCFullYear(date.getUTCFullYear() + RETENTION_YEARS)
  return date.toISOString()
}

const legalHoldTableValidator = v.union(
  v.literal('documentArchiveItems'),
  v.literal('specialIncidents'),
  v.literal('progressReports'),
)

/**
 * Sets or clears the legal-hold flag on a retention-governed record
 * (org:admin only). Records under hold must never be deleted; any future
 * delete path for these tables must refuse deletion while legalHold is set or
 * retentionUntil is in the future.
 */
export const setLegalHold = mutation({
  args: {
    clerkOrgId: v.string(),
    table: legalHoldTableValidator,
    recordId: v.string(),
    legalHold: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const recordId = ctx.db.normalizeId(args.table, args.recordId)
    if (!recordId) {
      throw new ConvexError('Record not found.')
    }
    const record = await ctx.db.get(recordId)
    if (!record) {
      throw new ConvexError('Record not found.')
    }
    assertTenantDoc(record, tenantId)

    await ctx.db.patch(recordId, { legalHold: args.legalHold })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'legal_hold_updated',
      metadata: {
        table: args.table,
        recordId,
        legalHold: args.legalHold,
      },
    })

    return recordId
  },
})

/**
 * Retention report for the audit dashboard: per record type, how many records
 * are under legal hold and how many approach their retention deadline
 * (retentionUntil, or createdAt + 5 years for records that predate the
 * field) within the next 90 days.
 */
export const getRetentionReport = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const windowEndIso = new Date(
      now + RETENTION_REPORT_WINDOW_DAYS * DAY_MS,
    ).toISOString()

    const archiveItems = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .collect()
    const incidents = await ctx.db
      .query('specialIncidents')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .collect()
    const progressReports = await ctx.db
      .query('progressReports')
      .withIndex('by_tenant_client_period', (q) => q.eq('tenantId', tenantId))
      .collect()

    const summarize = (
      key: string,
      label: string,
      records: {
        createdAt: string
        retentionUntil?: string
        legalHold?: boolean
      }[],
    ) => {
      let expiringSoon = 0
      let legalHold = 0
      for (const record of records) {
        if (record.legalHold) legalHold += 1
        const deadline = record.retentionUntil ?? computeRetentionUntil(record.createdAt)
        if (deadline > nowIso && deadline <= windowEndIso) expiringSoon += 1
      }
      return { key, label, total: records.length, expiringSoon, legalHold }
    }

    return {
      windowDays: RETENTION_REPORT_WINDOW_DAYS,
      recordTypes: [
        summarize('documentArchiveItems', 'Archived documents', archiveItems),
        summarize('specialIncidents', 'Special incident reports', incidents),
        summarize('progressReports', 'Progress reports', progressReports),
      ],
    }
  },
})

export const listDocumentArchive = query({
  args: {
    clerkOrgId: v.string(),
    linkedTo: v.optional(
      v.object({
        subjectType: v.string(),
        subjectId: v.string(),
      }),
    ),
    status: v.optional(v.string()),
    documentType: v.optional(v.string()),
    expiringSoonDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
    ])

    let items = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .collect()

    if (args.linkedTo) {
      items = items.filter(
        (item) =>
          item.subjectType === args.linkedTo?.subjectType &&
          item.subjectId === args.linkedTo?.subjectId,
      )
    }

    if (args.status) {
      items = items.filter((item) => item.status === args.status)
    }

    if (args.documentType) {
      items = items.filter((item) => item.category === args.documentType)
    }

    if (args.expiringSoonDays !== undefined) {
      const cutoff = new Date(
        Date.now() + args.expiringSoonDays * 24 * 60 * 60 * 1000,
      ).toISOString()
      items = items.filter((item) => item.expiresAt && item.expiresAt <= cutoff)
    }

    items = items.slice(0, 100)

    return await Promise.all(
      items.map(async (item) => {
        const file = await getFileMetadata(ctx, item.fileId)
        return {
          ...item,
          file: file
            ? {
                fileName: file.fileName,
                contentType: file.contentType,
                size: file.size,
                storageId: file.storageId,
                uploadedBy: file.uploadedBy,
                fileCreatedAt: file.createdAt,
              }
            : null,
        }
      }),
    )
  },
})

export const updateDocumentArchiveItem = mutation({
  args: {
    clerkOrgId: v.string(),
    itemId: v.id('documentArchiveItems'),
    status: v.string(),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const item = await ctx.db.get(args.itemId)
    if (!item) {
      throw new ConvexError('Document archive item not found.')
    }
    assertTenantDoc(item, tenantId)

    if (!isValidStatus(args.status)) {
      throw new ConvexError(
        `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}.`,
      )
    }

    const previousStatus = item.status
    const now = new Date().toISOString()
    const patch: {
      status: DocumentStatus
      verifiedBy?: string
      verifiedAt?: string
      rejectionReason?: string
    } = { status: args.status }

    if (args.status === 'verified') {
      patch.verifiedBy = identity.subject
      patch.verifiedAt = now
      patch.rejectionReason = undefined
    } else if (args.status === 'rejected') {
      if (!args.rejectionReason || !args.rejectionReason.trim()) {
        throw new ConvexError('Rejection reason is required when rejecting a document.')
      }
      patch.rejectionReason = args.rejectionReason
      patch.verifiedBy = undefined
      patch.verifiedAt = undefined
    } else {
      patch.verifiedBy = undefined
      patch.verifiedAt = undefined
      patch.rejectionReason = undefined
    }

    await ctx.db.patch(args.itemId, patch)

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'document.status_updated',
      previousStatus,
      nextStatus: args.status,
      metadata: { itemId: args.itemId as string, rejectionReason: args.rejectionReason },
    })

    return args.itemId
  },
})
