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

export default crons
