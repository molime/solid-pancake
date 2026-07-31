import { describe, it, expect, beforeEach } from 'vitest'
import { clearSessionData } from './clearSession'

describe('clearSessionData', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim()
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
    })
  })

  it('clears localStorage', () => {
    localStorage.setItem('atriax.clerkOrgId', 'org_123')
    clearSessionData()
    expect(localStorage.getItem('atriax.clerkOrgId')).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('clears sessionStorage', () => {
    sessionStorage.setItem('atriax_apply_slug', 'some-agency')
    clearSessionData()
    expect(sessionStorage.getItem('atriax_apply_slug')).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('expires all cookies for the current domain', () => {
    document.cookie = 'session_cookie=abc;path=/'
    document.cookie = 'other_cookie=def;path=/'
    expect(document.cookie).toContain('session_cookie=abc')
    expect(document.cookie).toContain('other_cookie=def')
    clearSessionData()
    expect(document.cookie).not.toContain('session_cookie')
    expect(document.cookie).not.toContain('other_cookie')
  })

  it('does not throw when storage access is restricted', () => {
    const localSpy = vi
      .spyOn(Storage.prototype, 'clear')
      .mockImplementation(() => {
        throw new Error('denied')
      })
    expect(() => clearSessionData()).not.toThrow()
    localSpy.mockRestore()
  })
})
