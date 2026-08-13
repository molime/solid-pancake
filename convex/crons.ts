import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.daily(
  'checkAndFlagIssues',
  { hourUTC: 6, minuteUTC: 0 },
  internal.hrCases.checkAndFlagIssues,
)

crons.daily(
  'checkExpiringCredentials',
  { hourUTC: 6, minuteUTC: 0 },
  internal.hrCases.checkExpiringCredentials,
)

crons.daily(
  'checkEscalations',
  { hourUTC: 7, minuteUTC: 0 },
  internal.escalations.checkEscalations,
)

// Monthly recurring billing: 1st of the month, ~06:00 UTC. The platform
// invoice duplicate-period guard makes re-runs idempotent.
crons.monthly(
  'runMonthlyBilling',
  { day: 1, hourUTC: 6, minuteUTC: 0 },
  internal.platform.runMonthlyBilling,
)

// Daily soft-limit usage alerts (warnings only, never blocks).
crons.daily(
  'checkLimitAlerts',
  { hourUTC: 6, minuteUTC: 30 },
  internal.platform.checkLimitAlerts,
)

export default crons
