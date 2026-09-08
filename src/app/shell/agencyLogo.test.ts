import { describe, it, expect } from 'vitest'
import { resolveAgencyLogo } from './agencyLogo'

describe('resolveAgencyLogo', () => {
  it('returns the Individuals Choice logo for a matching tenant name', () => {
    expect(resolveAgencyLogo('Individuals Choice')).toBe(
      '/agency-logo-individualschoice.jpeg',
    )
  })

  it('matches case-insensitively as a substring', () => {
    expect(resolveAgencyLogo('INDIVIDUALS CHOICE LLC')).toBe(
      '/agency-logo-individualschoice.jpeg',
    )
  })

  it('returns null for any other tenant', () => {
    expect(resolveAgencyLogo('Some Other Agency')).toBeNull()
  })

  it('returns null when tenantName is undefined', () => {
    expect(resolveAgencyLogo(undefined)).toBeNull()
  })

  it('returns null for an empty tenant name', () => {
    expect(resolveAgencyLogo('')).toBeNull()
  })
})
