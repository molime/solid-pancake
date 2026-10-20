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

// Daily suspicious-activity scan: support-access events, override spikes
// (>=3 in 24h), and export bursts (>=5 in 24h) -> one deduplicated
// org:admin notification per tenant per day.
crons.daily(
  'runSecurityMonitoring',
  { hourUTC: 6, minuteUTC: 30 },
  internal.securityMonitoring.checkSuspiciousActivity,
)

// Daily 30-day training expiry alerts (per completion, sent once).
crons.daily(
  'checkTrainingExpirations',
  { hourUTC: 6, minuteUTC: 45 },
  internal.training.checkTrainingExpirations,
)

// Daily data-retention sweep (compliance mini-phase Stage 2): purges
// offboarded-employee data past the retention window and expired archive
// documents, writes deletionEvents rows, and notifies each affected tenant's
// org:admins with counts. Capped per run — schedules a continuation when more
// subjects remain.
crons.daily(
  'runRetentionSweep',
  { hourUTC: 6, minuteUTC: 45 },
  internal.dataRetention.runRetentionSweep,
)

// Monthly billing-due reminder (2nd, after the recurring billing run on the 1st).
crons.monthly(
  'notifyBillingDue',
  { day: 2, hourUTC: 14, minuteUTC: 0 },
  internal.billing.notifyBillingDueInternal,
)

// Daily dunning: sent invoices past their due date go 'overdue' and the
// tenant enters past_due with a 5-day grace window (anchored to due date).
crons.daily(
  'checkOverdueSubscriptionInvoices',
  { hourUTC: 6, minuteUTC: 15 },
  internal.platformStripe.checkOverdueSubscriptionInvoices,
)

// Daily suspension: past_due tenants whose grace window expired lose access
// until the balance is paid (auto-reactivated on invoice.paid).
crons.daily(
  'suspendPastDueTenants',
  { hourUTC: 6, minuteUTC: 20 },
  internal.platformStripe.suspendPastDueTenants,
)

// Hourly support-access grant expiry (compliance mini-phase Stage 3):
// grants whose durationMinutes elapsed since startedAt become 'expired' with
// a support_access_expired audit event.
crons.interval(
  'expireSupportAccessGrants',
  { hours: 1 },
  internal.supportAccess.expireDueGrants,
)

export default crons
