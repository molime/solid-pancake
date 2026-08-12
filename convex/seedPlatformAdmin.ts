// Temporary seed script — adds platformAdmins record + seeds pricing plans
// Usage: npx convex run seedPlatformAdmin:seedPlatformAdminAndPlans '{"clerkUserId":"USER_ID_HERE"}'
// Then remove this file after seeding.
import { internalMutation } from './_generated/server'
import { v } from 'convex/values'

const DEFAULT_PLANS = [
  { key: 'starter', label: 'Starter', basePrice: 199, includedSeats: 10, perSeatPrice: 20, active: true },
  { key: 'professional', label: 'Professional', basePrice: 499, includedSeats: 25, perSeatPrice: 18, active: true },
  { key: 'enterprise', label: 'Enterprise', basePrice: 999, includedSeats: 50, perSeatPrice: 15, active: true },
]

export const seedPlatformAdminAndPlans = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    // Add platform admin
    const existing = await ctx.db
      .query('platformAdmins')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', args.clerkUserId))
      .first()
    if (!existing) {
      await ctx.db.insert('platformAdmins', {
        clerkUserId: args.clerkUserId,
        createdAt: new Date().toISOString(),
      })
    }

    // Seed pricing plans
    for (const plan of DEFAULT_PLANS) {
      const existingPlan = await ctx.db
        .query('pricingPlans')
        .withIndex('by_key', (q) => q.eq('key', plan.key))
        .first()
      if (!existingPlan) {
        await ctx.db.insert('pricingPlans', plan)
      }
    }

    return { success: true, adminAdded: !existing, plansSeeded: true }
  },
})