import { useConvex, useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Badge } from '@/shared/ui/Badge'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { USDateInput } from '@/shared/ui/USDateInput'
import { Textarea } from '@/shared/ui/Textarea'
import { EmptyState } from '@/shared/ui/EmptyState'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from '@/shared/ui/Dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { formatDateUS, formatHours } from '@/shared/format'
import { downloadCsv } from '@/shared/lib/downloadCsv'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { ClipboardList, Download } from 'lucide-react'

type ListResult = FunctionReturnType<typeof api.progressReports.listProgressReports>
type Report = ListResult['reports'][number]
type DueInfo = ListResult['due'][number]

type EditableEntry = {
  objectiveId: Id<'clientObjectives'>
  objectiveTitle: string
  hoursDelivered: number
  servicesSummary: string
  progressSummary: string
  barriers: string
  planForward: string
}

type DialogState =
  | { mode: 'generate' }
  | { mode: 'edit' | 'submit' | 'view'; report: Report }

function periodTypeLabel(periodType: 'quarterly' | 'semiannual') {
  return periodType === 'quarterly' ? 'Quarterly' : 'Semi-annual'
}

function DueBadge({ due }: { due: DueInfo | undefined }) {
  if (!due || due.dueStatus === 'no_baseline') {
    return <StatusBadge variant="neutral">No reporting baseline</StatusBadge>
  }
  if (due.dueStatus === 'overdue') {
    return (
      <StatusBadge variant="danger">
        Overdue · due {formatDateUS(due.nextDueAt)}
      </StatusBadge>
    )
  }
  if (due.dueStatus === 'due_soon') {
    return (
      <StatusBadge variant="warning">
        Due {formatDateUS(due.nextDueAt)}
      </StatusBadge>
    )
  }
  return (
    <StatusBadge variant="success">
      Next due {formatDateUS(due.nextDueAt)}
    </StatusBadge>
  )
}

export function ClientProgressReports({
  clerkOrgId,
  clientId,
  serviceType,
  serviceCoordinatorEmail,
}: {
  clerkOrgId: string
  clientId: Id<'clients'>
  serviceType: 'SLS' | 'ILS'
  serviceCoordinatorEmail?: string
}) {
  const convex = useConvex()
  const data = useQuery(api.progressReports.listProgressReports, {
    clerkOrgId,
    clientId,
  })
  const generateReport = useMutation(api.progressReports.generateProgressReport)
  const updateEntries = useMutation(
    api.progressReports.updateProgressReportEntries,
  )
  const submitReport = useMutation(api.progressReports.submitProgressReport)

  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [generateForm, setGenerateForm] = useState({ start: '', end: '' })
  const [editEntries, setEditEntries] = useState<EditableEntry[]>([])
  const [submittedTo, setSubmittedTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const periodType = serviceType === 'SLS' ? 'quarterly' : 'semiannual'
  const due = data?.due[0]

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? sanitizeConvexError(err.message) : fallback

  const openGenerate = () => {
    setGenerateForm({
      start: due?.suggestedPeriodStart ?? '',
      end: due?.suggestedPeriodEnd ?? '',
    })
    setError(null)
    setDialog({ mode: 'generate' })
  }

  const handleGenerate = async () => {
    setError(null)
    try {
      await generateReport({
        clerkOrgId,
        clientId,
        periodType,
        periodStart: generateForm.start,
        periodEnd: generateForm.end,
      })
      setDialog(null)
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate the report.'))
    }
  }

  const openEdit = (report: Report) => {
    setEditEntries(
      report.entries.map((entry) => ({
        objectiveId: entry.objectiveId,
        objectiveTitle: entry.objectiveTitle,
        hoursDelivered: entry.hoursDelivered,
        servicesSummary: entry.servicesSummary,
        progressSummary: entry.progressSummary,
        barriers: entry.barriers,
        planForward: entry.planForward,
      })),
    )
    setError(null)
    setDialog({ mode: 'edit', report })
  }

  const handleSaveEntries = async () => {
    if (dialog?.mode !== 'edit') return
    setError(null)
    try {
      await updateEntries({
        clerkOrgId,
        reportId: dialog.report._id,
        entries: editEntries.map((entry) => ({
          objectiveId: entry.objectiveId,
          servicesSummary: entry.servicesSummary,
          progressSummary: entry.progressSummary,
          barriers: entry.barriers,
          planForward: entry.planForward,
        })),
      })
      setDialog(null)
    } catch (err) {
      setError(errorMessage(err, 'Failed to save the report entries.'))
    }
  }

  const openSubmit = (report: Report) => {
    setSubmittedTo(serviceCoordinatorEmail ?? '')
    setError(null)
    setDialog({ mode: 'submit', report })
  }

  const handleSubmit = async () => {
    if (dialog?.mode !== 'submit') return
    setError(null)
    try {
      await submitReport({
        clerkOrgId,
        reportId: dialog.report._id,
        submittedTo: submittedTo.trim() || undefined,
      })
      setDialog(null)
    } catch (err) {
      setError(errorMessage(err, 'Failed to submit the report.'))
    }
  }

  const handleCsv = async (report: Report) => {
    setDownloadingId(report._id)
    try {
      const csv = await convex.query(api.progressReports.exportReportCsv, {
        clerkOrgId,
        reportId: report._id,
      })
      downloadCsv(
        `progress-report-${report.periodStart}-to-${report.periodEnd}.csv`,
        csv,
      )
    } finally {
      setDownloadingId(null)
    }
  }

  const patchEntry = (index: number, patch: Partial<EditableEntry>) => {
    setEditEntries((entries) =>
      entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle>Progress reports</CardTitle>
          <DueBadge due={due} />
        </div>
        <Button variant="primary" size="sm" onClick={openGenerate}>
          Generate report
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {!data ? (
          <p className="p-6 text-sm text-atria-muted">
            Loading progress reports…
          </p>
        ) : data.reports.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ClipboardList className="h-6 w-6" />}
              title="No progress reports yet"
              description={`Generate the first ${periodTypeLabel(periodType).toLowerCase()} report from this client's objective-linked shift documentation.`}
            />
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Period</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Submitted</TableHeader>
                <TableHeader className="w-56">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.reports.map((report) => (
                <TableRow key={report._id}>
                  <TableCell className="font-medium">
                    {formatDateUS(report.periodStart)} –{' '}
                    {formatDateUS(report.periodEnd)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">
                      {periodTypeLabel(report.periodType)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={report.status === 'submitted' ? 'success' : 'info'}
                    >
                      {report.status === 'submitted' ? 'Submitted' : 'Draft'}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {report.submittedAt
                      ? `${formatDateUS(report.submittedAt)}${report.submittedTo ? ` · ${report.submittedTo}` : ''}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {report.status === 'draft' ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(report)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openSubmit(report)}
                          >
                            Submit
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setError(null)
                            setDialog({ mode: 'view', report })
                          }}
                        >
                          View
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={downloadingId === report._id}
                        onClick={() => handleCsv(report)}
                        aria-label="Download CSV"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialog?.mode === 'generate'} onClose={() => setDialog(null)}>
        <DialogHeader>
          <DialogTitle>
            Generate {periodTypeLabel(periodType).toLowerCase()} report
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          {error && <p className="text-sm text-atria-danger">{error}</p>}
          <p className="text-sm text-atria-text-secondary">
            Entries are prefilled from active IPP/ISP objectives and approved
            shifts in the period. Regenerating a draft refreshes its entries.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Period start
              </label>
              <USDateInput
                value={generateForm.start}
                onChange={(iso) =>
                  setGenerateForm((f) => ({ ...f, start: iso }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Period end
              </label>
              <USDateInput
                value={generateForm.end}
                onChange={(iso) => setGenerateForm((f) => ({ ...f, end: iso }))}
                className="mt-1"
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!generateForm.start || !generateForm.end}
            onClick={handleGenerate}
          >
            Generate
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={dialog?.mode === 'edit'}
        onClose={() => setDialog(null)}
        className="max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>
            Edit report —{' '}
            {dialog?.mode === 'edit'
              ? `${formatDateUS(dialog.report.periodStart)} – ${formatDateUS(dialog.report.periodEnd)}`
              : ''}
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          {error && <p className="text-sm text-atria-danger">{error}</p>}
          {editEntries.map((entry, index) => (
            <div
              key={entry.objectiveId}
              className="space-y-2 rounded-[var(--radius-atria-md)] border border-atria-border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-atria-ink">
                  {entry.objectiveTitle}
                </p>
                <p className="text-xs text-atria-muted">
                  Hours delivered: {formatHours(entry.hoursDelivered)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                  Services provided
                </label>
                <Textarea
                  value={entry.servicesSummary}
                  onChange={(e) =>
                    patchEntry(index, { servicesSummary: e.target.value })
                  }
                  aria-label={`Services provided for ${entry.objectiveTitle}`}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                  Progress
                </label>
                <Textarea
                  value={entry.progressSummary}
                  onChange={(e) =>
                    patchEntry(index, { progressSummary: e.target.value })
                  }
                  aria-label={`Progress for ${entry.objectiveTitle}`}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                  Barriers
                </label>
                <Textarea
                  value={entry.barriers}
                  onChange={(e) =>
                    patchEntry(index, { barriers: e.target.value })
                  }
                  aria-label={`Barriers for ${entry.objectiveTitle}`}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                  Plan forward
                </label>
                <Textarea
                  value={entry.planForward}
                  onChange={(e) =>
                    patchEntry(index, { planForward: e.target.value })
                  }
                  aria-label={`Plan forward for ${entry.objectiveTitle}`}
                  className="mt-1"
                />
              </div>
            </div>
          ))}
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSaveEntries}>
            Save entries
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={dialog?.mode === 'submit'} onClose={() => setDialog(null)}>
        <DialogHeader>
          <DialogTitle>Submit progress report</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          {error && <p className="text-sm text-atria-danger">{error}</p>}
          <p className="text-sm text-atria-text-secondary">
            Submitting locks the report. Record who it was sent to at the
            regional center.
          </p>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
              Submitted to (service coordinator)
            </label>
            <Input
              value={submittedTo}
              onChange={(e) => setSubmittedTo(e.target.value)}
              placeholder="e.g. sc@rc.example.com"
              className="mt-1"
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit}>
            Submit report
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={dialog?.mode === 'view'}
        onClose={() => setDialog(null)}
        className="max-w-4xl"
      >
        <DialogHeader>
          <DialogTitle>
            Progress report —{' '}
            {dialog?.mode === 'view'
              ? `${formatDateUS(dialog.report.periodStart)} – ${formatDateUS(dialog.report.periodEnd)}`
              : ''}
          </DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          {dialog?.mode === 'view' && (
            <>
              <p className="text-sm text-atria-text-secondary">
                Submitted{' '}
                {dialog.report.submittedAt
                  ? formatDateUS(dialog.report.submittedAt)
                  : '—'}
                {dialog.report.submittedTo
                  ? ` to ${dialog.report.submittedTo}`
                  : ''}
              </p>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Objective</TableHeader>
                    <TableHeader>Services</TableHeader>
                    <TableHeader>Progress</TableHeader>
                    <TableHeader>Barriers</TableHeader>
                    <TableHeader>Plan forward</TableHeader>
                    <TableHeader>Hours</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dialog.report.entries.map((entry) => (
                    <TableRow key={entry.objectiveId}>
                      <TableCell className="font-medium">
                        {entry.objectiveTitle}
                      </TableCell>
                      <TableCell>{entry.servicesSummary || '—'}</TableCell>
                      <TableCell>{entry.progressSummary || '—'}</TableCell>
                      <TableCell>{entry.barriers || '—'}</TableCell>
                      <TableCell>{entry.planForward || '—'}</TableCell>
                      <TableCell>{formatHours(entry.hoursDelivered)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setDialog(null)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>
    </Card>
  )
}
