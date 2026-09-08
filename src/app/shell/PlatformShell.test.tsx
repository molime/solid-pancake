import { describe, it, expect } from 'vitest'
import { NAV_ITEMS } from './platformNavItems'

describe('PlatformShell nav', () => {
  it('exposes exactly the 7 consolidated platform nav items', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Subscriptions',
      'Agencies',
      'Tenant Health',
      'Reports',
      'Support',
      'Audit Log',
      'Billing',
    ])
    expect(NAV_ITEMS.map((item) => item.to)).toEqual([
      '/platform/subscriptions',
      '/platform/agencies',
      '/platform/health',
      '/platform/reports',
      '/platform/support',
      '/platform/audit',
      '/platform/billing',
    ])
  })
})
