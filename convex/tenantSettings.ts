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

export const DEFAULT_SHIFT_TEMPLATES = [
  { value: 'morning', label: 'Morning (7am-3pm)', hoursPerDay: 8, isFullTime: true },
  { value: 'evening', label: 'Evening (3pm-11pm)', hoursPerDay: 8, isFullTime: true },
  { value: 'overnight', label: 'Overnight (11pm-7am)', hoursPerDay: 8, isFullTime: true },
]

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

export const getShiftTemplates = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenant(ctx, clerkOrgId)

    const settings = await ctx.db
      .query('tenantSettings')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .unique()

    return settings?.shiftTemplates ?? DEFAULT_SHIFT_TEMPLATES
  },
})

export const getEmployerInfo = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, tenant } = await requireTenant(ctx, clerkOrgId)

    const settings = await ctx.db
      .query('tenantSettings')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .unique()

    return {
      legalName: settings?.employerInfo?.legalName ?? tenant.name,
      address: tenant.address ?? '',
      phone: settings?.employerInfo?.phone ?? '',
      ein: tenant.ein ?? '',
      caEmployerAccountNumber: settings?.employerInfo?.caEmployerAccountNumber ?? '',
      homeCareOrganizationNumber: settings?.employerInfo?.homeCareOrganizationNumber ?? '',
      liveScanOri: settings?.employerInfo?.liveScanOri ?? '',
      liveScanMailCode: settings?.employerInfo?.liveScanMailCode ?? '',
    }
  },
})

export const updateShiftTemplates = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftTemplates: v.array(
      v.object({
        value: v.string(),
        label: v.string(),
        hoursPerDay: v.optional(v.number()),
        isFullTime: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    if (!args.shiftTemplates.length) {
      throw new Error('At least one shift template is required.')
    }

    const existing = await ctx.db
      .query('tenantSettings')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .unique()

    if (existing) {
      assertTenantDoc(existing, tenantId)
      await ctx.db.patch(existing._id, { shiftTemplates: args.shiftTemplates })
      return existing._id
    }

    return await ctx.db.insert('tenantSettings', {
      tenantId,
      shiftGeofence: DEFAULT_SHIFT_GEOFENCE,
      shiftTemplates: args.shiftTemplates,
    })
  },
})
