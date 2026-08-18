import { v, ConvexError } from 'convex/values'
import { query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireTenantRole, assertTenantDoc } from './authHelpers'

// Evidence lineage (docs/07 §5, gap row B7): the auditor-facing join across
// billing line → shift → GPS time punches → progress notes → review events →
// export batch/invoice. All data already exists; this module only joins and
// presents it. Read-only — no mutations.

const EVIDENCE_ROLES: ('org:admin' | 'org:coordinator' | 'org:hr')[] = [
  'org:admin',
  'org:coordinator',
  'org:hr',
]

function isBlank(value: string | undefined | null) {
  return !value || value.trim() === ''
}

/**
 * Loads the evidence chain for one billing line and computes whether it is
 * complete: a clock-in punch, a clock-out punch, at least one progress note
 * with a non-blank narrative, and at least one review event. Shared with
 * auditReadiness.buildReport so the dashboard's lineage spot-check count and
 * this view always agree.
 */
export async function loadLineEvidence(
  ctx: QueryCtx,
  tenantId: Id<'tenants'>,
  line: Doc<'billingLines'>,
) {
  const shift = await ctx.db.get(line.shiftId)
  const punches = shift
    ? await ctx.db
        .query('timePunches')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shift._id),
        )
        .collect()
    : []
  const notes = shift
    ? await ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shift._id),
        )
        .collect()
    : []
  const reviews = shift
    ? await ctx.db
        .query('reviewEvents')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shift._id),
        )
        .collect()
    : []

  const hasClockIn = punches.some((punch) => punch.punchType === 'clock_in')
  const hasClockOut = punches.some((punch) => punch.punchType === 'clock_out')
  const hasNote = notes.some((note) => !isBlank(note.narrative))
  const complete =
    !!shift && hasClockIn && hasClockOut && hasNote && reviews.length > 0

  return { shift, punches, notes, reviews, complete }
}

async function loadMemberNames(ctx: QueryCtx, tenantId: Id<'tenants'>) {
  const members = await ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
    .collect()
  return new Map(members.map((member) => [member.clerkUserId, member.displayName]))
}

/**
 * Full evidence chain for one billing line — the per-shift auditor view
 * reachable from the billing ledger ("View evidence").
 */
export const getShiftEvidence = query({
  args: {
    clerkOrgId: v.string(),
    billingLineId: v.id('billingLines'),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      EVIDENCE_ROLES,
    )

    const line = await ctx.db.get(args.billingLineId)
    if (!line) throw new ConvexError('Billing line not found.')
    assertTenantDoc(line, tenantId)

    const { shift, punches, notes, reviews, complete } =
      await loadLineEvidence(ctx, tenantId, line)
    if (shift) assertTenantDoc(shift, tenantId)

    const client = shift ? await ctx.db.get(shift.clientId) : null
    const memberNames = await loadMemberNames(ctx, tenantId)
    const batch = line.exportBatchId
      ? await ctx.db.get(line.exportBatchId)
      : null

    return {
      line: {
        _id: line._id,
        hours: line.hours,
        rate: line.rate,
        amount: line.amount,
        blockedReason: line.blockedReason,
        blockedAt: line.blockedAt,
        createdAt: line.createdAt,
      },
      shift: shift
        ? {
            _id: shift._id,
            status: shift.status,
            serviceType: shift.serviceType,
            scheduledStart: shift.scheduledStart,
            scheduledEnd: shift.scheduledEnd,
            clockInAt: shift.clockInAt,
            clockOutAt: shift.clockOutAt,
          }
        : null,
      client: client
        ? {
            _id: client._id,
            displayName: client.displayName,
            serviceType: client.serviceType,
          }
        : null,
      caregiverName: shift
        ? (memberNames.get(shift.caregiverId) ?? shift.caregiverId)
        : null,
      punches: punches.map((punch) => ({
        _id: punch._id,
        punchType: punch.punchType,
        at: punch.at,
        withinGeofence: punch.location?.withinGeofence,
        distanceMeters: punch.location?.distanceMeters,
        targetLabel: punch.location?.targetLabel,
      })),
      notes: notes.map((note) => ({
        _id: note._id,
        startTime: note.startTime,
        endTime: note.endTime,
        servicesProvided: note.servicesProvided,
        clientResponse: note.clientResponse,
        narrative: note.narrative,
        submittedBy: note.submittedBy,
        submittedAt: note.submittedAt,
      })),
      reviews: reviews.map((review) => ({
        _id: review._id,
        decision: review.decision,
        comment: review.comment,
        complianceOverride: review.complianceOverride,
        complianceOverrideReason: review.complianceOverrideReason,
        reviewerName:
          memberNames.get(review.reviewerId) ?? review.reviewerId,
        createdAt: review.createdAt,
      })),
      invoice: batch
        ? {
            _id: batch._id,
            name: batch.name,
            invoiceNumber: batch.invoiceNumber,
            status: batch.status,
            exportedAt: batch.exportedAt,
          }
        : null,
      evidenceComplete: complete,
    }
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

function gpsCell(withinGeofence: boolean | undefined) {
  if (withinGeofence === undefined) return ''
  return withinGeofence ? 'within geofence' : 'outside geofence'
}

/**
 * Date-ranged CSV export of the evidence lineage: one row per billing line
 * created in the range with chain-completeness columns.
 */
export const exportEvidenceCsv = query({
  args: {
    clerkOrgId: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      EVIDENCE_ROLES,
    )

    // Date-only end bounds are treated as inclusive end-of-day.
    const endBound =
      args.endDate !== undefined
        ? args.endDate.length === 10
          ? `${args.endDate}T23:59:59.999Z`
          : args.endDate
        : undefined

    let lines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) => q.eq('tenantId', tenantId))
      .collect()

    if (args.startDate) {
      lines = lines.filter((line) => line.createdAt >= args.startDate!)
    }
    if (endBound) {
      lines = lines.filter((line) => line.createdAt <= endBound)
    }

    const memberNames = await loadMemberNames(ctx, tenantId)

    const rows: string[] = []
    rows.push(csvRow(['ATRIA-X Billing Evidence Lineage']))
    rows.push(csvRow(['Generated', new Date().toISOString()]))
    rows.push(
      csvRow([
        'Period',
        `${args.startDate ?? ''} to ${args.endDate ?? ''}`,
      ]),
    )
    rows.push('')
    rows.push(
      csvRow([
        'Client',
        'Caregiver',
        'Service Type',
        'Shift Date',
        'Hours',
        'Rate',
        'Amount',
        'Clock In',
        'Clock In GPS',
        'Clock Out',
        'Clock Out GPS',
        'Progress Notes',
        'Review Decision',
        'Compliance Override',
        'Invoice',
        'Blocked Reason',
      ]),
    )

    for (const line of lines) {
      const { shift, punches, notes, reviews } = await loadLineEvidence(
        ctx,
        tenantId,
        line,
      )
      const client = shift ? await ctx.db.get(shift.clientId) : null
      const batch = line.exportBatchId
        ? await ctx.db.get(line.exportBatchId)
        : null
      const clockIn = punches.find((punch) => punch.punchType === 'clock_in')
      const clockOut = punches.find((punch) => punch.punchType === 'clock_out')
      const latestReview = reviews[reviews.length - 1]

      rows.push(
        csvRow([
          client?.displayName ?? 'Unknown',
          shift
            ? (memberNames.get(shift.caregiverId) ?? shift.caregiverId)
            : '',
          shift?.serviceType ?? '',
          shift?.scheduledStart.slice(0, 10) ?? '',
          line.hours,
          line.rate,
          line.amount,
          clockIn?.at,
          gpsCell(clockIn?.location?.withinGeofence),
          clockOut?.at,
          gpsCell(clockOut?.location?.withinGeofence),
          notes.filter((note) => !isBlank(note.narrative)).length,
          latestReview?.decision ?? '',
          latestReview?.complianceOverride ? 'yes' : '',
          batch?.invoiceNumber ?? batch?.name ?? '',
          line.blockedReason ?? '',
        ]),
      )
    }

    return rows.join('\r\n')
  },
})
