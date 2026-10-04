import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { uploadFileToConvex } from '@/shared/lib/upload'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { ClipboardCheck } from 'lucide-react'

type ExternalStatus = 'pending' | 'submitted' | 'verified' | 'rejected'

const STATUS_VARIANT: Record<ExternalStatus, 'neutral' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  submitted: 'neutral',
  verified: 'success',
  rejected: 'danger',
}

/**
 * Member's external training tasks: assigned by the admin with instructions —
 * upload the certificate to check off; the admin verifies it.
 */
export function ExternalTrainingTasks({ clerkOrgId }: { clerkOrgId: string }) {
  const assignments = useQuery(
    api.training.listMyExternalTrainingAssignments,
    { clerkOrgId },
  )
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const submit = useMutation(api.training.submitExternalTraining)
  const [fileByAssignment, setFileByAssignment] = useState<Record<string, File | null>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (assignmentId: Id<'externalTrainingAssignments'>) => {
    const file = fileByAssignment[assignmentId]
    if (!file) return
    setBusyId(assignmentId)
    setError('')
    setSuccess('')
    try {
      const storageId = await uploadFileToConvex({
        generateUploadUrl,
        clerkOrgId,
        file,
      })
      await submit({
        clerkOrgId,
        assignmentId,
        storageId,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      })
      setSuccess('Certificate uploaded — your admin will verify it.')
      setFileByAssignment((prev) => ({ ...prev, [assignmentId]: null }))
    } catch (err) {
      setError(
        err instanceof Error ? sanitizeConvexError(err.message) : 'Upload failed.',
      )
    } finally {
      setBusyId(null)
    }
  }

  if (assignments === undefined) return null
  if (assignments.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-atria-accent" />
          External training tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignments.map((a) => (
          <div
            key={a._id}
            className="rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-atria-ink">{a.title}</p>
                {a.dueAt && (
                  <p className="text-xs text-atria-warning">Due {a.dueAt}</p>
                )}
                {a.instructions && (
                  <p className="mt-1 text-sm text-atria-text-secondary">
                    {a.instructions}
                  </p>
                )}
              </div>
              <StatusBadge variant={STATUS_VARIANT[a.status as ExternalStatus] ?? 'neutral'}>
                {a.status === 'submitted' ? 'pending verification' : a.status}
              </StatusBadge>
            </div>
            {a.status === 'rejected' && a.rejectionReason && (
              <p className="mt-2 text-xs text-atria-danger">
                Rejected: {a.rejectionReason} — upload a new certificate below.
              </p>
            )}
            {(a.status === 'pending' || a.status === 'rejected') && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    setFileByAssignment((prev) => ({
                      ...prev,
                      [a._id]: e.target.files?.[0] ?? null,
                    }))
                  }
                  className="text-xs text-atria-text-secondary"
                />
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busyId === a._id || !fileByAssignment[a._id]}
                  onClick={() => handleSubmit(a._id)}
                >
                  {busyId === a._id ? 'Uploading…' : 'Upload certificate'}
                </Button>
              </div>
            )}
            {a.fileName && (
              <p className="mt-2 text-xs text-atria-text-secondary">
                Uploaded: {a.fileName}
              </p>
            )}
          </div>
        ))}
        {error && <p className="text-sm text-atria-danger">{error}</p>}
        {success && <p className="text-sm text-atria-success">{success}</p>}
      </CardContent>
    </Card>
  )
}
