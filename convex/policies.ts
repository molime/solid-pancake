import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTenant, requireTenantRole } from './authHelpers'
import { STAFF_POLICIES, STAFF_POLICY_VERSIONS } from './_utils/staffPolicies'
import { internal } from './_generated/api'

/**
 * Staff policy acknowledgments (compliance mini-phase, Stage 4).
 *
 * Policy text is versioned code constants (`_utils/staffPolicies.ts`) — the
 * single source of truth — so every tenant always acknowledges the same
 * wording and bumping a version in code re-surfaces the policy for every
 * user. This module only tracks WHO acknowledged WHICH version, per tenant.
 */

/** Roles that must acknowledge staff policies (candidates use their own flow). */
const STAFF_ROLES: string[] = [
  'org:admin',
  'org:coordinator',
  'org:caregiver',
  'org:hr',
]

/**
 * Policies the current user has NOT acknowledged at their current version.
 * Any authenticated tenant member (including caregivers and candidates with
 * a role) may call this; the agency shell uses it to decide whether to show
 * the blocking acknowledgment modal.
 */
export const getPendingAcknowledgments = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenant(ctx, args.clerkOrgId)

    const pending = []
    for (const policy of STAFF_POLICIES) {
      const existing = await ctx.db
        .query('policyAcknowledgments')
        .withIndex('by_tenant_user_policy', (q) =>
          q
            .eq('tenantId', tenantId)
            .eq('userId', identity.subject)
            .eq('policyKey', policy.key)
            .eq('policyVersion', policy.version),
        )
        .unique()
      if (!existing) {
        pending.push({ key: policy.key, version: policy.version, title: policy.title })
      }
    }
    return pending
  },
})

/**
 * Records that the current user acknowledges a policy at a given version.
 * `policyVersion` must not exceed the current version of the policy (older
 * versions are accepted so historical/test acknowledgments don't fail, but
 * they do not satisfy the current-version pending check). Idempotent per
 * (tenant, user, key, version) via the unique index.
 */
export const acknowledge = mutation({
  args: {
    clerkOrgId: v.string(),
    policyKey: v.string(),
    policyVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenant(ctx, args.clerkOrgId)

    const currentVersion = STAFF_POLICY_VERSIONS[args.policyKey]
    if (currentVersion === undefined) {
      throw new ConvexError(`Unknown policy key: ${args.policyKey}`)
    }
    if (
      !Number.isInteger(args.policyVersion) ||
      args.policyVersion < 0 ||
      args.policyVersion > currentVersion
    ) {
      throw new ConvexError(
        `Invalid version ${args.policyVersion} for ${args.policyKey} (current: ${currentVersion}).`,
      )
    }

    const existing = await ctx.db
      .query('policyAcknowledgments')
      .withIndex('by_tenant_user_policy', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('userId', identity.subject)
          .eq('policyKey', args.policyKey)
          .eq('policyVersion', args.policyVersion),
      )
      .unique()
    if (existing) return existing._id

    const acknowledgedAt = new Date().toISOString()
    const ackId = await ctx.db.insert('policyAcknowledgments', {
      tenantId,
      userId: identity.subject,
      policyKey: args.policyKey,
      policyVersion: args.policyVersion,
      acknowledgedAt,
      createdAt: acknowledgedAt,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'policy.acknowledged',
      kind: 'tenant',
      metadata: {
        policyKey: args.policyKey,
        policyVersion: args.policyVersion,
      },
    })

    return ackId
  },
})

/**
 * Admin/HR roster: for each staff policy, every staff member with the
 * version they acknowledged (or 'pending'). One tenant-scanned read groups
 * all acknowledgment rows, then member rows come from tenantMembers.
 */
export const listAcknowledgmentStatus = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) =>
        // Collect per role keeps the index usable; staff rosters are small.
        q.eq('tenantId', tenantId),
      )
      .collect()
    const staff = members.filter((m) => STAFF_ROLES.includes(m.role))

    const acks = await ctx.db
      .query('policyAcknowledgments')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .collect()

    // Latest acknowledgment per (user, policyKey), regardless of version.
    const latest = new Map<string, { version: number; at: string }>()
    for (const ack of acks) {
      const mapKey = `${ack.userId}::${ack.policyKey}`
      const current = latest.get(mapKey)
      if (!current || ack.policyVersion > current.version) {
        latest.set(mapKey, { version: ack.policyVersion, at: ack.acknowledgedAt })
      }
    }

    return STAFF_POLICIES.map((policy) => ({
      key: policy.key,
      version: policy.version,
      title: policy.title,
      effectiveDate: policy.effectiveDate,
      members: staff.map((member) => {
        const ack = latest.get(`${member.clerkUserId}::${policy.key}`)
        return {
          clerkUserId: member.clerkUserId,
          displayName: member.displayName,
          role: member.role,
          status:
            ack && ack.version >= policy.version ? ('current' as const) : ('pending' as const),
          acknowledgedVersion: ack?.version ?? null,
          acknowledgedAt: ack?.at ?? null,
        }
      }),
    }))
  },
})

