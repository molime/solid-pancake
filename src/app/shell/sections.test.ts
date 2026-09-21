import { describe, expect, it } from 'vitest'
import { GATEABLE_SECTIONS, isSectionDisabled } from './sections'

describe('isSectionDisabled', () => {
  it('returns false when nothing is disabled', () => {
    expect(isSectionDisabled(undefined, '/billing')).toBe(false)
    expect(isSectionDisabled([], '/billing')).toBe(false)
  })

  it('matches exact paths and sub-paths', () => {
    expect(isSectionDisabled(['billing'], '/billing')).toBe(true)
    expect(isSectionDisabled(['clients'], '/clients/abc123')).toBe(true)
    expect(isSectionDisabled(['incidents'], '/incidents/new')).toBe(true)
  })

  it('the root path only matches the root itself', () => {
    expect(isSectionDisabled(['dashboard'], '/')).toBe(true)
    expect(isSectionDisabled(['dashboard'], '/dashboard')).toBe(true)
    expect(isSectionDisabled(['dashboard'], '/hr')).toBe(false)
    expect(isSectionDisabled(['dashboard'], '/clients')).toBe(false)
  })

  it('distinguishes billing from payroll', () => {
    expect(isSectionDisabled(['payroll'], '/billing/payroll')).toBe(true)
    expect(isSectionDisabled(['billing'], '/billing/payroll')).toBe(true)
    expect(isSectionDisabled(['payroll'], '/billing')).toBe(false)
  })

  it('never gates sections that are not gateable', () => {
    expect(isSectionDisabled(['dashboard', 'billing'], '/hr')).toBe(false)
    expect(isSectionDisabled(['dashboard', 'billing'], '/training')).toBe(false)
    expect(isSectionDisabled(['dashboard', 'billing'], '/account')).toBe(false)
    expect(isSectionDisabled(['dashboard', 'billing'], '/subscription')).toBe(false)
  })

  it('covers every section Maria listed', () => {
    const keys = GATEABLE_SECTIONS.map((s) => s.key)
    for (const key of [
      'dashboard',
      'admin',
      'incidents',
      'evv',
      'reporting',
      'audit',
      'logs',
      'review',
      'billing',
      'payroll',
      'clients',
      'settings',
      'email-domains',
    ]) {
      expect(keys).toContain(key)
    }
  })
})
