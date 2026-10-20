import { describe, expect, it } from 'vitest'
import { maskSsn } from './ssnMask'

describe('maskSsn', () => {
  it('masks a formatted SSN, keeping the last 4 digits', () => {
    expect(maskSsn('123-45-6789')).toBe('***-**-6789')
  })

  it('masks an unformatted SSN', () => {
    expect(maskSsn('123456789')).toBe('***-**-6789')
  })

  it('strips spaces and keeps the last 4 digits', () => {
    expect(maskSsn('123 45 6789')).toBe('***-**-6789')
  })

  it('masks a short digit-only value of 4+ digits', () => {
    expect(maskSsn('12-34')).toBe('***-**-1234')
  })

  it('fully masks a non-numeric value', () => {
    expect(maskSsn('abc-xyz')).toBe('***-**-****')
  })

  it('returns an empty string for empty input', () => {
    expect(maskSsn('')).toBe('')
    expect(maskSsn(null)).toBe('')
    expect(maskSsn(undefined)).toBe('')
  })
})
