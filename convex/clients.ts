import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'

// Client master-record profile fields (docs/07 §3.1, gap row B1) — all
// optional, so existing clients and callers are unaffected.
const clientProfileArgs = {
  uci: v.optional(v.string()),
  dob: v.optional(v.string()),
  conservatorName: v.optional(v.string()),
  conservatorPhone: v.optional(v.string()),
  emergencyContacts: v.optional(
    v.array(
      v.object({
        name: v.string(),
        phone: v.string(),
        relationship: v.string(),
      }),
    ),
  ),
  regionalCenter: v.optional(v.string()),
  serviceCoordinatorName: v.optional(v.string()),
  serviceCoordinatorEmail: v.optional(v.string()),
  vendorNumber: v.optional(v.string()),
  serviceCode: v.optional(v.string()),
}

const PROFILE_FIELD_NAMES = Object.keys(clientProfileArgs)

function validateProfileFields(args: {
  dob?: string
  emergencyContacts?: { name: string; phone: string; relationship: string }[]
}) {
  if (args.dob !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(args.dob)) {
    throw new Error('Date of birth must be an ISO date (yyyy-mm-dd).')
  }
  if (args.emergencyContacts !== undefined) {
    for (const contact of args.emergencyContacts) {
      if (!contact.name.trim()) {
        throw new Error('Emergency contacts must include a name.')
      }
    }
  }
}

function buildProfilePatch(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const field of PROFILE_FIELD_NAMES) {
    if (args[field] !== undefined) patch[field] = args[field]
  }
  return patch
}

export const list = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    return ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .order('asc')
      .take(200)
  },
})

export const get = query({
  args: { clerkOrgId: v.string(), clientId: v.id('clients') },
  handler: async (ctx, { clerkOrgId, clientId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
    ])
    const client = await ctx.db.get(clientId)
    if (!client) throw new Error('Client not found.')
    assertTenantDoc(client, tenantId)
    return client
  },
})

export const create = mutation({
  args: {
    clerkOrgId: v.string(),
    displayName: v.string(),
    serviceType: v.union(v.literal('SLS'), v.literal('ILS')),
    authorizationHours: v.number(),
    riskFlags: v.array(v.string()),
    ...clientProfileArgs,
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    if (!args.displayName.trim()) throw new Error('Client name is required.')
    if (args.authorizationHours <= 0) {
      throw new Error('Authorization hours must be greater than zero.')
    }
    validateProfileFields(args)

    return ctx.db.insert('clients', {
      tenantId,
      displayName: args.displayName.trim(),
      serviceType: args.serviceType,
      authorizationHours: args.authorizationHours,
      riskFlags: args.riskFlags,
      ...buildProfilePatch(args),
    })
  },
})

const serviceAddressValidator = v.optional(
  v.object({
    line1: v.string(),
    line2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    postalCode: v.string(),
    country: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  }),
)

export const update = mutation({
  args: {
    clerkOrgId: v.string(),
    clientId: v.id('clients'),
    displayName: v.optional(v.string()),
    serviceType: v.optional(v.union(v.literal('SLS'), v.literal('ILS'))),
    authorizationHours: v.optional(v.number()),
    riskFlags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const client = await ctx.db.get(args.clientId)
    if (!client) throw new Error('Client not found.')
    assertTenantDoc(client, tenantId)

    const patch: Record<string, unknown> = {}
    if (args.displayName !== undefined) {
      if (!args.displayName.trim()) throw new Error('Client name is required.')
      patch.displayName = args.displayName.trim()
    }
    if (args.serviceType !== undefined) patch.serviceType = args.serviceType
    if (args.authorizationHours !== undefined) {
      if (args.authorizationHours <= 0) {
        throw new Error('Authorization hours must be greater than zero.')
      }
      patch.authorizationHours = args.authorizationHours
    }
    if (args.riskFlags !== undefined) patch.riskFlags = args.riskFlags

    await ctx.db.patch(args.clientId, patch)
    return args.clientId
  },
})

/**
 * Updates the client master-record profile fields (docs/07 gap row B1). Only
 * the new optional profile fields are patchable here — the legacy scalar
 * fields stay on `update` (org:admin) so existing behavior is untouched.
 */
export const updateProfile = mutation({
  args: {
    clerkOrgId: v.string(),
    clientId: v.id('clients'),
    ...clientProfileArgs,
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
    ])

    const client = await ctx.db.get(args.clientId)
    if (!client) throw new Error('Client not found.')
    assertTenantDoc(client, tenantId)

    validateProfileFields(args)
    const patch = buildProfilePatch(args)

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.clientId, patch)

      await ctx.runMutation(internal.audit.record, {
        clerkOrgId: args.clerkOrgId,
        action: 'client_profile_updated',
        metadata: {
          clientId: args.clientId as string,
          fields: Object.keys(patch),
        },
      })
    }

    return args.clientId
  },
})

/**
 * Delivered vs authorized hours for one client in a calendar month
 * (docs/07 §3.1 — no billing beyond authorized, actually-provided services).
 * Shifts in `approved` or `billing_ready` status count as delivered; hours come
 * from the GPS punches when both exist, else the scheduled window. `month` is
 * 'YYYY-MM' (UTC) and defaults to the current month.
 */
export const getMonthlyUsage = query({
  args: {
    clerkOrgId: v.string(),
    clientId: v.id('clients'),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
    ])

    const client = await ctx.db.get(args.clientId)
    if (!client) throw new Error('Client not found.')
    assertTenantDoc(client, tenantId)

    const month = args.month ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new Error('Month must be in YYYY-MM format.')
    }
    const [year, monthIndex] = month.split('-').map(Number)
    const startIso = new Date(Date.UTC(year, monthIndex - 1, 1)).toISOString()
    const endIso = new Date(Date.UTC(year, monthIndex, 1)).toISOString()

    const delivered = await collectMonthShifts(ctx, tenantId, startIso, endIso)

    let deliveredHours = 0
    for (const shift of delivered) {
      if (shift.clientId !== args.clientId) continue
      const start = shift.clockInAt ?? shift.scheduledStart
      const end = shift.clockOutAt ?? shift.scheduledEnd
      const hours =
        (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000
      if (hours > 0) deliveredHours += hours
    }

    return {
      month,
      deliveredHours: Math.round(deliveredHours * 100) / 100,
      authorizedHours: client.authorizationHours,
    }
  },
})

async function collectMonthShifts(
  ctx: QueryCtx,
  tenantId: Id<'tenants'>,
  startIso: string,
  endIso: string,
) {
  const statuses = ['approved', 'billing_ready'] as const
  const results: Doc<'shifts'>[] = []
  for (const status of statuses) {
    const shifts = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('status', status)
          .gte('scheduledStart', startIso)
          .lt('scheduledStart', endIso),
      )
      .collect()
    results.push(...shifts)
  }
  return results
}

export const updateServiceAddress = mutation({
  args: {
    clerkOrgId: v.string(),
    clientId: v.id('clients'),
    serviceAddress: serviceAddressValidator,
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const client = await ctx.db.get(args.clientId)
    if (!client) throw new Error('Client not found.')
    assertTenantDoc(client, tenantId)

    if (args.serviceAddress !== undefined) {
      if (
        args.serviceAddress.latitude !== undefined ||
        args.serviceAddress.longitude !== undefined
      ) {
        if (
          args.serviceAddress.latitude === undefined ||
          args.serviceAddress.longitude === undefined
        ) {
          throw new Error(
            'Latitude and longitude must both be provided or both omitted.',
          )
        }

        if (
          !Number.isFinite(args.serviceAddress.latitude) ||
          args.serviceAddress.latitude < -90 ||
          args.serviceAddress.latitude > 90
        ) {
          throw new Error('latitude must be between -90 and 90.')
        }

        if (
          !Number.isFinite(args.serviceAddress.longitude) ||
          args.serviceAddress.longitude < -180 ||
          args.serviceAddress.longitude > 180
        ) {
          throw new Error('longitude must be between -180 and 180.')
        }
      }
    }

    await ctx.db.patch(args.clientId, {
      serviceAddress: args.serviceAddress,
    })

    return args.clientId
  },
})

export const remove = mutation({
  args: { clerkOrgId: v.string(), clientId: v.id('clients') },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const client = await ctx.db.get(args.clientId)
    if (!client) throw new Error('Client not found.')
    assertTenantDoc(client, tenantId)

    const linkedShift = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
      .filter((q) => q.eq(q.field('clientId'), args.clientId))
      .first()

    if (linkedShift) {
      throw new Error(
        'Cannot delete a client with scheduled or documented shifts.',
      )
    }

    await ctx.db.delete(args.clientId)
    return args.clientId
  },
})
