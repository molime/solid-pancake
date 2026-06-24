import { v } from 'convex/values'
import { internalAction } from './_generated/server'

export const adpSyncPunch = internalAction({
  args: { punchId: v.id('timePunches') },
  handler: async (_ctx, { punchId }) => {
    // Stub: ADP credentials are not configured yet. When credentials are
    // available this action will queue the punch to ADP Workforce Now.
    return {
      status: 'skipped',
      reason: 'ADP credentials not configured',
      punchId: punchId as string,
    }
  },
})
