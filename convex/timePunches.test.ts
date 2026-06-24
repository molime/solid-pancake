import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertPunchAuthorized } from './timePunches'

const sourcePath = resolve(__dirname, 'timePunches.ts')
const source = readFileSync(sourcePath, 'utf-8')

describe('Convex timePunches exports', () => {
  it('exports get and assertPunchAuthorized', async () => {
    const mod = await import('./timePunches')
    expect(mod).toHaveProperty('get')
    expect(mod).toHaveProperty('assertPunchAuthorized')
    expect(mod).not.toHaveProperty('create')
  })
})

describe('timePunches tenant guard', () => {
  it('derives tenant from authenticated session, not from args', () => {
    expect(source).toContain('requireTenantRole')
    expect(source).not.toContain('tenantId: v.id(\'tenants\')')
  })

  it('rejects caregivers acting on shifts assigned to another caregiver', () => {
    expect(source).toContain('org:caregiver')
    expect(source).toContain('identity.subject')
    expect(source).toContain('assertPunchAuthorized')
  })

  it('does not expose a public punch creation mutation', () => {
    expect(source).not.toContain('export const create')
    expect(source).not.toContain("ctx.db.insert('timePunches'")
  })
})

describe('assertPunchAuthorized', () => {
  it('allows admins to act on any shift', () => {
    expect(() =>
      assertPunchAuthorized(
        { role: 'org:admin', clerkUserId: 'user_1' },
        'user_2',
      ),
    ).not.toThrow()
  })

  it('allows coordinators to act on any shift', () => {
    expect(() =>
      assertPunchAuthorized(
        { role: 'org:coordinator', clerkUserId: 'user_1' },
        'user_2',
      ),
    ).not.toThrow()
  })

  it('allows caregivers to act on their own shifts', () => {
    expect(() =>
      assertPunchAuthorized(
        { role: 'org:caregiver', clerkUserId: 'user_1' },
        'user_1',
      ),
    ).not.toThrow()
  })

  it('denies caregivers acting on shifts assigned to another caregiver', () => {
    expect(() =>
      assertPunchAuthorized(
        { role: 'org:caregiver', clerkUserId: 'user_1' },
        'user_2',
      ),
    ).toThrow('Caregivers can only act on their assigned shifts.')
  })
})
