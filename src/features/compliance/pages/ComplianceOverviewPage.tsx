import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { KpiCard } from '@/shared/ui/KpiCard'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/ui/StatusBadge'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { Textarea } from '@/shared/ui/Textarea'
import { USDateInput } from '@/shared/ui/USDateInput'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { ShieldCheck, Clock, XCircle, Ban, Download } from 'lucide-react'
import { formatDateUS, formatDocumentCategoryLabel } from '@/shared/format'
import { downloadCsv } from '@/shared/lib/downloadCsv'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'

const computedStatusVariant: Record<string, StatusBadgeVariant> = {
  compliant: 'success',
  expiring: 'warning',
  expired: 'danger',
}

const computedStatusLabel: Record<string, string> = {
  compliant: 'Compliant',
  expiring: 'Expiring',
  expired: 'Expired',
}

export function ComplianceOverviewPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const overview = useQuery(
    api.compliance.getComplianceOverview,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const items = useQuery(
    api.compliance.listComplianceItems,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const gaps = useQuery(
    api.compliance.complianceGaps,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const member = useQuery(api.members.me, clerkOrgId ? { clerkOrgId } : 'skip')
  const overrideComplianceBlock = useMutation(
    api.compliance.overrideComplianceBlock,
  )
  const exportReport = useMutation(api.reporting.exportReport)

  const canOverride = member?.role === 'org:admin' || member?.role === 'org:hr'

  const [overrideItem, setOverrideItem] = useState<{
    itemId: Id<'documentArchiveItems'>
    label: string
  } | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideExpiry, setOverrideExpiry] = useState('')
  const [isOverriding, setIsOverriding] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // listComplianceItems does not return overrideStatus per item, so
  // overridden rows are identified via the gaps query (displayName + raw
  // credential category — labels are requirement-defined and cannot be
  // reconstructed here).
  const overriddenKeys = new Set(
    (gaps ?? []).flatMap((gap) =>
      (gap.overriddenCategories ?? []).map(
        (category) => `${gap.displayName}::${category}`,
      ),
    ),
  )
  const isOverridden = (item: { subjectName: string; category: string }) =>
    overriddenKeys.has(`${item.subjectName}::${item.category}`)

  const gapsWithIssues = (gaps ?? []).filter(
    (gap) =>
      gap.missing.length > 0 ||
      gap.expired.length > 0 ||
      gap.overridden.length > 0,
  )

  const openOverride = (item: {
    itemId: Id<'documentArchiveItems'>
    subjectName: string
    category: string
  }) => {
    setOverrideItem({
      itemId: item.itemId,
      label: `${item.subjectName} — ${formatDocumentCategoryLabel(item.category)}`,
    })
    setOverrideReason('')
    setOverrideExpiry('')
    setError(null)
    setMessage(null)
  }

  const handleOverrideSubmit = async () => {
    if (!overrideItem || !clerkOrgId || !overrideReason.trim()) return
    setError(null)
    setMessage(null)
    setIsOverriding(true)
    try {
      await overrideComplianceBlock({
        clerkOrgId,
        documentArchiveItemId: overrideItem.itemId,
        reason: overrideReason.trim(),
        ...(overrideExpiry ? { newExpiry: overrideExpiry } : {}),
      })
      setMessage(`Override applied to ${overrideItem.label}.`)
      setOverrideItem(null)
      setOverrideReason('')
      setOverrideExpiry('')
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Override failed.',
      )
    } finally {
      setIsOverriding(false)
    }
  }

  const handleExport = async () => {
    if (!clerkOrgId) return
    setError(null)
    setMessage(null)
    setIsExporting(true)
    try {
      const end = new Date()
      const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)
      const csv = await exportReport({
        clerkOrgId,
        reportType: 'compliance',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      })
      downloadCsv('compliance-report.csv', csv)
      setMessage('Compliance report exported.')
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Export failed.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">Compliance</h1>
          <p className="text-base text-atria-text-secondary">
            Credential and document compliance across your workforce.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={!clerkOrgId || isExporting}
          onClick={handleExport}
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {message && (
        <div className="rounded-md border border-atria-success/20 bg-atria-success-bg px-4 py-3 text-sm text-atria-success">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-atria-danger/20 bg-atria-danger-bg px-4 py-3 text-sm text-atria-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Compliant"
          value={String(overview?.compliant ?? 0)}
          icon={<ShieldCheck className="h-5 w-5" />}
          valueClassName="text-atria-success"
          trend={
            <span className="text-sm text-atria-text-secondary">
              Verified and current
            </span>
          }
        />
        <KpiCard
          label="Expiring (30 days)"
          value={String(overview?.expiring ?? 0)}
          icon={<Clock className="h-5 w-5" />}
          valueClassName="text-atria-warning"
          trend={
            <span className="text-sm text-atria-text-secondary">
              Renewal needed soon
            </span>
          }
        />
        <KpiCard
          label="Expired"
          value={String(overview?.expired ?? 0)}
          icon={<XCircle className="h-5 w-5" />}
          valueClassName="text-atria-danger"
          trend={
            <span className="text-sm text-atria-text-secondary">
              Past expiration date
            </span>
          }
        />
        <KpiCard
          label="Blocked"
          value={String(overview?.blocked ?? 0)}
          icon={<Ban className="h-5 w-5" />}
          valueClassName="text-atria-danger"
          trend={
            <span className="text-sm text-atria-text-secondary">
              Rejected or expired
            </span>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance items</CardTitle>
        </CardHeader>
        <CardContent>
          {items === undefined ? (
            <p className="py-8 text-center text-sm text-atria-text-secondary">
              Loading compliance items…
            </p>
          ) : items.length === 0 ? (
            <EmptyState
              title="No compliance items"
              description="Credentials and documents will appear here once they are uploaded."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Employee</TableHeader>
                  <TableHeader>Credential type</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Expiration</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell className="font-medium">
                      {item.subjectName}
                    </TableCell>
                    <TableCell>
                      {formatDocumentCategoryLabel(item.category)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <StatusBadge
                          variant={
                            computedStatusVariant[item.computedStatus] ??
                            'neutral'
                          }
                        >
                          {computedStatusLabel[item.computedStatus] ??
                            item.computedStatus}
                        </StatusBadge>
                        {isOverridden(item) && (
                          <Badge variant="info">Overridden</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.expiresAt ? formatDateUS(item.expiresAt) : '—'}
                    </TableCell>
                    <TableCell>
                      {canOverride &&
                      !isOverridden(item) &&
                      (item.computedStatus === 'expired' ||
                        item.status === 'rejected') ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openOverride(item)}
                        >
                          Override
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gaps</CardTitle>
        </CardHeader>
        <CardContent>
          {gaps === undefined ? (
            <p className="py-8 text-center text-sm text-atria-text-secondary">
              Loading credential gaps…
            </p>
          ) : gapsWithIssues.length === 0 ? (
            <EmptyState
              title="No credential gaps"
              description="All caregivers have their required credentials on file."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Caregiver</TableHeader>
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

      <Dialog open={overrideItem !== null} onClose={() => setOverrideItem(null)}>
        <DialogHeader>
          <DialogTitle>Override compliance block</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <p className="text-sm text-atria-text-secondary">
            {overrideItem?.label}
          </p>
          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              Reason (required)
            </label>
            <Textarea
              className="mt-1.5"
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Why is this compliance block being overridden?"
              value={overrideReason}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              New expiry date (optional)
            </label>
            <USDateInput
              className="mt-1.5"
              onChange={setOverrideExpiry}
              value={overrideExpiry}
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOverrideItem(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!overrideReason.trim() || isOverriding}
            onClick={handleOverrideSubmit}
          >
            {isOverriding ? 'Applying…' : 'Apply override'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
