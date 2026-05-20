import { v } from 'convex/values'
import { action, query, mutation } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { api } from './_generated/api'

type ComplianceCategory =
  | 'billing'
  | 'documentation'
  | 'credentialing'
  | 'policy'

interface SearchComplianceResult {
  _id: string
  title: string
  body: string
  category: ComplianceCategory
  score: number
}

export const searchCompliance = action({
  args: {
    clerkOrgId: v.string(),
    query: v.string(),
    category: v.optional(
      v.union(
        v.literal('billing'),
        v.literal('documentation'),
        v.literal('credentialing'),
        v.literal('policy'),
      ),
    ),
  },
  handler: async (ctx, args): Promise<SearchComplianceResult[]> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthorized')

    const tenant = await ctx.runQuery(api.tenants.get, {
      clerkOrgId: args.clerkOrgId,
    })
    if (!tenant) throw new Error('Tenant not found')

    const member = await ctx.runQuery(api.members.me, {
      clerkOrgId: args.clerkOrgId,
    })
    if (!member) throw new Error('Forbidden')

    const embedding = await ctx.runAction(
      api.embedding.deterministicEmbedding,
      {
        text: args.query,
      },
    )

    const results = await ctx.vectorSearch(
      'complianceDocs',
      'by_tenant_embedding',
      {
        vector: embedding,
        limit: 20,
        filter: (q) => q.eq('tenantId', tenant._id),
      },
    )

    const docs: SearchComplianceResult[] = []
    for (const r of results) {
      const doc = await ctx.runQuery(api.search.fetchDoc, {
        clerkOrgId: args.clerkOrgId,
        docId: r._id,
      })
      if (
        doc &&
        (!args.category || doc.category === args.category) &&
        (member.role !== 'org:caregiver' ||
          (doc.visibility ?? 'all_staff') === 'all_staff')
      ) {
        docs.push({ ...doc, score: r._score })
      }
    }

    return docs
  },
})

function generateEmbedding(text: string): number[] {
  const DIMENSIONS = 32
  const vector = Array.from({ length: DIMENSIONS }, () => 0)
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  tokens.forEach((token, index) => {
    const hash = hashToken(`${token}:${index}`)
    const slot = Math.abs(hash) % DIMENSIONS
    const sign = hash % 2 === 0 ? 1 : -1
    vector[slot] += sign * (1 + token.length / 12)
  })

  const magnitude = Math.sqrt(
    vector.reduce((sum: number, value: number) => sum + value ** 2, 0),
  )
  return magnitude === 0
    ? vector
    : vector.map((value) => Number((value / magnitude).toFixed(6)))
}

function hashToken(token: string): number {
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash
}

export const fetchDoc = query({
  args: {
    clerkOrgId: v.string(),
    docId: v.id('complianceDocs'),
  },
  handler: async (ctx, { clerkOrgId, docId }) => {
    const { tenantId, role } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:caregiver',
    ])
    const doc = await ctx.db.get(docId)
    if (!doc) return null
    assertTenantDoc(doc, tenantId)
    if (
      role === 'org:caregiver' &&
      (doc.visibility ?? 'all_staff') !== 'all_staff'
    ) {
      return null
    }
    return {
      _id: doc._id,
      title: doc.title,
      body: doc.body,
      category: doc.category,
      visibility: doc.visibility ?? 'all_staff',
    }
  },
})

export const createComplianceDoc = mutation({
  args: {
    clerkOrgId: v.string(),
    title: v.string(),
    body: v.string(),
    category: v.union(
      v.literal('billing'),
      v.literal('documentation'),
      v.literal('credentialing'),
      v.literal('policy'),
    ),
    visibility: v.optional(
      v.union(v.literal('all_staff'), v.literal('admins_coordinators')),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    docId: import('./_generated/dataModel').Id<'complianceDocs'>
  }> => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const docId = await ctx.db.insert('complianceDocs', {
      tenantId,
      title: args.title,
      body: args.body,
      category: args.category,
      visibility: args.visibility ?? 'all_staff',
      embedding: generateEmbedding(`${args.title} ${args.body}`),
    })

    return { docId }
  },
})
