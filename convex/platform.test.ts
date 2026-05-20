import { describe, expect, it } from 'vitest'

describe('Convex platform exports', () => {
  it('exports isAdmin and listTenants', async () => {
    const mod = await import('./platform')
    expect(mod).toHaveProperty('isAdmin')
    expect(mod).toHaveProperty('listTenants')
  })
})
