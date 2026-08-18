import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'
import { computeRetentionUntil } from './documentArchive'

// EVV export aid (21st Century Cures Act §12006; docs/07 §3.5, gap row B8).
// SLS (service code 896) visits require six data elements per visit — service
// type, recipient, date, location, provider, begin/end times — all already
// captured by shifts + GPS timePunches. This module packages them as an
// alternate-EVV submission aid (CSV). It is NOT a live Sandata/CalEVV
// integration.
const EVV_ROLES: ('org:admin' | 'org:coordinator' | 'org:hr')[] = [
  'org:admin',
  'org:coordinator',
  'org:hr',
]

const EVV_MANAGE_ROLES: ('org:admin' | 'org:hr')[] = ['org:admin', 'org:hr']

export const LIVE_IN_ATTESTATION_CATEGORY = 'live_in_attestation'

// A visit is a shift that actually happened and has entered the review
// pipeline (caregiver submitted it). Scheduled/in-progress shifts are not
// visits; needs_correction shifts are excluded until resubmitted.
const VISIT_STATUSES = ['submitted', 'approved', 'billing_ready'] as const

type EvvVisit = {
  shiftId: Id<'shifts'>
  serviceType: 'SLS' | 'ILS'
  clientId: Id<'clients'>
  recipientName: string
  date: string // yyyy-mm-dd
  beginAt: string
  endAt: string
  location: string
  caregiverId: string
  providerName: string
}

function formatServiceAddress(
  address: Doc<'clients'>['serviceAddress'],
): string {
  if (!address) return ''
  const parts = [address.line1, address.line2].filter(Boolean)
  const cityState = [address.city, address.state].filter(Boolean).join(', ')
  if (cityState) parts.push(cityState)
  if (address.postalCode) parts.push(address.postalCode)
  return parts.join(', ')
}

/**
 * Loads the set of live-in-exempt caregiver keys for a tenant: every
 * subjectId on a non-expired live_in_attestation archive item. Items link to
 * employees by employeeProfiles id, but the repo also uses clerkUserId as the
 * subjectId for subjectType 'employee' (see hrCases.checkExpiringCredentials),
 * so callers must check both keys per caregiver.
 */
async function loadLiveInExemptSubjectIds(
  ctx: QueryCtx,
  tenantId: Id<'tenants'>,
) {
  const items = await ctx.db
    .query('documentArchiveItems')
    .withIndex('by_tenant_category_status', (q) =>
      q.eq('tenantId', tenantId).eq('category', LIVE_IN_ATTESTATION_CATEGORY),
    )
    .collect()

  const nowIso = new Date().toISOString()
  const exempt = new Set<string>()
  for (const item of items) {
    if (item.subjectType !== 'employee') continue
    if (item.status !== 'active' && item.status !== 'verified') continue
    if (item.expiresAt && item.expiresAt < nowIso) continue
    exempt.add(item.subjectId)
  }
  return exempt
}

async function buildEvvVisits(
  ctx: QueryCtx,
  tenantId: Id<'tenants'>,
  startDate: string,
  endDate: string,
) {
  const startBound = `${startDate}T00:00:00.000Z`
  const endBound = `${endDate}T23:59:59.999Z`

  const shifts: Doc<'shifts'>[] = []
  for (const status of VISIT_STATUSES) {
    const batch = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('status', status)
          .gte('scheduledStart', startBound)
          .lte('scheduledStart', endBound),
      )
      .collect()
    shifts.push(...batch)
  }
  shifts.sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))

  const clients = await ctx.db
    .query('clients')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .collect()
  const clientById = new Map(clients.map((c) => [c._id as string, c]))

  const members = await ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
    .collect()
  const memberNameByClerkUserId = new Map(
    members.map((m) => [m.clerkUserId, m.displayName]),
  )

  const profiles = await ctx.db
    .query('employeeProfiles')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .collect()
  const profileByClerkUserId = new Map(
    profiles
      .filter((p) => p.clerkUserId)
      .map((p) => [p.clerkUserId as string, p]),
  )

  const exemptSubjectIds = await loadLiveInExemptSubjectIds(ctx, tenantId)

  const visits: EvvVisit[] = []
  let excludedLiveInCount = 0

  for (const shift of shifts) {
    const profile = profileByClerkUserId.get(shift.caregiverId)
    const isLiveInExempt =
      exemptSubjectIds.has(shift.caregiverId) ||
      (profile !== undefined && exemptSubjectIds.has(profile._id as string))
    if (isLiveInExempt) {
      excludedLiveInCount += 1
      continue
    }

    const client = clientById.get(shift.clientId as string)

    // Location: shift override label → clock-in punch target label → punch
    // coordinates → client service address.
    let location = shift.serviceLocationOverride?.label ?? ''
    if (!location) {
      const clockIn = await ctx.db
        .query('timePunches')
        .withIndex('by_tenant_shift_type', (q) =>
          q
            .eq('tenantId', tenantId)
            .eq('shiftId', shift._id)
            .eq('punchType', 'clock_in'),
        )
        .unique()
      if (clockIn?.location) {
        location =
          clockIn.location.targetLabel ??
          `${clockIn.location.latitude},${clockIn.location.longitude}`
      }
    }
    if (!location) {
      location = formatServiceAddress(client?.serviceAddress)
    }

    const beginAt = shift.clockInAt ?? shift.scheduledStart
    const endAt = shift.clockOutAt ?? shift.scheduledEnd

    visits.push({
      shiftId: shift._id,
      serviceType: shift.serviceType,
      clientId: shift.clientId,
      recipientName: client?.displayName ?? 'Unknown',
      date: beginAt.slice(0, 10),
      beginAt,
      endAt,
      location,
      caregiverId: shift.caregiverId,
      providerName:
        memberNameByClerkUserId.get(shift.caregiverId) ??
        profile?.displayName ??
        'Unknown',
    })
  }

  return { visits, excludedLiveInCount }
}

function requireValidDateOnly(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ConvexError(`${label} must be a date (yyyy-mm-dd).`)
  }
}

export const getEvvVisits = query({
  args: {
    clerkOrgId: v.string(),
    startDate: v.string(), // yyyy-mm-dd
    endDate: v.string(), // yyyy-mm-dd
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, EVV_ROLES)
    requireValidDateOnly(args.startDate, 'Start date')
    requireValidDateOnly(args.endDate, 'End date')
    if (args.endDate < args.startDate) {
      throw new ConvexError('End date must be on or after the start date.')
    }
    return buildEvvVisits(ctx, tenantId, args.startDate, args.endDate)
  },
})

/**
 * CSV cell escaping: every field is double-quoted, internal quotes are
 * doubled, embedded newlines are flattened to spaces, and values that start
 * with a formula character (= + - @) are prefixed with an apostrophe so
 * spreadsheet apps cannot execute them. Same conventions as
 * auditReadiness.ts.
 */
function csvCell(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? '' : String(value)
  text = text.replace(/\r?\n/g, ' ')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function csvRow(cells: (string | number | null | undefined)[]) {
  return cells.map(csvCell).join(',')
}

export const exportEvvCsv = query({
  args: {
    clerkOrgId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, tenant } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      EVV_ROLES,
    )
    requireValidDateOnly(args.startDate, 'Start date')
    requireValidDateOnly(args.endDate, 'End date')
    if (args.endDate < args.startDate) {
      throw new ConvexError('End date must be on or after the start date.')
    }

    const { visits, excludedLiveInCount } = await buildEvvVisits(
      ctx,
      tenantId,
      args.startDate,
      args.endDate,
    )

    const rows: string[] = []
    rows.push(csvRow(['ATRIA-X EVV Visit Export (Alternate-EVV Submission Aid)']))
    rows.push(
      csvRow([
        'This file is a submission aid for an approved alternate EVV system. It is not a live Sandata/CalEVV integration.',
      ]),
    )
    rows.push(csvRow(['Agency', tenant.name]))
    rows.push(csvRow(['Generated', new Date().toISOString()]))
    rows.push(csvRow(['Period', args.startDate, 'to', args.endDate]))
    rows.push(
      csvRow(['Live-in caregiver exempt visits excluded', excludedLiveInCount]),
    )
    rows.push('')
    rows.push(
      csvRow([
        'Service Type',
        'Recipient',
        'Date',
        'Begin Time',
        'End Time',
        'Location',
        'Provider',
      ]),
    )
    for (const visit of visits) {
      rows.push(
        csvRow([
          visit.serviceType,
          visit.recipientName,
          visit.date,
          visit.beginAt,
          visit.endAt,
          visit.location,
          visit.providerName,
        ]),
      )
    }

    return rows.join('\r\n')
  },
})

// ---------------------------------------------------------------------------
// Live-in caregiver exemption attestation (DDS EVV guidance; docs/07 §3.5):
// stored as a documentArchiveItems row (category 'live_in_attestation') linked
// to the employee profile. expiresAt is optional; when set, the existing
// expiring_document cron flags renewal like any other credential.
// ---------------------------------------------------------------------------

export const listEvvEmployeeOptions = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, EVV_ROLES)

    const profiles = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()

    return profiles
      .map((profile) => ({
        employeeProfileId: profile._id,
        displayName: profile.displayName,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  },
})

export const listLiveInAttestations = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, EVV_ROLES)

    const items = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_category_status', (q) =>
        q.eq('tenantId', tenantId).eq('category', LIVE_IN_ATTESTATION_CATEGORY),
      )
      .collect()

    const profiles = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const profileNameById = new Map(
      profiles.map((p) => [p._id as string, p.displayName]),
    )
    const profileNameByClerkUserId = new Map(
      profiles
        .filter((p) => p.clerkUserId)
        .map((p) => [p.clerkUserId as string, p.displayName]),
    )

    const nowIso = new Date().toISOString()
    return items
      .map((item) => ({
        _id: item._id,
        subjectId: item.subjectId,
        employeeName:
          profileNameById.get(item.subjectId) ??
          profileNameByClerkUserId.get(item.subjectId) ??
          'Unknown employee',
        status: item.status,
        expiresAt: item.expiresAt ?? null,
        expired: !!item.expiresAt && item.expiresAt < nowIso,
        createdAt: item.createdAt,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
})

export const recordLiveInAttestation = mutation({
  args: {
    clerkOrgId: v.string(),
    employeeProfileId: v.id('employeeProfiles'),
    storageId: v.string(),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    expiresAt: v.optional(v.string()), // ISO
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      EVV_MANAGE_ROLES,
    )

    const profile = await ctx.db.get(args.employeeProfileId)
    if (!profile) throw new ConvexError('Employee profile not found.')
    assertTenantDoc(profile, tenantId)

    if (!args.fileName.trim()) {
      throw new ConvexError('File name is required.')
    }
    if (
      args.expiresAt !== undefined &&
      Number.isNaN(new Date(args.expiresAt).getTime())
    ) {
      throw new ConvexError('Expiration date must be a valid date.')
    }

    const now = new Date().toISOString()
    const fileId = await ctx.db.insert('files', {
      tenantId,
      storageId: args.storageId,
      uploadedBy: identity.subject,
      fileName: args.fileName,
      contentType: args.contentType,
      size: args.size,
      linkedType: 'complianceDoc',
      linkedId: args.employeeProfileId as string,
      visibility: 'admins_coordinators',
      createdAt: now,
    })

    const itemId = await ctx.db.insert('documentArchiveItems', {
      tenantId,
      fileId,
      subjectType: 'employee',
      subjectId: args.employeeProfileId as string,
      category: LIVE_IN_ATTESTATION_CATEGORY,
      status: 'active',
      expiresAt: args.expiresAt,
      retentionUntil: computeRetentionUntil(now),
      createdAt: now,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'live_in_attestation_recorded',
      metadata: {
        itemId: itemId as string,
        employeeProfileId: args.employeeProfileId as string,
        employeeName: profile.displayName,
        expiresAt: args.expiresAt,
      },
    })

    return itemId
  },
})
