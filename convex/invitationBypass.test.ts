import { describe, it, expect, beforeEach } from 'vitest'
import { isDevInvitationBypassEnabled } from './_utils/invitationBypass'

describe('isDevInvitationBypassEnabled', () => {
  beforeEach(() => {
    delete process.env.APP_URL
    delete process.env.ATRIA_X_DEV_INVITE_BYPASS
  })

  it('returns true when devBypassEnabled opt-in is passed', () => {
    expect(isDevInvitationBypassEnabled({ devBypassEnabled: true })).toBe(true)
  })

  it('returns true for localhost APP_URL', () => {
    process.env.APP_URL = 'http://localhost:5173'
    expect(isDevInvitationBypassEnabled()).toBe(true)
  })

  it('returns true for 127.0.0.1 APP_URL', () => {
    process.env.APP_URL = 'http://127.0.0.1:5173'
    expect(isDevInvitationBypassEnabled()).toBe(true)
  })

  it('returns true when ATRIA_X_DEV_INVITE_BYPASS flag is set', () => {
    process.env.ATRIA_X_DEV_INVITE_BYPASS = '1'
    expect(isDevInvitationBypassEnabled()).toBe(true)
  })

  it('returns false for production host without flag or opt-in', () => {
    process.env.APP_URL = 'https://app.atriax.example.com'
    expect(isDevInvitationBypassEnabled()).toBe(false)
  })
})
