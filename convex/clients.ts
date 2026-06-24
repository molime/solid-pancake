import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'

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
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    if (!args.displayName.trim()) throw new Error('Client name is required.')
    if (args.authorizationHours <= 0) {
      throw new Error('Authorization hours must be greater than zero.')
    }

    return ctx.db.insert('clients', {
      tenantId,
      displayName: args.displayName.trim(),
      serviceType: args.serviceType,
      authorizationHours: args.authorizationHours,
      riskFlags: args.riskFlags,
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
