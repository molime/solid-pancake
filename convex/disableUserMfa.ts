import { action } from './_generated/server'
import { v } from 'convex/values'
import { requireTenantRoleAction } from './authHelpers'
import { requireEnv } from './_utils/env'
import {
  disableClerkUserMfa,
  findClerkUserByEmail,
} from './_utils/clerkUserManagement'

export const disableUserMfaByEmail = action({
  args: {
    clerkOrgId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    await requireTenantRoleAction(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const secretKey = requireEnv('CLERK_SECRET_KEY')
    const user = await findClerkUserByEmail(secretKey, args.email)
    if (!user) {
      return { ok: false, message: 'User not found in Clerk.' }
    }

    await disableClerkUserMfa(secretKey, user.id)
    return { ok: true, userId: user.id, mfaEnabled: user.mfa_enabled }
  },
})
