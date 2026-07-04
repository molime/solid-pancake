import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { ConvexError } from 'convex/values'
import { requireTenantRole, assertTenantDoc } from './authHelpers'

export const get = query({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
  },
  handler: async (ctx, { clerkOrgId, candidateId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
    ])

    const candidate = await ctx.db.get(candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    return candidate
  },
})

export const create = mutation({
  args: {
    clerkOrgId: v.string(),
    email: v.string(),
    displayName: v.string(),
    phone: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
    ])

    return ctx.db.insert('candidates', {
      tenantId,
      email: args.email,
      displayName: args.displayName,
      phone: args.phone,
      source: args.source,
      status: 'new',
      createdAt: new Date().toISOString(),
    })
  },
})

export const update = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
    status: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
    ])

    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    await ctx.db.patch(args.candidateId, {
      ...(args.status !== undefined && { status: args.status }),
      ...(args.displayName !== undefined && { displayName: args.displayName }),
    })

    return args.candidateId
  },
})
