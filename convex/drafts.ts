import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requireTenantRole } from './authHelpers'

export const getDraft = query({
  args: { clerkOrgId: v.string(), formType: v.string() },
  handler: async (ctx, { clerkOrgId, formType }) => {
    const { tenantId, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:candidate',
    ])

    const candidate = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_clerk_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .unique()

    if (!candidate) return null

    return await ctx.db
      .query('drafts')
      .withIndex('by_tenant_candidate_type', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidate._id).eq('formType', formType),
      )
      .first()
  },
})

export const saveDraft = mutation({
  args: { clerkOrgId: v.string(), formType: v.string(), data: v.any() },
  handler: async (ctx, { clerkOrgId, formType, data }) => {
    const { tenantId, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:candidate',
    ])

    const candidate = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_clerk_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .unique()

    if (!candidate) {
      throw new Error('Candidate profile not found.')
    }

    const existing = await ctx.db
      .query('drafts')
      .withIndex('by_tenant_candidate_type', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidate._id).eq('formType', formType),
      )
      .first()

    const now = new Date().toISOString()
    if (existing) {
      await ctx.db.patch(existing._id, { data, updatedAt: now })
      return existing._id
    }

    return await ctx.db.insert('drafts', {
      tenantId,
      candidateId: candidate._id,
      formType,
      data,
      updatedAt: now,
    })
  },
})

export const deleteDraft = mutation({
  args: { clerkOrgId: v.string(), formType: v.string() },
  handler: async (ctx, { clerkOrgId, formType }) => {
    const { tenantId, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:candidate',
    ])

    const candidate = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_clerk_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .unique()

    if (!candidate) return

    const existing = await ctx.db
      .query('drafts')
      .withIndex('by_tenant_candidate_type', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidate._id).eq('formType', formType),
      )
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})
