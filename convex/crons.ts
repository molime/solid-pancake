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

// SIR 24h/48h deadline escalation (17 CCR §54327): opens a deduplicated
// 'sir_overdue' HR case and notifies org:admin/org:hr members.
crons.daily(
  'checkOverdueIncidents',
  { hourUTC: 6, minuteUTC: 0 },
  internal.incidents.checkOverdueIncidents,
)

crons.daily(
  'checkEscalations',
  { hourUTC: 7, minuteUTC: 0 },
  internal.escalations.checkEscalations,
)

// Progress report cadence (17 CCR §58680 + RC contract): opens a deduplicated
// 'progress_report_due' HR case and notifies org:admin/org:coordinator members
// when a client's next quarterly SLS / semi-annual ILS report is due ≤14 days.
crons.daily(
  'checkProgressReportsDue',
  { hourUTC: 6, minuteUTC: 0 },
  internal.progressReports.checkProgressReportsDue,
)

// Grievance resolution SLA (WIC §4705 — 5 business days): opens a deduplicated
// 'grievance_overdue' HR case and notifies org:admin/org:hr members.
crons.daily(
  'checkOverdueGrievances',
  { hourUTC: 6, minuteUTC: 0 },
  internal.grievances.checkOverdueGrievances,
)

// Corrective action 30-day cycles (docs/07 §3.6): opens a deduplicated
// 'cap_overdue' HR case and notifies org:admin/org:hr members.
crons.daily(
  'checkOverdueCaps',
  { hourUTC: 6, minuteUTC: 0 },
  internal.correctiveActions.checkOverdueCaps,
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
