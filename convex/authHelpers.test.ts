import { describe, it, expect } from 'vitest'
import type { Id } from './_generated/dataModel'
import {
  assertTenantDoc,
  getActiveClerkOrganizationId,
  getClerkOrganizationRole,
  requireActiveClerkOrganization,
} from './authHelpers'

describe('assertTenantDoc', () => {
  it('does not throw when doc belongs to the tenant', () => {
    const tenantId = 'tenant_123' as Id<'tenants'>
    expect(() => assertTenantDoc({ tenantId }, tenantId)).not.toThrow()
  })

  it('throws when doc belongs to a different tenant', () => {
    const tenantId = 'tenant_123' as Id<'tenants'>
    const otherTenantId = 'tenant_456' as Id<'tenants'>
    expect(() => assertTenantDoc({ tenantId: otherTenantId }, tenantId)).toThrow(
      'cross-tenant access denied',
    )
  })
})

describe('getActiveClerkOrganizationId', () => {
  it('reads top-level org_id', () => {
    expect(getActiveClerkOrganizationId({ org_id: 'org_123' })).toBe('org_123')
  })

  it('reads compact org object id', () => {
    expect(getActiveClerkOrganizationId({ o: { id: 'org_123' } })).toBe(
      'org_123',
    )
  })

  it('reads flattened o.id claim', () => {
    expect(getActiveClerkOrganizationId({ 'o.id': 'org_123' })).toBe('org_123')
  })

  it('prefers top-level org_id over compact form', () => {
    expect(
      getActiveClerkOrganizationId({
        org_id: 'org_top',
        o: { id: 'org_compact' },
      }),
    ).toBe('org_top')
  })

  it('returns null when no org claim exists', () => {
    expect(getActiveClerkOrganizationId({ sub: 'user_123' })).toBeNull()
  })
})

describe('getClerkOrganizationRole', () => {
  it('reads top-level org_role', () => {
    expect(getClerkOrganizationRole({ org_role: 'org:admin' })).toBe(
      'org:admin',
    )
  })

  it('reads compact org object rol', () => {
    expect(getClerkOrganizationRole({ o: { rol: 'admin' } })).toBe('org:admin')
    expect(getClerkOrganizationRole({ o: { rol: 'coordinator' } })).toBe(
      'org:coordinator',
    )
    expect(getClerkOrganizationRole({ o: { rol: 'caregiver' } })).toBe(
      'org:caregiver',
    )
  })

  it('reads flattened o.rol claim', () => {
    expect(getClerkOrganizationRole({ 'o.rol': 'admin' })).toBe('org:admin')
  })

  it('normalizes bare role names to org: prefix', () => {
    expect(getClerkOrganizationRole({ org_role: 'admin' })).toBe('org:admin')
    expect(getClerkOrganizationRole({ org_role: 'coordinator' })).toBe(
      'org:coordinator',
    )
    expect(getClerkOrganizationRole({ org_role: 'caregiver' })).toBe(
      'org:caregiver',
    )
  })

  it('returns null for unknown roles', () => {
    expect(getClerkOrganizationRole({ org_role: 'superuser' })).toBeNull()
    expect(getClerkOrganizationRole({})).toBeNull()
  })
})

describe('requireActiveClerkOrganization', () => {
  it('does not throw when org_id matches', () => {
    expect(() =>
      requireActiveClerkOrganization({ org_id: 'org_123' }, 'org_123'),
    ).not.toThrow()
  })

  it('throws when org_id is missing', () => {
    expect(() =>
      requireActiveClerkOrganization({ sub: 'user_123' }, 'org_123'),
    ).toThrow('missing from token')
  })

  it('throws when org_id does not match', () => {
    expect(() =>
      requireActiveClerkOrganization({ org_id: 'org_456' }, 'org_123'),
    ).toThrow('mismatch')
  })

  it('matches compact org object id', () => {
    expect(() =>
      requireActiveClerkOrganization({ o: { id: 'org_123' } }, 'org_123'),
    ).not.toThrow()
  })
})
