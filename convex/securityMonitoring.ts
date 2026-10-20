import { internalMutation } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { notifyTenantStaff } from './_utils/notifications'

const DAY_MS = 24 * 60 * 60 * 1000

// Patterns scanned over the last 24h of audit events, per tenant:
//   (a) any support_access_* event (platform support touched this tenant)
//   (b) >= 3 events whose action contains 'override'
//   (c) >= 5 data.exported events
const OVERRIDE_THRESHOLD = 3
const EXPORT_THRESHOLD = 5

// Marker stored in the notification metadata for daily dedupe.
const DEDUPE_MARKER = 'suspicious_activity'

/**
 * Daily cron (runSecurityMonitoring): scans the last 24h of audit events for
 * suspicious patterns and notifies org:admin members. One notification per
 * tenant per day (deduped via a marker in the notification metadata). The
 * message lists counts only — never event content.
 */
export const checkSuspiciousActivity = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const windowStart = new Date(now - DAY_MS).toISOString()
    const today = new Date(now).toISOString().slice(0, 10)

    const events = await ctx.db
      .query('auditEvents')
      .filter((q) => q.gte(q.field('createdAt'), windowStart))
      .collect()

    const byTenant = new Map<
      Id<'tenants'>,
      { supportAccess: number; overrides: number; exports: number }
    >()
    for (const event of events) {
      const action = event.action.toLowerCase()
      const isSupportAccess = action.startsWith('support_access_')
      const isOverride = action.includes('override')
      const isExport = event.action === 'data.exported'
      if (!isSupportAccess && !isOverride && !isExport) continue
      const bucket = byTenant.get(event.tenantId) ?? {
        supportAccess: 0,
        overrides: 0,
        exports: 0,
      }
      if (isSupportAccess) bucket.supportAccess += 1
      if (isOverride) bucket.overrides += 1
      if (isExport) bucket.exports += 1
      byTenant.set(event.tenantId, bucket)
    }

    let notified = 0
    for (const [tenantId, counts] of byTenant) {
      const hit =
        counts.supportAccess > 0 ||
        counts.overrides >= OVERRIDE_THRESHOLD ||
        counts.exports >= EXPORT_THRESHOLD
      if (!hit) continue

      // Daily dedupe: skip when today's marker notification already exists.
      const alreadyNotified = await ctx.db
        .query('notifications')
        .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
        .filter((q) =>
          q.and(
            q.gte(q.field('createdAt'), windowStart),
            q.eq(q.field('metadata.marker'), DEDUPE_MARKER),
            q.eq(q.field('metadata.day'), today),
          ),
        )
        .first()
      if (alreadyNotified) continue

      const parts: string[] = []
      if (counts.supportAccess > 0) {
        parts.push(`${counts.supportAccess} support access event(s)`)
      }
      if (counts.overrides >= OVERRIDE_THRESHOLD) {
        parts.push(`${counts.overrides} override event(s)`)
      }
      if (counts.exports >= EXPORT_THRESHOLD) {
        parts.push(`${counts.exports} data export(s)`)
      }

      await notifyTenantStaff(ctx, tenantId, ['org:admin'], {
        type: 'security_alert',
        subject: 'Suspicious activity detected',
        message: `Suspicious activity in the last 24 hours: ${parts.join(', ')}. Review the audit trail for details.`,
        metadata: { marker: DEDUPE_MARKER, day: today, ...counts },
      })
      notified += 1
    }

    return { tenantsScanned: byTenant.size, notified }
  },
})
