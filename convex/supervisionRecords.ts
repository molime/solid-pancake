import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'

// Supervision notes + annual employee performance evaluations (17 CCR
// §58615(b)(5) — docs/07 §3.2, gap row C4). Append-only: no update/delete
// mutations; corrections are new entries.
const SUPERVISION_ROLES: ('org:admin' | 'org:hr')[] = ['org:admin', 'org:hr']

const supervisionKindValidator = v.union(
  v.literal('supervision'),
  v.literal('annual_evaluation'),
)

export const addSupervisionRecord = mutation({
  args: {
    clerkOrgId: v.string(),
    employeeProfileId: v.id('employeeProfiles'),
    kind: supervisionKindValidator,
    occurredAt: v.string(), // ISO
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      SUPERVISION_ROLES,
    )

    const profile = await ctx.db.get(args.employeeProfileId)
    if (!profile) throw new ConvexError('Employee profile not found.')
    assertTenantDoc(profile, tenantId)

    if (!args.summary.trim()) {
      throw new ConvexError('Summary is required.')
    }
    if (Number.isNaN(new Date(args.occurredAt).getTime())) {
      throw new ConvexError('Date must be a valid date/time.')
    }

    const recordId = await ctx.db.insert('supervisionRecords', {
      tenantId,
      employeeProfileId: args.employeeProfileId,
      kind: args.kind,
      occurredAt: args.occurredAt,
      summary: args.summary,
      recordedBy: identity.subject,
      createdAt: new Date().toISOString(),
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'supervision_record_added',
      metadata: {
        recordId: recordId as string,
        employeeProfileId: args.employeeProfileId as string,
        kind: args.kind,
      },
    })

    return recordId
  },
})

export const listSupervisionRecords = query({
  args: {
    clerkOrgId: v.string(),
    employeeProfileId: v.id('employeeProfiles'),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      SUPERVISION_ROLES,
    )

    const profile = await ctx.db.get(args.employeeProfileId)
    if (!profile) throw new ConvexError('Employee profile not found.')
    assertTenantDoc(profile, tenantId)

    const records = await ctx.db
      .query('supervisionRecords')
      .withIndex('by_tenant_employee', (q) =>
        q.eq('tenantId', tenantId).eq('employeeProfileId', args.employeeProfileId),
      )
      .collect()

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()
    const memberNames = new Map(
      members.map((member) => [member.clerkUserId, member.displayName]),
    )

    return records
      .map((record) => ({
        ...record,
        recordedByName: memberNames.get(record.recordedBy) ?? 'Unknown user',
      }))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  },
})
