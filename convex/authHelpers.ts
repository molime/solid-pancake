import type { QueryCtx, MutationCtx, ActionCtx } from './_generated/server'
import { ConvexError } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { api } from './_generated/api'

export type AuthContext = QueryCtx | MutationCtx
export type TenantRole =
  | 'org:admin'
  | 'org:coordinator'
  | 'org:caregiver'
  | 'org:hr'
  | 'org:candidate'

export async function requireIdentity(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError('Unauthorized: authentication required.')
  }
  return identity
}

export async function requireTenant(ctx: AuthContext, clerkOrgId: string) {
  const identity = await requireIdentity(ctx)
  requireMatchingClerkOrganization(identity, clerkOrgId)

  // Caregiver/candidate path: the user is a regular Clerk user with NO org
  // membership, so the JWT carries no org claim. Resolve their memberships via
  // tenantMembers by Clerk user id and require one record's tenant to match
  // the requested clerkOrgId. The member record is what authorizes them. A
  // user may belong to multiple tenants, so match against ALL their records —
  // taking only .first() could falsely reject a valid membership.
  if (!getActiveClerkOrganizationId(identity)) {
    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', identity.subject),
      )
      .collect()

    let member = null
    let tenant = null
    for (const candidate of members) {
      const candidateTenant = await ctx.db.get(candidate.tenantId)
      if (candidateTenant && candidateTenant.clerkOrgId === clerkOrgId) {
        member = candidate
        tenant = candidateTenant
        break
      }
    }

    if (!member || !tenant) {
      throw new ConvexError('Forbidden: not a member of this tenant.')
    }

    return {
      tenantId: tenant._id,
      tenant,
      clerkOrgId,
      identity,
      member,
      role: member.role,
    }
  }

  const tenant = await ctx.db
    .query('tenants')
    .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
    .unique()

  if (!tenant) {
    throw new ConvexError('Unauthorized: tenant not found.')
  }

  const member = await ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenant._id).eq('clerkUserId', identity.subject),
    )
    .unique()

  if (!member) {
    throw new ConvexError('Forbidden: not a member of this tenant.')
  }

  return {
    tenantId: tenant._id,
    tenant,
    clerkOrgId,
    identity,
    member,
    role: member.role,
  }
}

export async function requireTenantRole(
  ctx: AuthContext,
  clerkOrgId: string,
  allowedRoles: TenantRole[],
) {
  const { tenantId, tenant, identity, member, role } = await requireTenant(
    ctx,
    clerkOrgId,
  )

  if (!allowedRoles.includes(role)) {
    throw new ConvexError(
      `Forbidden: required one of [${allowedRoles.join(', ')}].`,
    )
  }

  return { tenantId, tenant, clerkOrgId, identity, member, role }
}

export function assertTenantDoc<T extends { tenantId: unknown }>(
  doc: T,
  tenantId: Id<'tenants'>,
): asserts doc is T & { tenantId: Id<'tenants'> } {
  if (doc.tenantId !== tenantId) {
    throw new ConvexError('Forbidden: cross-tenant access denied.')
  }
}

export async function getTenantByClerkOrgId(
  ctx: AuthContext,
  clerkOrgId: string,
) {
  return ctx.db
    .query('tenants')
    .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
    .unique()
}

function normalizeTenantRole(role: unknown): TenantRole | null {
  if (
    role === 'org:admin' ||
    role === 'org:coordinator' ||
    role === 'org:caregiver' ||
    role === 'org:hr' ||
    role === 'org:candidate'
  ) {
    return role
  }

  if (role === 'admin') return 'org:admin'
  if (role === 'coordinator') return 'org:coordinator'
  if (role === 'caregiver') return 'org:caregiver'
  if (role === 'hr') return 'org:hr'
  if (role === 'candidate') return 'org:candidate'

  return null
}

export function getActiveClerkOrganizationId(identity: {
  [key: string]: unknown
}) {
  if (typeof identity.org_id === 'string') return identity.org_id

  const compactOrg = identity.o
  if (
    compactOrg &&
    typeof compactOrg === 'object' &&
    'id' in compactOrg &&
    typeof (compactOrg as Record<string, unknown>).id === 'string'
  ) {
    return (compactOrg as Record<string, unknown>).id as string
  }

  if (typeof identity['o.id'] === 'string') return identity['o.id']

  return null
}

function getAtriaRoleFromMetadata(metadata: unknown): TenantRole | null {
  if (
    metadata &&
    typeof metadata === 'object' &&
    'atriaRole' in metadata
  ) {
    return normalizeTenantRole((metadata as Record<string, unknown>).atriaRole)
  }
  return null
}

/**
 * Resolves the ATRIA tenant role from a Clerk token.
 *
 * Priority order (highest first):
 * 1. Top-level `org_role` when it is already an ATRIA role.
 * 2. `org_public_metadata.atriaRole` (set server-side by Clerk invitations/bypass).
 * 3. Compact JWT claim `o.rol`.
 * 4. Compact JWT metadata claim `o.pub.atriaRole`.
 * 5. Dotted JWT metadata claim `o.pub.atriaRole`.
 * 6. Dotted JWT role claim `o.rol`.
 *
 * Public metadata is checked before compact claims so that server-set ATRIA
 * roles carried by `org:member` users are honored over raw JWT fields.
 */
export function getClerkOrganizationRole(identity: {
  [key: string]: unknown
}): TenantRole | null {
  const topLevelRole = normalizeTenantRole(identity.org_role)
  if (topLevelRole) return topLevelRole

  const metadataRole = getAtriaRoleFromMetadata(identity.org_public_metadata)
  if (metadataRole) return metadataRole

  const compactOrg = identity.o
  if (compactOrg && typeof compactOrg === 'object') {
    const compactRole = normalizeTenantRole(
      (compactOrg as Record<string, unknown>).rol,
    )
    if (compactRole) return compactRole

    const compactMetadata = (compactOrg as Record<string, unknown>).pub
    const compactMetadataRole = getAtriaRoleFromMetadata(compactMetadata)
    if (compactMetadataRole) return compactMetadataRole
  }

  const dottedMetadataRole = getAtriaRoleFromMetadata(identity['o.pub'])
  if (dottedMetadataRole) return dottedMetadataRole

  return normalizeTenantRole(identity['o.rol'])
}

export function requireMatchingClerkOrganization(
  identity: { [key: string]: unknown },
  clerkOrgId: string,
) {
  const activeOrgId = getActiveClerkOrganizationId(identity)
  if (typeof activeOrgId === 'string' && activeOrgId !== clerkOrgId) {
    throw new ConvexError('Forbidden: active Clerk organization mismatch.')
  }
}

/** Stricter variant that REQUIRES org_id to be present and match.
 *  Use for bootstrap mutations where missing org context is suspicious.
 */
export function requireActiveClerkOrganization(
  identity: { [key: string]: unknown },
  clerkOrgId: string,
) {
  const activeOrgId = getActiveClerkOrganizationId(identity)
  if (!activeOrgId) {
    throw new ConvexError(
      'Forbidden: active Clerk organization required but missing from token.',
    )
  }
  if (activeOrgId !== clerkOrgId) {
    throw new ConvexError('Forbidden: active Clerk organization mismatch.')
  }
}

export async function ensureTenantMember(
  ctx: AuthContext,
  tenantId: Id<'tenants'>,
  clerkUserId: string,
) {
  return ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId),
    )
    .unique()
}

export async function requireTenantRoleAction(
  ctx: ActionCtx,
  clerkOrgId: string,
  allowedRoles: TenantRole[],
) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError('Unauthorized: authentication required.')
  }
  requireMatchingClerkOrganization(identity, clerkOrgId)

  const member = await ctx.runQuery(api.members.me, { clerkOrgId })
  if (!member) {
    throw new ConvexError('Forbidden: not a member of this tenant.')
  }

  const role = normalizeTenantRole(member.role)
  if (!role || !allowedRoles.includes(role)) {
    throw new ConvexError(
      `Forbidden: required one of [${allowedRoles.join(', ')}].`,
    )
  }

  return { identity, member, role, clerkOrgId }
}
