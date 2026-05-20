import { describe, expect, it } from 'vitest'
import {
  getActiveClerkOrganizationId,
  getClerkOrganizationRole,
} from './authHelpers'

describe('Convex members exports', () => {
  it('exports list, me, sync, updateRole, and remove', async () => {
    const mod = await import('./members')
    expect(mod).toHaveProperty('list')
    expect(mod).toHaveProperty('me')
    expect(mod).toHaveProperty('sync')
    expect(mod).toHaveProperty('updateRole')
    expect(mod).toHaveProperty('remove')
  })
})

describe('members.sync role resolution', () => {
  it('reads org:admin from Clerk token with top-level org_role', () => {
    const identity = { org_id: 'org_123', org_role: 'org:admin' }
    expect(getClerkOrganizationRole(identity)).toBe('org:admin')
  })

  it('returns null for Clerk org:member (not an ATRIA-X role)', () => {
    const identity = { org_id: 'org_123', org_role: 'org:member' }
    expect(getClerkOrganizationRole(identity)).toBeNull()
  })

  it('reads admin from compact Clerk token o.rol', () => {
    const identity = { o: { id: 'org_123', rol: 'admin' } }
    expect(getClerkOrganizationRole(identity)).toBe('org:admin')
  })

  it('reads org_id from compact Clerk token o.id', () => {
    const identity = { o: { id: 'org_123', rol: 'member' } }
    expect(getActiveClerkOrganizationId(identity)).toBe('org_123')
  })

  // The sync mutation uses:
  //   const roleFromClerk = getClerkOrganizationRole(identity)
  //   const role = roleFromClerk ?? existing?.role ?? 'org:caregiver'
  //
  // This means:
  // - For org:admin in Clerk → role becomes org:admin
  // - For org:member in Clerk, existing member → keeps existing Convex role
  // - For org:member in Clerk, new member → defaults to org:caregiver
})
