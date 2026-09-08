import { useOrganization } from '@clerk/react'
import { useConvex, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { KpiCard } from '@/shared/ui/KpiCard'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { downloadCsv } from '@/shared/lib/downloadCsv'
import { CorrectiveActionsCard } from '@/features/reporting/components/CorrectiveActionsCard'
import { Select } from '@/shared/ui/Select'
import { USDateInput } from '@/shared/ui/USDateInput'
import { formatHours, formatStatusLabel } from '@/shared/format'
import { Download, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

type AuditReport = FunctionReturnType<typeof api.auditReadiness.getReport>
type Obligations = FunctionReturnType<typeof api.agencyObligations.listObligations>
type ProgressSummary = FunctionReturnType<
  typeof api.progressReports.getProgressReportSummary
>
type RetentionReport = FunctionReturnType<
  typeof api.documentArchive.getRetentionReport
>

const DAY_MS = 24 * 60 * 60 * 1000
const PACKET_DEFAULT_WINDOW_DAYS = 90

type CategoryStatus = 'ready' | 'review' | 'action'

const DOCUMENTATION_READY_THRESHOLD = 0.95
const DOCUMENTATION_REVIEW_THRESHOLD = 0.8

const statusBadgeVariant = {
  ready: 'success',
  review: 'warning',
  action: 'danger',
} as const

const statusLabel = {
  ready: 'Ready',
  review: 'Review',
  action: 'Action Needed',
} as const

function percent(part: number, total: number) {
  if (total === 0) return '—'
  return `${Math.round((part / total) * 100)}%`
}

// The five audit pillars from docs/07 §1, each computed from real queries.

function serviceDeliveryStatus(report: AuditReport): CategoryStatus {
  const { total, withNotes } = report.documentation
  const rate = total === 0 ? 1 : withNotes / total
  if (
    report.blockedBillingLines > 0 ||
    rate < DOCUMENTATION_REVIEW_THRESHOLD
  ) {
    return 'action'
  }
  if (
    rate < DOCUMENTATION_READY_THRESHOLD ||
    report.evidence.complete < report.evidence.total
  ) {
    return 'review'
  }
  return 'ready'
}

function personnelPillarStatus(report: AuditReport): CategoryStatus {
  const gapsWithIssues = report.gaps.filter(
    (gap) => gap.missing.length > 0 || gap.expired.length > 0,
  ).length
  if (
    report.personnel.expired > 0 ||
    gapsWithIssues > 0 ||
    report.backgroundChecks.consider > 0 ||
    report.training.pending > 0
  ) {
    return 'action'
  }
  if (
    report.personnel.expiring > 0 ||
    report.backgroundChecks.pending > 0 ||
    report.backgroundChecks.other > 0 ||
    report.training.expiring > 0
  ) {
    return 'review'
  }
  return 'ready'
}

function programIntegrityStatus(
  summary: ProgressSummary | undefined,
): CategoryStatus {
  if (!summary) return 'review'
  if (summary.overdue > 0) return 'action'
  if (summary.dueSoon > 0) return 'review'
  return 'ready'
}

function vendorFileStatus(
  report: AuditReport,
  obligations: Obligations | undefined,
): CategoryStatus {
  if (!obligations) return 'review'
  const nowIso = new Date().toISOString()
  if (obligations.some((obligation) => obligation.dueAt < nowIso)) {
    return 'action'
  }
  if (!report.agency.ein || !report.agency.address || report.branches.length === 0) {
    return 'review'
  }
  return 'ready'
}

function vendorFileLines(
  report: AuditReport,
  obligations: Obligations | undefined,
  retention: RetentionReport | undefined,
): string[] {
  const lines = [
    report.agency.ein ? `EIN on file: ${report.agency.ein}` : 'EIN missing',
    report.agency.address ? 'Address on file' : 'Address missing',
    report.branches.length > 0
      ? `Branches: ${report.branches.join(', ')}`
      : 'No branches configured',
  ]
  if (obligations) {
    const nowIso = new Date().toISOString()
    const overdue = obligations.filter(
      (obligation) => obligation.dueAt < nowIso,
    ).length
    lines.push(
      obligations.length === 0
        ? 'No agency obligations tracked'
        : `${obligations.length - overdue} of ${obligations.length} obligations current${overdue > 0 ? `, ${overdue} overdue` : ''}`,
    )
  }
  if (retention) {
    const expiring = retention.recordTypes.reduce(
      (sum, recordType) => sum + recordType.expiringSoon,
      0,
    )
    const holds = retention.recordTypes.reduce(
      (sum, recordType) => sum + recordType.legalHold,
      0,
    )
    lines.push(
      `${expiring} records approaching retention expiry, ${holds} under legal hold`,
    )
  }
  return lines
}

type IncidentTimeliness = FunctionReturnType<
  typeof api.incidents.getIncidentTimeliness
>

function incidentStatus(timeliness: IncidentTimeliness): CategoryStatus {
  if (timeliness.verbalBreached > 0 || timeliness.writtenBreached > 0) {
    return 'action'
  }
  if (timeliness.verbalPending > 0 || timeliness.writtenPending > 0) {
    return 'review'
  }
  return 'ready'
}

/** Current fiscal-year end year (CA state FY runs July 1 – June 30). */
function currentFiscalYearEnd() {
  const now = new Date()
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
}

function fiscalYearLabel(fiscalYearEnd: number) {
  return `FY ${fiscalYearEnd - 1}–${String(fiscalYearEnd).slice(2)}`
}

export function AuditReadinessPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const convex = useConvex()
  const [downloading, setDownloading] = useState(false)
  const [fiscalYearEnd, setFiscalYearEnd] = useState(currentFiscalYearEnd)
  const [downloadingEvaluation, setDownloadingEvaluation] = useState(false)
  const [packetStart, setPacketStart] = useState(
    () =>
      new Date(Date.now() - PACKET_DEFAULT_WINDOW_DAYS * DAY_MS)
        .toISOString()
        .slice(0, 10),
  )
  const [packetEnd, setPacketEnd] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [downloadingPacket, setDownloadingPacket] = useState(false)

  const report = useQuery(
    api.auditReadiness.getReport,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const incidentTimeliness = useQuery(
    api.incidents.getIncidentTimeliness,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const annualEvaluation = useQuery(
    api.auditReadiness.getAnnualEvaluation,
    clerkOrgId ? { clerkOrgId, fiscalYearEnd } : 'skip',
  )
  const obligations = useQuery(
    api.agencyObligations.listObligations,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const progressSummary = useQuery(
    api.progressReports.getProgressReportSummary,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const retention = useQuery(
    api.documentArchive.getRetentionReport,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const grievanceSummary = useQuery(
    api.grievances.getGrievanceSummary,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const handleDownload = async () => {
    if (!clerkOrgId) return
    setDownloading(true)
    try {
      const csv = await convex.query(api.auditReadiness.exportCsv, {
        clerkOrgId,
      })
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(`audit-readiness-${date}.csv`, csv)
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadEvaluation = async () => {
    if (!clerkOrgId) return
    setDownloadingEvaluation(true)
    try {
      const csv = await convex.query(
        api.auditReadiness.exportAnnualEvaluationCsv,
        { clerkOrgId, fiscalYearEnd },
      )
      downloadCsv(`annual-program-evaluation-fy${fiscalYearEnd}.csv`, csv)
    } finally {
      setDownloadingEvaluation(false)
    }
  }

  const handleDownloadPacket = async () => {
    if (!clerkOrgId || !packetStart || !packetEnd) return
    setDownloadingPacket(true)
    try {
      const csv = await convex.query(api.auditPacket.exportPacketCsv, {
        clerkOrgId,
        startDate: packetStart,
        endDate: packetEnd,
      })
      downloadCsv(`audit-packet-${packetStart}-to-${packetEnd}.csv`, csv)
    } finally {
      setDownloadingPacket(false)
    }
  }

  if (report === undefined) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">Audit Trail</h1>
          <p className="text-base text-atria-text-secondary">
            Audit-readiness tool for California ILS/SLS compliance
          </p>
        </div>
        <p className="py-8 text-center text-sm text-atria-text-secondary">
          Loading audit-readiness report…
        </p>
      </div>
    )
  }

  const gapsWithIssues = report.gaps.filter(
    (gap) => gap.missing.length > 0 || gap.expired.length > 0,
  )

  // Self-inspection checklist (17 CCR §54332(b) biennial vendor-file review):
  // every item is computed live from the queries above — nothing is stored.
  const nowIso = new Date().toISOString()
  const obligationCurrent = (key: string) =>
    !!obligations?.some(
      (obligation) => obligation.key === key && obligation.dueAt >= nowIso,
    )
  const documentationRate =
    report.documentation.total === 0
      ? 1
      : report.documentation.withNotes / report.documentation.total
  const checklistItems: { label: string; met: boolean; linkTo?: string }[] = [
    {
      label: 'No expired caregiver credentials',
      met:
        report.personnel.expired === 0 &&
        report.gaps.every((gap) => gap.expired.length === 0),
      linkTo: '/compliance',
    },
    {
      label: 'No missing required credentials',
      met: report.gaps.every((gap) => gap.missing.length === 0),
      linkTo: '/compliance',
    },
    {
      label: 'All SIRs verbally reported within 24 hours (last 90 days)',
      met: (incidentTimeliness?.verbalBreached ?? 0) === 0,
      linkTo: '/incidents',
    },
    {
      label: 'All SIR written reports submitted within 48 hours (last 90 days)',
      met: (incidentTimeliness?.writtenBreached ?? 0) === 0,
      linkTo: '/incidents',
    },
    {
      label: 'General liability insurance COI current',
      met: obligationCurrent('insurance_general_liability'),
      linkTo: '/compliance',
    },
    {
      label: "Workers' compensation insurance COI current",
      met: obligationCurrent('insurance_workers_comp'),
      linkTo: '/compliance',
    },
    {
      label: 'DS 1891 disclosure current (2-year cycle)',
      met: obligationCurrent('ds1891_disclosure'),
      linkTo: '/compliance',
    },
    {
      label: 'No overdue progress reports',
      met: (progressSummary?.overdue ?? 0) === 0,
      linkTo: '/clients',
    },
    {
      label: 'Documentation completeness at least 95%',
      met: documentationRate >= DOCUMENTATION_READY_THRESHOLD,
    },
    {
      label: 'No blocked billing lines',
      met: report.blockedBillingLines === 0,
    },
  ]
  const checklistMet = checklistItems.filter((item) => item.met).length

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">Audit Trail</h1>
          <p className="text-base text-atria-text-secondary">
            Audit-readiness tool for California ILS/SLS compliance
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <USDateInput
            id="packetStart"
            aria-label="Packet start date"
            value={packetStart}
            onChange={setPacketStart}
          />
          <USDateInput
            id="packetEnd"
            aria-label="Packet end date"
            value={packetEnd}
            onChange={setPacketEnd}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={downloadingPacket || !packetStart || !packetEnd}
            onClick={handleDownloadPacket}
          >
            <Download className="h-4 w-4" />
            {downloadingPacket ? 'Preparing…' : 'Download Audit Packet'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={downloading}
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            {downloading ? 'Preparing…' : 'Download Audit Report'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Personnel Compliance Rate"
          value={percent(report.personnel.compliant, report.personnel.total)}
          detail={`${report.personnel.compliant} of ${report.personnel.total} credentials verified`}
        />
        <KpiCard
          label="Background Checks"
          value={
            report.backgroundChecks.total === 0
              ? '—'
              : `${report.backgroundChecks.clear}/${report.backgroundChecks.total}`
          }
          detail="cleared of total initiated"
        />
        <KpiCard
          label="Training Completion"
          value={percent(report.training.completed, report.training.total)}
          detail={`${report.training.expiring} expiring soon`}
        />
        <KpiCard
          label="Documentation Completeness"
          value={percent(
            report.documentation.withNotes,
            report.documentation.total,
          )}
          detail={`${report.documentation.withoutNotes} shifts without notes`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategorySection
          title="Service Delivery & Billing"
          status={serviceDeliveryStatus(report)}
          linkTo="/billing"
          lines={[
            `${report.documentation.withNotes} of ${report.documentation.total} shifts have progress notes`,
            `${report.blockedBillingLines} billing lines blocked`,
            `${report.evidence.complete} of ${report.evidence.total} billing lines evidence-complete`,
          ]}
        />
        <CategorySection
          title="Personnel"
          status={personnelPillarStatus(report)}
          linkTo="/compliance"
          lines={[
            `${report.personnel.compliant} credentials verified, ${report.personnel.expiring} expiring, ${report.personnel.expired} expired`,
            `${gapsWithIssues.length} employees with gaps`,
            `Background checks: ${report.backgroundChecks.clear} clear, ${report.backgroundChecks.pending} pending, ${report.backgroundChecks.consider} consider`,
            `Training: ${report.training.completed} completed, ${report.training.pending} pending, ${report.training.expiring} expiring`,
          ]}
        />
        <CategorySection
          title="Incidents & Rights"
          status={
            incidentTimeliness ? incidentStatus(incidentTimeliness) : 'review'
          }
          linkTo="/incidents"
          lines={
            incidentTimeliness
              ? [
                  incidentTimeliness.total === 0
                    ? 'No incidents in the last 90 days'
                    : `${incidentTimeliness.total} incidents in the last 90 days`,
                  `24h verbal: ${incidentTimeliness.verbalOnTime} on time, ${incidentTimeliness.verbalBreached} breached, ${incidentTimeliness.verbalPending} pending`,
                  `48h written: ${incidentTimeliness.writtenOnTime} on time, ${incidentTimeliness.writtenBreached} breached, ${incidentTimeliness.writtenPending} pending`,
                  ...(grievanceSummary
                    ? [
                        `Grievances: ${grievanceSummary.open} open, ${grievanceSummary.overdue} past the 5-business-day SLA`,
                      ]
                    : []),
                ]
              : ['Loading incident timeliness…']
          }
        />
        <CategorySection
          title="Program Integrity"
          status={programIntegrityStatus(progressSummary)}
          linkTo="/clients"
          lines={
            progressSummary
              ? [
                  `${progressSummary.submittedReports} progress reports submitted, ${progressSummary.draftReports} drafts`,
                  `${progressSummary.overdue} clients overdue, ${progressSummary.dueSoon} due within 14 days`,
                ]
              : ['Loading progress report summary…']
          }
        />
        <CategorySection
          title="Agency & Vendor File"
          status={vendorFileStatus(report, obligations)}
          linkTo="/compliance"
          lines={vendorFileLines(report, obligations, retention)}
        />
      </div>

      {retention && (
        <Card>
          <CardHeader>
            <CardTitle>Record retention (17 CCR §54326(a)(3))</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {retention.recordTypes.map((recordType) => (
                <li
                  key={recordType.key}
                  className="text-sm text-atria-text-secondary"
                >
                  {recordType.label}: {recordType.expiringSoon} approaching
                  expiry in the next {retention.windowDays} days ·{' '}
                  {recordType.legalHold} under legal hold · {recordType.total}{' '}
                  total
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {clerkOrgId && <CorrectiveActionsCard clerkOrgId={clerkOrgId} />}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Regional center vendor-file review</CardTitle>
          <Badge
            variant={
              checklistMet === checklistItems.length ? 'success' : 'warning'
            }
          >
            {checklistMet}/{checklistItems.length}
          </Badge>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {checklistItems.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-sm text-atria-text-secondary">
                  {item.label}
                </span>
                <span className="flex items-center gap-2">
                  {item.linkTo && !item.met && (
                    <Link
                      to={item.linkTo}
                      className="text-sm font-medium text-atria-accent hover:underline"
                    >
                      Fix →
                    </Link>
                  )}
                  <StatusBadge variant={item.met ? 'success' : 'danger'}>
                    {item.met ? 'Met' : 'Review'}
                  </StatusBadge>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-atria-muted">
            Self-inspection mirroring the biennial vendor-file review (17 CCR
            §54332(b)). Computed live — nothing is stored.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Annual program evaluation — FY summary</CardTitle>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Fiscal year"
              value={String(fiscalYearEnd)}
              onChange={(e) => setFiscalYearEnd(Number(e.target.value))}
              className="w-32"
            >
              {[0, 1, 2].map((offset) => {
                const year = currentFiscalYearEnd() - offset
                return (
                  <option key={year} value={year}>
                    {fiscalYearLabel(year)}
                  </option>
                )
              })}
            </Select>
            <Button
              variant="secondary"
              size="sm"
              disabled={downloadingEvaluation || !annualEvaluation}
              onClick={handleDownloadEvaluation}
            >
              <Download className="h-4 w-4" />
              {downloadingEvaluation ? 'Preparing…' : 'Download CSV'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!annualEvaluation ? (
            <p className="text-sm text-atria-text-secondary">
              Loading evaluation…
            </p>
          ) : (
            <ul className="space-y-1">
              <li className="text-sm text-atria-text-secondary">
                Period: {annualEvaluation.periodStart} to{' '}
                {annualEvaluation.periodEnd}
              </li>
              <li className="text-sm text-atria-text-secondary">
                Clients served: {annualEvaluation.clientsServed} · Hours
                delivered: {formatHours(annualEvaluation.hoursDelivered)}
              </li>
              <li className="text-sm text-atria-text-secondary">
                Objectives: {annualEvaluation.objectives.active} active,{' '}
                {annualEvaluation.objectives.achieved} achieved,{' '}
                {annualEvaluation.objectives.discontinued} discontinued
              </li>
              <li className="text-sm text-atria-text-secondary">
                Special incident reports: {annualEvaluation.incidents.total}
                {Object.keys(annualEvaluation.incidents.byCategory).length > 0
                  ? ` (${Object.keys(annualEvaluation.incidents.byCategory)
                      .sort()
                      .map(
                        (category) =>
                          `${formatStatusLabel(category)}: ${annualEvaluation.incidents.byCategory[category]}`,
                      )
                      .join(', ')})`
                  : ''}
              </li>
              <li className="text-sm text-atria-text-secondary">
                Documentation rate:{' '}
                {percent(
                  annualEvaluation.documentation.withNotes,
                  annualEvaluation.documentation.total,
                )}{' '}
                ({annualEvaluation.documentation.withNotes} of{' '}
                {annualEvaluation.documentation.total} shifts with notes)
              </li>
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Employee Compliance Gaps</CardTitle>
          <Badge
            variant={gapsWithIssues.length > 0 ? 'warning' : 'success'}
          >
            {gapsWithIssues.length}
          </Badge>
        </CardHeader>
        <CardContent>
          {report.gaps.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="h-6 w-6" />}
              title="No personnel on file"
              description="Employee credential gaps will appear here once employee profiles exist."
            />
          ) : gapsWithIssues.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="h-6 w-6" />}
              title="No compliance gaps"
              description="Every employee has their required credentials on file."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Employee</TableHeader>
                  <TableHeader>Missing</TableHeader>
                  <TableHeader>Expired</TableHeader>
                  <TableHeader>Overridden</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {gapsWithIssues.map((gap) => (
                  <TableRow key={gap.clerkUserId ?? gap.displayName}>
                    <TableCell className="font-medium">
                      {gap.displayName}
                    </TableCell>
                    <TableCell>
                      {gap.missing.length > 0 ? gap.missing.join(', ') : '—'}
                    </TableCell>
                    <TableCell>
                      {gap.expired.length > 0 ? gap.expired.join(', ') : '—'}
                    </TableCell>
                    <TableCell>
                      {gap.overridden.length > 0
                        ? gap.overridden.join(', ')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CategorySection({
  title,
  status,
  lines,
  linkTo,
}: {
  title: string
  status: CategoryStatus
  lines: string[]
  linkTo?: string
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <StatusBadge variant={statusBadgeVariant[status]}>
          {statusLabel[status]}
        </StatusBadge>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {lines.map((line) => (
            <li key={line} className="text-sm text-atria-text-secondary">
              {line}
            </li>
          ))}
        </ul>
        {linkTo && (
          <Link
            to={linkTo}
            className="mt-3 inline-block text-sm font-medium text-atria-accent hover:underline"
          >
            View details →
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
