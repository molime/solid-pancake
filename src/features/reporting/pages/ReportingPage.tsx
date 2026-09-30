import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { KpiCard } from '@/shared/ui/KpiCard'
import { CalendarCheck, Banknote, Download, ShieldCheck, Users } from 'lucide-react'
import { formatCurrency } from '@/shared/format'
import { downloadCsv } from '@/shared/lib/downloadCsv'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'

export function ReportingPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const report = useQuery(
    api.reporting.getAgencyReport,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const performance = useQuery(
    api.reporting.getEmployeePerformance,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const exportReport = useMutation(api.reporting.exportReport)

  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  const handleExportCsv = async () => {
    if (!clerkOrgId) return
    setIsExporting(true)
    setExportError(null)
    setExportMessage(null)
    try {
      const now = new Date()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const startDate = `${now.getFullYear()}-${month}-01`
      const endDate = `${now.getFullYear()}-${month}-${String(
        now.getDate(),
      ).padStart(2, '0')}`
      const csv = await exportReport({
        clerkOrgId,
        reportType: 'agency',
        startDate,
        endDate,
      })
      downloadCsv(`agency-report-${startDate.slice(0, 7)}.csv`, csv)
      setExportMessage(
        `Downloaded agency report for ${startDate} - ${endDate}.`,
      )
    } catch (err) {
      setExportError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Report export failed.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  const visitsByWeek = report?.visitsByWeek ?? []
  const maxWeekCount = Math.max(1, ...visitsByWeek.map((week) => week.count))

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">Employee Performance</h1>
          <p className="text-base text-atria-text-secondary">
            Agency activity, coordinator performance, and revenue for the
            current month.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleExportCsv}
          disabled={isExporting}
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {exportMessage && (
        <p className="text-sm text-atria-success">{exportMessage}</p>
      )}
      {exportError && (
        <p className="text-sm text-atria-danger">{exportError}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Visits this month"
          value={String(report?.visitsThisMonth ?? 0)}
          icon={<CalendarCheck className="h-5 w-5" />}
          valueClassName="text-atria-info"
          trend={
            <span className="text-sm text-atria-text-secondary">
              vs {report?.visitsLastMonth ?? 0} last month
            </span>
          }
        />
        <KpiCard
          label="Revenue this month"
          value={formatCurrency(report?.revenueThisMonth ?? 0)}
          icon={<Banknote className="h-5 w-5" />}
          valueClassName="text-atria-success"
          trend={
            <span className="text-sm text-atria-text-secondary">
              vs {formatCurrency(report?.revenueLastMonth ?? 0)} last month
            </span>
          }
        />
        <KpiCard
          label="Compliance rate"
          value={`${report?.complianceRate ?? 0}%`}
          icon={<ShieldCheck className="h-5 w-5" />}
          trend={
            <span className="text-sm text-atria-text-secondary">
              Verified credentials
            </span>
          }
        />
        <KpiCard
          label="Active caregivers"
          value={String(report?.activeCaregivers ?? 0)}
          icon={<Users className="h-5 w-5" />}
          trend={
            <span className="text-sm text-atria-text-secondary">
              Caregivers on roster
            </span>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visits by week</CardTitle>
        </CardHeader>
        <CardContent>
          {report === undefined ? (
            <p className="py-8 text-center text-sm text-atria-text-secondary">
              Loading report…
            </p>
          ) : visitsByWeek.every((week) => week.count === 0) ? (
            <div className="rounded-[var(--radius-atria-md)] border border-dashed border-atria-border p-6 text-center">
              <p className="text-sm text-atria-text-secondary">
                No visits scheduled this month yet.
              </p>
            </div>
          ) : (
            <div className="flex h-48 items-end gap-3">
              {visitsByWeek.map((week) => (
                <div
                  key={week.label}
                  className="flex h-full flex-1 flex-col items-center gap-2"
                >
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-[var(--radius-atria-sm)] bg-atria-accent"
                      style={{
                        height: `${Math.max(
                          2,
                          Math.round((week.count / maxWeekCount) * 100),
                        )}%`,
                      }}
                      title={`${week.count} visits`}
                    />
                  </div>
                  <span className="text-xs text-atria-text-muted">
                    {week.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coordinator performance</CardTitle>
        </CardHeader>
        <CardContent>
          {performance === undefined ? (
            <p className="py-8 text-center text-sm text-atria-text-secondary">
              Loading coordinator performance…
            </p>
          ) : performance.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No coordinators"
              description="Coordinator performance appears here once you have coordinators with supervised employees or visits."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Coordinator</TableHeader>
                  {performance[0]?.weeklyVisits.map((week) => (
                    <TableHeader key={week.label}>{week.label}</TableHeader>
                  ))}
                  <TableHeader>This month</TableHeader>
                  <TableHeader>Supervision rounds</TableHeader>
                  <TableHeader>Caseload compliance</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {performance.map((row) => (
                  <TableRow key={row.clerkUserId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    {row.weeklyVisits.map((week) => (
                      <TableCell key={week.label}>{week.count}</TableCell>
                    ))}
                    <TableCell>{row.monthVisits}</TableCell>
                    <TableCell>
                      {row.roundsThisMonth}
                      {row.roundsClients > 0 && (
                        <span className="text-xs text-atria-text-muted">
                          {' '}
                          ({row.roundsClients} clients)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.caseloadCompliance === null
                        ? '—'
                        : `${row.caseloadCompliance}% (${row.caseloadSize} employees)`}
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
