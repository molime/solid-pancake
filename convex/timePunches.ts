import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertTenantDoc, requireTenantRole } from './authHelpers'
import type { TenantRole } from './authHelpers'

type PunchActor = {
  role: TenantRole
  clerkUserId: string
}

export function assertPunchAuthorized(
  actor: PunchActor,
  caregiverId: string,
) {
  if (actor.role === 'org:caregiver' && actor.clerkUserId !== caregiverId) {
    throw new Error('Caregivers can only act on their assigned shifts.')
  }
}

export const get = query({
  args: { clerkOrgId: v.string(), punchId: v.id('timePunches') },
  handler: async (ctx, { clerkOrgId, punchId }) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      clerkOrgId,
      ['org:admin', 'org:coordinator', 'org:caregiver'],
    )

    const punch = await ctx.db.get(punchId)
    if (!punch) throw new Error('Time punch not found.')
    assertTenantDoc(punch, tenantId)
    assertPunchAuthorized(
      { role, clerkUserId: identity.subject },
      punch.caregiverId,
    )
    return punch
  },
})
