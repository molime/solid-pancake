import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import type { StatusBadgeVariant } from '@/shared/ui/StatusBadge'
import { Select } from '@/shared/ui/Select'
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
import { formatDateUS, formatStatusLabel } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { ClipboardCheck } from 'lucide-react'

type CorrectiveAction = FunctionReturnType<
  typeof api.correctiveActions.listCorrectiveActions
>[number]

type Source = CorrectiveAction['source']

const STATUS_VARIANTS: Record<CorrectiveAction['status'], StatusBadgeVariant> =
  {
    open: 'warning',
    submitted: 'info',
    verified: 'success',
  }

const SOURCE_LABELS: Record<Source, string> = {
  regional_center: 'Regional center',
  dds: 'DDS',
  internal: 'Internal',
}

export function CorrectiveActionsCard({ clerkOrgId }: { clerkOrgId: string }) {
  const caps = useQuery(api.correctiveActions.listCorrectiveActions, {
    clerkOrgId,
  })
  const createCap = useMutation(api.correctiveActions.createCorrectiveAction)
  const submitCap = useMutation(
    api.correctiveActions.submitCorrectiveActionEvidence,
  )
  const verifyCap = useMutation(api.correctiveActions.verifyCorrectiveAction)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<{
    source: Source
    finding: string
    dueAt: string
  }>({ source: 'regional_center', finding: '', dueAt: '' })
  const [error, setError] = useState<string | null>(null)

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? sanitizeConvexError(err.message) : fallback

  const openDialog = () => {
    setForm({ source: 'regional_center', finding: '', dueAt: '' })
    setError(null)
    setDialogOpen(true)
  }

  const handleCreate = async () => {
    setError(null)
    try {
      await createCap({
        clerkOrgId,
        source: form.source,
        finding: form.finding,
        dueAt: form.dueAt
          ? new Date(`${form.dueAt}T00:00:00.000Z`).toISOString()
          : undefined,
      })
      setDialogOpen(false)
    } catch (err) {
      setError(errorMessage(err, 'Failed to create the corrective action.'))
    }
  }

  const handleSubmitEvidence = async (cap: CorrectiveAction) => {
    setError(null)
    try {
      await submitCap({ clerkOrgId, correctiveActionId: cap._id })
    } catch (err) {
      setError(errorMessage(err, 'Failed to mark the corrective action submitted.'))
    }
  }

  const handleVerify = async (cap: CorrectiveAction) => {
    setError(null)
    try {
      await verifyCap({ clerkOrgId, correctiveActionId: cap._id })
    } catch (err) {
      setError(errorMessage(err, 'Failed to verify the corrective action.'))
    }
  }

  const active = (caps ?? []).filter((cap) => cap.status !== 'verified')
  const verified = (caps ?? []).filter((cap) => cap.status === 'verified')

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle>Corrective action plans</CardTitle>
          <Badge variant={active.some((cap) => cap.overdue) ? 'warning' : 'default'}>
            {active.length} open
          </Badge>
        </div>
        <Button variant="primary" size="sm" onClick={openDialog}>
          New corrective action
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {error && !dialogOpen && (
          <p className="px-6 pt-4 text-sm text-atria-danger">{error}</p>
        )}
        {!caps ? (
          <p className="p-6 text-sm text-atria-muted">
            Loading corrective actions…
          </p>
        ) : caps.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ClipboardCheck className="h-6 w-6" />}
              title="No corrective actions"
              description="Findings from regional center or DDS audits tracked as 30-day corrective action plans will appear here."
            />
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Source</TableHeader>
                <TableHeader>Finding</TableHeader>
                <TableHeader>Due</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Evidence</TableHeader>
                <TableHeader className="w-48">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...active, ...verified].map((cap) => (
                <TableRow key={cap._id}>
                  <TableCell>
                    <Badge variant="default">{SOURCE_LABELS[cap.source]}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{cap.finding}</TableCell>
                  <TableCell>
                    {cap.overdue ? (
                      <StatusBadge variant="danger">
                        Overdue · due {formatDateUS(cap.dueAt)}
                      </StatusBadge>
                    ) : (
                      formatDateUS(cap.dueAt)
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={STATUS_VARIANTS[cap.status]}>
                      {formatStatusLabel(cap.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{cap.evidenceFileName ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {cap.status === 'open' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSubmitEvidence(cap)}
                        >
                          Mark submitted
                        </Button>
                      )}
                      {cap.status === 'submitted' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerify(cap)}
                        >
                          Verify
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>New corrective action</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          {error && <p className="text-sm text-atria-danger">{error}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Source
              </label>
              <Select
                aria-label="Source"
                value={form.source}
                onChange={(e) =>
                  setForm((f) => ({ ...f, source: e.target.value as Source }))
                }
                className="mt-1"
              >
                <option value="regional_center">Regional center</option>
                <option value="dds">DDS</option>
                <option value="internal">Internal</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Due date (defaults to 30 days)
              </label>
              <USDateInput
                value={form.dueAt}
                onChange={(iso) => setForm((f) => ({ ...f, dueAt: iso }))}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
              Finding
            </label>
            <Textarea
              value={form.finding}
              onChange={(e) =>
                setForm((f) => ({ ...f, finding: e.target.value }))
              }
              aria-label="Finding"
              className="mt-1"
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!form.finding.trim()}
            onClick={handleCreate}
          >
            Create
          </Button>
        </DialogFooter>
      </Dialog>
    </Card>
  )
}
