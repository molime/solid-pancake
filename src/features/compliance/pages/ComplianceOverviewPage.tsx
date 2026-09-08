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
import { Select } from '@/shared/ui/Select'
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

const DAY_MS = 24 * 60 * 60 * 1000
const OBLIGATION_DUE_SOON_DAYS = 30

type ObligationStatus = 'ok' | 'due_soon' | 'overdue'

function computeObligationStatus(dueAt: string): ObligationStatus {
  const dueMs = new Date(dueAt).getTime()
  const now = Date.now()
  if (dueMs < now) return 'overdue'
  if (dueMs <= now + OBLIGATION_DUE_SOON_DAYS * DAY_MS) return 'due_soon'
  return 'ok'
}

const obligationStatusVariant: Record<ObligationStatus, StatusBadgeVariant> = {
  ok: 'success',
  due_soon: 'warning',
  overdue: 'danger',
}

const obligationStatusLabel: Record<ObligationStatus, string> = {
  ok: 'On track',
  due_soon: 'Due soon',
  overdue: 'Overdue',
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

  // Stage 2 — seeded CA ILS/SLS credential pack + agency obligations.
  const requirements = useQuery(
    api.compliance.listCredentialRequirements,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const obligations = useQuery(
    api.agencyObligations.listObligations,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const applyCredentialPack = useMutation(
    api.credentialPacks.applyCredentialPack,
  )
  const seedObligations = useMutation(api.agencyObligations.seedObligations)
  const completeObligation = useMutation(
    api.agencyObligations.completeObligation,
  )

  const isAdmin = member?.role === 'org:admin'
  const canManageObligations = isAdmin || member?.role === 'org:hr'
  const caregiverRequirements = (requirements ?? []).filter(
    (requirement) => requirement.role === 'org:caregiver',
  )
  const showPackCard =
    isAdmin && requirements !== undefined && caregiverRequirements.length === 0

  const [isApplyingPack, setIsApplyingPack] = useState(false)
  const [isSeedingObligations, setIsSeedingObligations] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<{
    obligationId: Id<'agencyObligations'>
    label: string
  } | null>(null)
  const [evidenceItemId, setEvidenceItemId] = useState('')
  const [obligationNotes, setObligationNotes] = useState('')
  const [isCompleting, setIsCompleting] = useState(false)

  // listDocumentArchive is admin/hr-only; only fetch it while the Complete
  // dialog is open so coordinators viewing the page never trigger it.
  const archiveItems = useQuery(
    api.documentArchive.listDocumentArchive,
    clerkOrgId && completeTarget && canManageObligations
      ? { clerkOrgId }
      : 'skip',
  )

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

  const handleApplyPack = async () => {
    if (!clerkOrgId) return
    setError(null)
    setMessage(null)
    setIsApplyingPack(true)
    try {
      const result = await applyCredentialPack({ clerkOrgId })
      setMessage(result.message)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Could not apply the credential pack.',
      )
    } finally {
      setIsApplyingPack(false)
    }
  }

  const handleSeedObligations = async () => {
    if (!clerkOrgId) return
    setError(null)
    setMessage(null)
    setIsSeedingObligations(true)
    try {
      const result = await seedObligations({ clerkOrgId })
      setMessage(result.message)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Could not seed obligations.',
      )
    } finally {
      setIsSeedingObligations(false)
    }
  }

  const openComplete = (obligation: {
    _id: Id<'agencyObligations'>
    label: string
    evidenceItemId?: Id<'documentArchiveItems'>
    notes?: string
  }) => {
    setCompleteTarget({ obligationId: obligation._id, label: obligation.label })
    setEvidenceItemId(obligation.evidenceItemId ?? '')
    setObligationNotes(obligation.notes ?? '')
    setError(null)
    setMessage(null)
  }

  const handleCompleteSubmit = async () => {
    if (!completeTarget || !clerkOrgId) return
    setError(null)
    setMessage(null)
    setIsCompleting(true)
    try {
      await completeObligation({
        clerkOrgId,
        obligationId: completeTarget.obligationId,
        ...(evidenceItemId
          ? { evidenceItemId: evidenceItemId as Id<'documentArchiveItems'> }
          : {}),
        ...(obligationNotes.trim() ? { notes: obligationNotes.trim() } : {}),
      })
      setMessage(
        `Obligation completed: ${completeTarget.label}. Due date rolled forward.`,
      )
      setCompleteTarget(null)
      setEvidenceItemId('')
      setObligationNotes('')
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Could not complete the obligation.',
      )
    } finally {
      setIsCompleting(false)
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

      {showPackCard && (
        <Card>
          <CardHeader>
            <CardTitle>Get started with CA ILS/SLS requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-atria-text-secondary">
                No caregiver credential requirements are configured yet. Apply
                the standard California ILS/SLS pack (Live Scan, CPR & First
                Aid, TB screening, mandated reporter, zero-tolerance, HIPAA,
                SIR training, and more) to make the compliance matrix
                meaningful immediately. Safe to re-apply — existing
                requirements are never duplicated.
              </p>
              <Button
                variant="primary"
                disabled={!clerkOrgId || isApplyingPack}
                onClick={handleApplyPack}
              >
                {isApplyingPack
                  ? 'Applying…'
                  : 'Apply CA ILS/SLS credential pack'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Agency obligations</CardTitle>
        </CardHeader>
        <CardContent>
          {obligations === undefined ? (
            <p className="py-8 text-center text-sm text-atria-text-secondary">
              Loading agency obligations…
            </p>
          ) : obligations.length === 0 ? (
            <div className="space-y-4">
              <EmptyState
                title="No agency obligations"
                description="Recurring agency-level items (DS 1891 disclosure, insurance certificates, CPA audit/review, and more) will appear here once seeded."
              />
              {isAdmin && (
                <div className="flex justify-center">
                  <Button
                    variant="secondary"
                    disabled={!clerkOrgId || isSeedingObligations}
                    onClick={handleSeedObligations}
                  >
                    {isSeedingObligations
                      ? 'Seeding…'
                      : 'Seed standard CA obligations'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Obligation</TableHeader>
                  <TableHeader>Due date</TableHeader>
                  <TableHeader>Cadence</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {obligations.map((obligation) => {
                  const status = computeObligationStatus(obligation.dueAt)
                  return (
                    <TableRow key={obligation._id}>
                      <TableCell className="font-medium">
                        {obligation.label}
                      </TableCell>
                      <TableCell>{formatDateUS(obligation.dueAt)}</TableCell>
                      <TableCell>
                        Every {obligation.cadenceMonths} months
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={obligationStatusVariant[status]}>
                          {obligationStatusLabel[status]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        {canManageObligations ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openComplete(obligation)}
                          >
                            Complete
                          </Button>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={completeTarget !== null}
        onClose={() => setCompleteTarget(null)}
      >
        <DialogHeader>
          <DialogTitle>Complete obligation</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <p className="text-sm text-atria-text-secondary">
            {completeTarget?.label}
          </p>
          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              Evidence document (optional)
            </label>
            <Select
              className="mt-1.5"
              onChange={(event) => setEvidenceItemId(event.target.value)}
              value={evidenceItemId}
            >
              <option value="">No evidence</option>
              {(archiveItems ?? []).map((item) => (
                <option key={item._id} value={item._id}>
                  {formatDocumentCategoryLabel(item.category)}
                  {item.file?.fileName ? ` — ${item.file.fileName}` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              Notes (optional)
            </label>
            <Textarea
              className="mt-1.5"
              onChange={(event) => setObligationNotes(event.target.value)}
              placeholder="Renewal details, certificate number, …"
              value={obligationNotes}
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setCompleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={isCompleting}
            onClick={handleCompleteSubmit}
          >
            {isCompleting ? 'Completing…' : 'Mark complete'}
          </Button>
        </DialogFooter>
      </Dialog>

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
