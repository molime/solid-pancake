import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import type { StatusBadgeVariant } from '@/shared/ui/StatusBadge'
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
import { MessageSquareWarning } from 'lucide-react'

type Grievance = FunctionReturnType<typeof api.grievances.listGrievances>[number]

const STATUS_VARIANTS: Record<Grievance['status'], StatusBadgeVariant> = {
  open: 'warning',
  resolution_proposed: 'info',
  resolved: 'success',
  escalated: 'danger',
}

type DialogState =
  | { mode: 'file' }
  | { mode: 'propose' | 'resolve'; grievance: Grievance }

function SlaBadge({ grievance }: { grievance: Grievance }) {
  if (grievance.status === 'resolved') {
    return <StatusBadge variant="neutral">Closed</StatusBadge>
  }
  if (grievance.slaBreached) {
    return (
      <StatusBadge variant="danger">
        Overdue · due {formatDateUS(grievance.slaDueAt)}
      </StatusBadge>
    )
  }
  return (
    <StatusBadge variant="warning">
      Due {formatDateUS(grievance.slaDueAt)}
    </StatusBadge>
  )
}

export function GrievancesSection({
  clerkOrgId,
  clientId,
}: {
  clerkOrgId: string
  clientId: Id<'clients'>
}) {
  const grievances = useQuery(api.grievances.listGrievances, {
    clerkOrgId,
    clientId,
  })
  const fileGrievance = useMutation(api.grievances.fileGrievance)
  const proposeResolution = useMutation(api.grievances.proposeResolution)
  const resolveGrievance = useMutation(api.grievances.resolveGrievance)
  const escalateGrievance = useMutation(api.grievances.escalateGrievance)

  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [fileForm, setFileForm] = useState({
    filedAt: new Date().toISOString().slice(0, 10),
    filedBy: '',
    description: '',
  })
  const [resolutionNote, setResolutionNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? sanitizeConvexError(err.message) : fallback

  const openDialog = (state: DialogState) => {
    setError(null)
    setResolutionNote('')
    if (state.mode === 'file') {
      setFileForm({
        filedAt: new Date().toISOString().slice(0, 10),
        filedBy: '',
        description: '',
      })
    }
    setDialog(state)
  }

  const handleFile = async () => {
    setError(null)
    try {
      await fileGrievance({
        clerkOrgId,
        clientId,
        filedAt: new Date(`${fileForm.filedAt}T00:00:00.000Z`).toISOString(),
        filedBy: fileForm.filedBy,
        description: fileForm.description,
      })
      setDialog(null)
    } catch (err) {
      setError(errorMessage(err, 'Failed to file the grievance.'))
    }
  }

  const handlePropose = async () => {
    if (dialog?.mode !== 'propose') return
    setError(null)
    try {
      await proposeResolution({
        clerkOrgId,
        grievanceId: dialog.grievance._id,
        resolutionNote,
      })
      setDialog(null)
    } catch (err) {
      setError(errorMessage(err, 'Failed to propose the resolution.'))
    }
  }

  const handleResolve = async () => {
    if (dialog?.mode !== 'resolve') return
    setError(null)
    try {
      await resolveGrievance({
        clerkOrgId,
        grievanceId: dialog.grievance._id,
        resolutionNote: resolutionNote.trim() || undefined,
      })
      setDialog(null)
    } catch (err) {
      setError(errorMessage(err, 'Failed to resolve the grievance.'))
    }
  }

  const handleEscalate = async (grievance: Grievance) => {
    setError(null)
    try {
      await escalateGrievance({ clerkOrgId, grievanceId: grievance._id })
    } catch (err) {
      setError(errorMessage(err, 'Failed to escalate the grievance.'))
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Grievances</CardTitle>
        <Button
          variant="primary"
          size="sm"
          onClick={() => openDialog({ mode: 'file' })}
        >
          File grievance
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {error && dialog === null && (
          <p className="px-6 pt-4 text-sm text-atria-danger">{error}</p>
        )}
        {!grievances ? (
          <p className="p-6 text-sm text-atria-muted">Loading grievances…</p>
        ) : grievances.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<MessageSquareWarning className="h-6 w-6" />}
              title="No grievances on file"
              description="Client grievances (WIC §4705) filed with the agency will appear here. A resolution must be proposed within 5 business days."
            />
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Filed</TableHeader>
                <TableHeader>Filed by</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Resolution SLA</TableHeader>
                <TableHeader className="w-56">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {grievances.map((grievance) => (
                <TableRow key={grievance._id}>
                  <TableCell>{formatDateUS(grievance.filedAt)}</TableCell>
                  <TableCell className="font-medium">
                    {grievance.filedBy}
                  </TableCell>
                  <TableCell>
                    <div>{grievance.description}</div>
                    {grievance.resolutionNote && (
                      <div className="text-xs text-atria-muted">
                        Resolution: {grievance.resolutionNote}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={STATUS_VARIANTS[grievance.status]}>
                      {formatStatusLabel(grievance.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <SlaBadge grievance={grievance} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(grievance.status === 'open' ||
                        grievance.status === 'escalated') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openDialog({ mode: 'propose', grievance })
                          }
                        >
                          Propose resolution
                        </Button>
                      )}
                      {grievance.status !== 'resolved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openDialog({ mode: 'resolve', grievance })
                          }
                        >
                          Resolve
                        </Button>
                      )}
                      {(grievance.status === 'open' ||
                        grievance.status === 'resolution_proposed') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEscalate(grievance)}
                        >
                          Escalate
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

      <Dialog open={dialog?.mode === 'file'} onClose={() => setDialog(null)}>
        <DialogHeader>
          <DialogTitle>File grievance</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          {error && <p className="text-sm text-atria-danger">{error}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Filed on
              </label>
              <USDateInput
                value={fileForm.filedAt}
                onChange={(iso) =>
                  setFileForm((f) => ({ ...f, filedAt: iso }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Filed by
              </label>
              <Input
                value={fileForm.filedBy}
                onChange={(e) =>
                  setFileForm((f) => ({ ...f, filedBy: e.target.value }))
                }
                placeholder="e.g. Client, authorized representative"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
              Description
            </label>
            <Textarea
              value={fileForm.description}
              onChange={(e) =>
                setFileForm((f) => ({ ...f, description: e.target.value }))
              }
              aria-label="Grievance description"
              className="mt-1"
            />
          </div>
          <p className="text-xs text-atria-muted">
            A resolution must be proposed within 5 business days of filing
            (WIC §4705).
          </p>
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={
              !fileForm.filedAt ||
              !fileForm.filedBy.trim() ||
              !fileForm.description.trim()
            }
            onClick={handleFile}
          >
            File grievance
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={dialog?.mode === 'propose'} onClose={() => setDialog(null)}>
        <DialogHeader>
          <DialogTitle>Propose resolution</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          {error && <p className="text-sm text-atria-danger">{error}</p>}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
              Resolution note
            </label>
            <Textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              aria-label="Resolution note"
              className="mt-1"
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!resolutionNote.trim()}
            onClick={handlePropose}
          >
            Propose resolution
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={dialog?.mode === 'resolve'} onClose={() => setDialog(null)}>
        <DialogHeader>
          <DialogTitle>Resolve grievance</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          {error && <p className="text-sm text-atria-danger">{error}</p>}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
              Resolution note (optional)
            </label>
            <Textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              aria-label="Resolution note"
              className="mt-1"
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleResolve}>
            Resolve
          </Button>
        </DialogFooter>
      </Dialog>
    </Card>
  )
}
