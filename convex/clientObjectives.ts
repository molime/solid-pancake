import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'

// IPP/ISP objectives per client (docs/07 §3.4, gap row B2). Quarterly SLS and
// semi-annual ILS progress reports are built from shift documentation tagged
// to these objectives.

const OBJECTIVE_READ_ROLES: (
  | 'org:admin'
  | 'org:coordinator'
  | 'org:hr'
  | 'org:caregiver'
)[] = ['org:admin', 'org:coordinator', 'org:hr', 'org:caregiver']

const OBJECTIVE_MANAGE_ROLES: ('org:admin' | 'org:coordinator' | 'org:hr')[] = [
  'org:admin',
  'org:coordinator',
  'org:hr',
]

const objectiveSourceValidator = v.union(v.literal('ipp'), v.literal('isp'))

const objectiveStatusValidator = v.union(
  v.literal('active'),
  v.literal('achieved'),
  v.literal('discontinued'),
)

async function loadClient(
  ctx: QueryCtx | MutationCtx,
  clientId: Id<'clients'>,
  tenantId: Id<'tenants'>,
) {
  const client = await ctx.db.get(clientId)
  if (!client) throw new ConvexError('Client not found.')
  assertTenantDoc(client, tenantId)
  return client
}

async function loadObjective(
  ctx: QueryCtx | MutationCtx,
  objectiveId: Id<'clientObjectives'>,
  tenantId: Id<'tenants'>,
) {
  const objective = await ctx.db.get(objectiveId)
  if (!objective) throw new ConvexError('Client objective not found.')
  assertTenantDoc(objective, tenantId)
  return objective
}

function validateTargetDate(targetDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new ConvexError('Target date must be an ISO date (yyyy-mm-dd).')
  }
}

export const listByClient = query({
  args: { clerkOrgId: v.string(), clientId: v.id('clients') },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      OBJECTIVE_READ_ROLES,
    )
    await loadClient(ctx, args.clientId, tenantId)

    return ctx.db
      .query('clientObjectives')
      .withIndex('by_tenant_client', (q) =>
        q.eq('tenantId', tenantId).eq('clientId', args.clientId),
      )
      .collect()
  },
})

export const create = mutation({
  args: {
    clerkOrgId: v.string(),
    clientId: v.id('clients'),
    title: v.string(),
    description: v.optional(v.string()),
    source: objectiveSourceValidator,
    targetDate: v.optional(v.string()),
    hoursPerMonth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      OBJECTIVE_MANAGE_ROLES,
    )
    await loadClient(ctx, args.clientId, tenantId)

    if (!args.title.trim()) throw new ConvexError('Objective title is required.')
    if (args.targetDate !== undefined) validateTargetDate(args.targetDate)
    if (args.hoursPerMonth !== undefined && args.hoursPerMonth <= 0) {
      throw new ConvexError('Hours per month must be greater than zero.')
    }

    const objectiveId = await ctx.db.insert('clientObjectives', {
      tenantId,
      clientId: args.clientId,
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      source: args.source,
      targetDate: args.targetDate,
      hoursPerMonth: args.hoursPerMonth,
      status: 'active',
      createdAt: new Date().toISOString(),
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'objective_created',
      metadata: {
        objectiveId: objectiveId as string,
        clientId: args.clientId as string,
        title: args.title.trim(),
        source: args.source,
      },
    })

    return objectiveId
  },
})

export const update = mutation({
  args: {
    clerkOrgId: v.string(),
    objectiveId: v.id('clientObjectives'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    source: v.optional(objectiveSourceValidator),
    targetDate: v.optional(v.string()),
    hoursPerMonth: v.optional(v.number()),
    status: v.optional(objectiveStatusValidator),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      OBJECTIVE_MANAGE_ROLES,
    )
    const objective = await loadObjective(ctx, args.objectiveId, tenantId)

    const patch: Record<string, unknown> = {}
    if (args.title !== undefined) {
      if (!args.title.trim()) {
        throw new ConvexError('Objective title is required.')
      }
      patch.title = args.title.trim()
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined
    }
    if (args.source !== undefined) patch.source = args.source
    if (args.targetDate !== undefined) {
      validateTargetDate(args.targetDate)
      patch.targetDate = args.targetDate
    }
    if (args.hoursPerMonth !== undefined) {
      if (args.hoursPerMonth <= 0) {
        throw new ConvexError('Hours per month must be greater than zero.')
      }
      patch.hoursPerMonth = args.hoursPerMonth
    }

    const statusChanged =
      args.status !== undefined && args.status !== objective.status
    if (args.status !== undefined) patch.status = args.status

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.objectiveId, patch)
    }

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: statusChanged ? 'objective_status_changed' : 'objective_updated',
      previousStatus: statusChanged ? objective.status : undefined,
      nextStatus: statusChanged ? args.status : undefined,
      metadata: {
        objectiveId: args.objectiveId as string,
        clientId: objective.clientId as string,
      },
    })

    return args.objectiveId
  },
})

export const discontinue = mutation({
  args: {
    clerkOrgId: v.string(),
    objectiveId: v.id('clientObjectives'),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      OBJECTIVE_MANAGE_ROLES,
    )
    const objective = await loadObjective(ctx, args.objectiveId, tenantId)

    if (objective.status !== 'discontinued') {
      await ctx.db.patch(args.objectiveId, { status: 'discontinued' })

      await ctx.runMutation(internal.audit.record, {
        clerkOrgId: args.clerkOrgId,
        action: 'objective_status_changed',
        previousStatus: objective.status,
        nextStatus: 'discontinued',
        metadata: {
          objectiveId: args.objectiveId as string,
          clientId: objective.clientId as string,
        },
      })
    }

    return args.objectiveId
  },
})
