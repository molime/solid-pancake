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
import { Download, ScrollText } from 'lucide-react'
import { useState } from 'react'

type AuditReport = FunctionReturnType<typeof api.auditReadiness.getReport>

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

function personnelStatus(report: AuditReport): CategoryStatus {
  const gapsWithIssues = report.gaps.filter(
    (gap) => gap.missing.length > 0 || gap.expired.length > 0,
  ).length
  if (report.personnel.expired > 0 || gapsWithIssues > 0) return 'action'
  if (report.personnel.expiring > 0) return 'review'
  return 'ready'
}

function backgroundChecksStatus(report: AuditReport): CategoryStatus {
  if (report.backgroundChecks.consider > 0) return 'action'
  if (report.backgroundChecks.pending > 0 || report.backgroundChecks.other > 0)
    return 'review'
  return 'ready'
}

function trainingStatus(report: AuditReport): CategoryStatus {
  if (report.training.pending > 0) return 'action'
  if (report.training.expiring > 0) return 'review'
  return 'ready'
}

function documentationStatus(report: AuditReport): CategoryStatus {
  const { total, withNotes } = report.documentation
  if (total === 0) return 'ready'
  const rate = withNotes / total
  if (rate >= DOCUMENTATION_READY_THRESHOLD) return 'ready'
  if (rate >= DOCUMENTATION_REVIEW_THRESHOLD) return 'review'
  return 'action'
}

function agencyInfoStatus(report: AuditReport): CategoryStatus {
  if (report.agency.ein && report.agency.address && report.branches.length > 0)
    return 'ready'
  return 'review'
}

export function AuditReadinessPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const convex = useConvex()
  const [downloading, setDownloading] = useState(false)

  const report = useQuery(
    api.auditReadiness.getReport,
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">Audit Trail</h1>
          <p className="text-base text-atria-text-secondary">
            Audit-readiness tool for California ILS/SLS compliance
          </p>
        </div>
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
          title="Personnel Credentials"
          status={personnelStatus(report)}
          lines={[
            `${report.personnel.compliant} verified, ${report.personnel.expiring} expiring, ${report.personnel.expired} expired`,
            `${gapsWithIssues.length} employees with gaps`,
          ]}
        />
        <CategorySection
          title="Background Checks"
          status={backgroundChecksStatus(report)}
          lines={[
            `${report.backgroundChecks.clear} clear, ${report.backgroundChecks.pending} pending, ${report.backgroundChecks.consider} consider`,
            report.backgroundChecks.other > 0
              ? `${report.backgroundChecks.other} in other states`
              : 'No checks in other states',
          ]}
        />
        <CategorySection
          title="Training Records"
          status={trainingStatus(report)}
          lines={[
            `${report.training.completed} completed, ${report.training.pending} pending`,
            `${report.training.expiring} expiring within 30 days`,
          ]}
        />
        <CategorySection
          title="Documentation"
          status={documentationStatus(report)}
          lines={[
            `${report.documentation.withNotes} of ${report.documentation.total} shifts have progress notes`,
            `${report.blockedBillingLines} billing lines blocked`,
          ]}
        />
        <CategorySection
          title="Agency Info"
          status={agencyInfoStatus(report)}
          lines={[
            report.agency.ein
              ? `EIN on file: ${report.agency.ein}`
              : 'EIN missing',
            report.agency.address
              ? 'Address on file'
              : 'Address missing',
            report.branches.length > 0
              ? `Branches: ${report.branches.join(', ')}`
              : 'No branches configured',
          ]}
        />
      </div>

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
}: {
  title: string
  status: CategoryStatus
  lines: string[]
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
      </CardContent>
    </Card>
  )
}
