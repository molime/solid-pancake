import { describe, expect, it } from 'vitest'
import { formatPhone, isValidEmail, isValidPhone } from './validation'

describe('formatPhone', () => {
  it('returns empty string for empty input', () => {
    expect(formatPhone('')).toBe('')
  })

  it('returns empty string for letters only', () => {
    expect(formatPhone('abc')).toBe('')
  })

  it('formats 10 digits as (XXX) XXX-XXXX', () => {
    expect(formatPhone('5551234567')).toBe('(555) 123-4567')
  })

  it('caps at 10 digits when more are entered', () => {
    expect(formatPhone('55512345678901')).toBe('(555) 123-4567')
  })

  it('re-formats an already formatted number', () => {
    expect(formatPhone('(555) 123-4567')).toBe('(555) 123-4567')
  })

  it('partially formats short input', () => {
    expect(formatPhone('5')).toBe('(5')
    expect(formatPhone('5551')).toBe('(555) 1')
    expect(formatPhone('5551234')).toBe('(555) 123-4')
  })
})

describe('isValidPhone', () => {
  it('returns true for exactly 10 digits', () => {
    expect(isValidPhone('5551234567')).toBe(true)
    expect(isValidPhone('(555) 123-4567')).toBe(true)
  })

  it('returns false for 9 digits', () => {
    expect(isValidPhone('555123456')).toBe(false)
  })

  it('returns false for 11 digits', () => {
    expect(isValidPhone('55512345678')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidPhone('')).toBe(false)
  })

  it('returns false for letters', () => {
    expect(isValidPhone('abcdefghij')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('accepts a normal email', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })

  it('rejects missing TLD', () => {
    expect(isValidEmail('user@example')).toBe(false)
  })

  it('rejects missing domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('rejects missing local part', () => {
    expect(isValidEmail('@example.com')).toBe(false)
  })

  it('rejects addresses containing spaces', () => {
    expect(isValidEmail('user name@example.com')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })
})
