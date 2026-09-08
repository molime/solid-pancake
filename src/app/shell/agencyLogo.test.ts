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

  it('returns the Golden Ages logo for a matching tenant name', () => {
    expect(resolveAgencyLogo('Golden Ages Home Care')).toBe(
      '/agency-logo-goldenages.png',
    )
  })

  it('matches Golden Ages via the employer legal name when the tenant name differs', () => {
    expect(
      resolveAgencyLogo('My Organization Test', 'Golden Ages Home Care, LLC'),
    ).toBe('/agency-logo-goldenages.png')
  })

  it('matches Individuals Choice via the employer legal name', () => {
    expect(resolveAgencyLogo(undefined, 'Individuals Choice, Inc')).toBe(
      '/agency-logo-individualschoice.jpeg',
    )
  })

  it('returns null for any other tenant', () => {
    expect(resolveAgencyLogo('Some Other Agency')).toBeNull()
  })

  it('returns null when both names are undefined', () => {
    expect(resolveAgencyLogo(undefined)).toBeNull()
  })

  it('returns null for an empty tenant name', () => {
    expect(resolveAgencyLogo('')).toBeNull()
  })
})
