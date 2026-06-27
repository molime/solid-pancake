import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { assertTenantDoc, requireTenant, requireTenantRole } from './authHelpers'

export const DEFAULT_SHIFT_GEOFENCE = {
  enabled: false,
  enforceClockIn: false,
  enforceClockOut: false,
  defaultRadiusMeters: 150,
  maxAccuracyMeters: 100,
}

export const get = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenant(ctx, clerkOrgId)

    const settings = await ctx.db
      .query('tenantSettings')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .unique()

    if (!settings) {
      return {
        tenantId,
        shiftGeofence: DEFAULT_SHIFT_GEOFENCE,
      }
    }

    assertTenantDoc(settings, tenantId)
    return settings
  },
})

export const updateShiftGeofence = mutation({
  args: {
    clerkOrgId: v.string(),
    enabled: v.boolean(),
    enforceClockIn: v.boolean(),
    enforceClockOut: v.boolean(),
    defaultRadiusMeters: v.number(),
    maxAccuracyMeters: v.number(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    if (!Number.isFinite(args.defaultRadiusMeters) || args.defaultRadiusMeters <= 0) {
      throw new Error('defaultRadiusMeters must be greater than zero.')
    }

    if (!Number.isFinite(args.maxAccuracyMeters) || args.maxAccuracyMeters <= 0) {
      throw new Error('maxAccuracyMeters must be greater than zero.')
    }

    const existing = await ctx.db
      .query('tenantSettings')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .unique()

    const shiftGeofence = {
      enabled: args.enabled,
      enforceClockIn: args.enforceClockIn,
      enforceClockOut: args.enforceClockOut,
      defaultRadiusMeters: args.defaultRadiusMeters,
      maxAccuracyMeters: args.maxAccuracyMeters,
    }

    if (existing) {
      assertTenantDoc(existing, tenantId)
      await ctx.db.patch(existing._id, { shiftGeofence })
      return existing._id
    }

    return await ctx.db.insert('tenantSettings', {
      tenantId,
      shiftGeofence,
    })
  },
})
