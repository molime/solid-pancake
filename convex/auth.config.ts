import type { AuthConfig } from 'convex/server'

declare const process: { env: Record<string, string | undefined> }

const issuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN
if (!issuerDomain) {
  throw new Error('CLERK_JWT_ISSUER_DOMAIN is not set')
}

export default {
  providers: [
    {
      type: 'customJwt',
      issuer: issuerDomain,
      jwks: `${issuerDomain}/.well-known/jwks.json`,
      algorithm: 'RS256',
    },
  ],
} satisfies AuthConfig
