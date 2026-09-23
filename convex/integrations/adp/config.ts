import type { QueryCtx } from '../../_generated/server'
import { query } from '../../_generated/server'
import { v } from 'convex/values'
import type { Id } from '../../_generated/dataModel'
import { requireTenantRole } from '../../authHelpers'

declare const process: { env: Record<string, string | undefined> }

const REQUIRED_ENVS = [
  'ADP_TOKEN_URL',
  'ADP_BASE_URL',
  'ADP_CLIENT_ID',
  'ADP_CLIENT_SECRET',
  'ADP_CLIENT_CERT_PEM',
  'ADP_CLIENT_KEY_PEM',
]

export function adpEnvVarNames(): string[] {
  return REQUIRED_ENVS
}

export function areAdpEnvVarsPresent(): boolean {
  return REQUIRED_ENVS.every((name) => Boolean(process.env[name]?.trim()))
}

export async function isAdpConfigured(
  ctx: QueryCtx,
  tenantId: Id<'tenants'>,
): Promise<boolean> {
  if (!areAdpEnvVarsPresent()) return false

  const connection = await ctx.db
    .query('integrationConnections')
    .withIndex('by_tenant_provider', (q) =>
      q.eq('tenantId', tenantId).eq('provider', 'adp'),
    )
    .unique()

  return connection?.status === 'configured'
}

/**
 * Tenant-scoped UI gate: true only when this tenant has a configured ADP
 * connection. Used to hide ADP sync UI for agencies without ADP (e.g. Golden
 * Ages). Intentionally ignores the platform-level ADP_* env vars — those are
 * shared across tenants and say nothing about a specific agency.
 */
export const isAdpConfiguredForTenant = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])
    const connection = await ctx.db
      .query('integrationConnections')
      .withIndex('by_tenant_provider', (q) =>
        q.eq('tenantId', tenantId).eq('provider', 'adp'),
      )
      .unique()
    return connection?.status === 'configured'
  },
})
