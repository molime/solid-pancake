import { describe, expect, it } from 'vitest'

// Verify source-level exports rather than generated API runtime object,
// which is a proxy that only works with an active Convex client.

describe('auth.config.ts', () => {
  it('uses customJwt provider without applicationID to accept default Clerk tokens', async () => {
    vi.stubEnv('CLERK_JWT_ISSUER_DOMAIN', 'https://test.clerk.accounts.dev')

    const mod = await import('../../../convex/auth.config')
    const config = (mod as { default?: { providers: unknown[] } }).default
    expect(config).toBeDefined()
    expect(config!.providers).toHaveLength(1)

    const provider = config!.providers[0] as {
      type?: string
      applicationID?: string
      issuer?: string
      jwks?: string
      algorithm?: string
    }
    expect(provider.type).toBe('customJwt')
    expect(provider.applicationID).toBeUndefined()
    expect(provider.issuer).toBe('https://test.clerk.accounts.dev')
    expect(provider.jwks).toBe(
      'https://test.clerk.accounts.dev/.well-known/jwks.json',
    )
    expect(provider.algorithm).toBe('RS256')

    vi.unstubAllEnvs()
  })
})

describe('Convex source exports', () => {
  it('tenants.ts exports ensureSelectedAgency', async () => {
    const mod = await import('../../../convex/tenants')
    expect(mod).toHaveProperty('ensureSelectedAgency')
    expect(typeof mod.ensureSelectedAgency).toBe('function')
  })

  it('shiftQueries.ts exports required query functions', async () => {
    const mod = await import('../../../convex/shiftQueries')
    expect(mod).toHaveProperty('listMyShifts')
    expect(mod).toHaveProperty('listForReview')
    expect(mod).toHaveProperty('getWithDetails')
    expect(mod).toHaveProperty('dashboardStats')
  })

  it('shifts.ts exports shift write mutations', async () => {
    const mod = await import('../../../convex/shifts')
    expect(mod).toHaveProperty('create')
    expect(mod).toHaveProperty('createMany')
    expect(mod).toHaveProperty('startDocumentation')
    expect(mod).toHaveProperty('submitDocumentation')
  })

  it('reviews.ts exports approve and requestCorrection', async () => {
    const mod = await import('../../../convex/reviews')
    expect(mod).toHaveProperty('approve')
    expect(mod).toHaveProperty('requestCorrection')
  })

  it('billing.ts exports createExportBatch', async () => {
    const mod = await import('../../../convex/billing')
    expect(mod).toHaveProperty('createExportBatch')
  })

  it('audit.ts exports record', async () => {
    const mod = await import('../../../convex/audit')
    expect(mod).toHaveProperty('record')
  })

  it('files.ts exports attachProof, removeProof, getDownloadUrl', async () => {
    const mod = await import('../../../convex/files')
    expect(mod).toHaveProperty('attachProof')
    expect(mod).toHaveProperty('removeProof')
    expect(mod).toHaveProperty('getDownloadUrl')
  })

  it('platform.ts exports isAdmin and listTenants', async () => {
    const mod = await import('../../../convex/platform')
    expect(mod).toHaveProperty('isAdmin')
    expect(mod).toHaveProperty('listTenants')
  })

  it('members.ts exports me, list, updateRole, remove', async () => {
    const mod = await import('../../../convex/members')
    expect(mod).toHaveProperty('me')
    expect(mod).toHaveProperty('list')
    expect(mod).toHaveProperty('updateRole')
    expect(mod).toHaveProperty('remove')
  })

  it('seed.ts exports seedAgency', async () => {
    const mod = await import('../../../convex/seed')
    expect(mod).toHaveProperty('seedAgency')
  })
})
