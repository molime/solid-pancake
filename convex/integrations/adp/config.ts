import type { QueryCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'

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
