import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { UploadCloud } from 'lucide-react'

type ExternalStatus = 'pending' | 'submitted' | 'verified' | 'rejected'

const STATUS_VARIANT: Record<ExternalStatus, 'neutral' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  submitted: 'neutral',
  verified: 'success',
  rejected: 'danger',
}

/**
 * Training admin: create external (non-Atria) trainings and assign them to
 * members, then verify the certificates they upload.
 */
export function ExternalTrainingAdminCard({ clerkOrgId }: { clerkOrgId: string }) {
  const members = useQuery(api.members.list, { clerkOrgId })
  const assignments = useQuery(api.training.listExternalTrainingAssignments, {
    clerkOrgId,
  })
  const createAssignment = useMutation(api.training.createExternalTrainingAssignment)
  const reviewAssignment = useMutation(api.training.reviewExternalTraining)

  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dueAt, setDueAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const toggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleCreate = async () => {
    setBusy(true)
    setError('')
    try {
      await createAssignment({
        clerkOrgId,
        title,
        instructions: instructions || undefined,
        clerkUserIds: selectedIds,
        dueAt: dueAt || undefined,
      })
      setTitle('')
      setInstructions('')
      setSelectedIds([])
      setDueAt('')
    } catch (err) {
      setError(
        err instanceof Error ? sanitizeConvexError(err.message) : 'Create failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleReview = async (
    assignmentId: Id<'externalTrainingAssignments'>,
    approve: boolean,
  ) => {
    setBusy(true)
    setError('')
    try {
      await reviewAssignment({
        clerkOrgId,
        assignmentId,
        approve,
        rejectionReason: approve ? undefined : rejectionReason,
      })
      setRejectingId(null)
      setRejectionReason('')
    } catch (err) {
      setError(
        err instanceof Error ? sanitizeConvexError(err.message) : 'Review failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-4 w-4 text-atria-accent" />
          External trainings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-atria-text-secondary">
          Create an external training (done outside the platform), assign it to
          members — they get a task to upload their certificate, and you verify
          it here.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. CPR Renewal — Red Cross"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
              Due date (optional)
            </label>
            <Input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
            Instructions (optional)
          </label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Book the renewal at redcross.org and upload the completion card."
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
            Assign to
          </label>
          <div className="flex flex-wrap gap-2">
            {(members ?? []).map((m: { clerkUserId: string; displayName: string }) => (
              <label
                key={m.clerkUserId}
                className="flex items-center gap-1.5 rounded-full border border-atria-border bg-atria-surface px-2.5 py-1 text-xs text-atria-ink"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(m.clerkUserId)}
                  onChange={() => toggleMember(m.clerkUserId)}
                />
                {m.displayName}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={busy || !title.trim() || selectedIds.length === 0}
          >
            {busy ? 'Assigning…' : 'Create & assign'}
          </Button>
          {error && <p className="text-sm text-atria-danger">{error}</p>}
        </div>

        {assignments && assignments.length > 0 && (
          <div className="space-y-2 border-t border-atria-border pt-3">
            {assignments.map((a) => (
              <div
                key={a._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-3"
              >
                <div>
                  <p className="text-sm font-medium text-atria-ink">
                    {a.title}
                    <span className="ml-2 text-xs font-normal text-atria-text-muted">
                      {a.memberName}
                      {a.dueAt ? ` · due ${a.dueAt}` : ''}
                    </span>
                  </p>
                  {a.fileName && (
                    <p className="text-xs text-atria-text-secondary">
                      Uploaded: {a.fileName}
                    </p>
                  )}
                  {a.status === 'rejected' && a.rejectionReason && (
                    <p className="text-xs text-atria-danger">
                      Rejected: {a.rejectionReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant={STATUS_VARIANT[a.status as ExternalStatus] ?? 'neutral'}>
                    {a.status}
                  </StatusBadge>
                  {a.status === 'submitted' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleReview(a._id, true)}
                      >
                        Verify
                      </Button>
                      {rejectingId === a._id ? (
                        <span className="flex items-center gap-1">
                          <Input
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Reason"
                            className="h-8 w-36 text-xs"
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={busy || !rejectionReason.trim()}
                            onClick={() => handleReview(a._id, false)}
                          >
                            Reject
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRejectingId(a._id)}
                        >
                          Reject
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
