import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Separator } from '@/shared/ui/Separator'
import { Textarea } from '@/shared/ui/Textarea'
import { ReviewHistory } from './ReviewHistory'
import { Download } from 'lucide-react'

export function ReviewDetail({
  clerkOrgId,
  onDecisionComplete,
  shiftId,
}: {
  clerkOrgId: string
  onDecisionComplete?: () => void
  shiftId: Id<'shifts'>
}) {
  const details = useQuery(api.shiftQueries.getWithDetails, {
    clerkOrgId,
    shiftId,
  })
  const approve = useMutation(api.reviews.approve)
  const requestCorrection = useMutation(api.reviews.requestCorrection)
  const [comment, setComment] = useState('')

  if (!details) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-sm text-atria-muted">Loading details…</div>
        </CardContent>
      </Card>
    )
  }

  const { note, tasks, reviews } = details
  const blockers = getDocumentationBlockers(note, tasks)
  const canApprove = details.shift.status === 'submitted' && blockers.length === 0
  const canRequestCorrection =
    details.shift.status === 'submitted' ||
    details.shift.status === 'billing_ready'

  const handleApprove = async () => {
    await approve({ clerkOrgId, shiftId, comment })
    setComment('')
    onDecisionComplete?.()
  }

  const handleRequestCorrection = async () => {
    await requestCorrection({ clerkOrgId, shiftId, comment })
    setComment('')
    onDecisionComplete?.()
  }

  return (
    <div className="space-y-4">
      <DocumentationCard note={note} tasks={tasks} clerkOrgId={clerkOrgId} />
      <DecisionCard
        blockers={blockers}
        canApprove={canApprove}
        canRequestCorrection={canRequestCorrection}
        comment={comment}
        onApprove={handleApprove}
        onCommentChange={setComment}
        onRequestCorrection={handleRequestCorrection}
      />
      {reviews.length > 0 && <ReviewHistory reviews={reviews} />}
    </div>
  )
}

function DocumentationCard({
  note,
  tasks,
  clerkOrgId,
}: {
  note: NonNullable<
    ReturnType<typeof useQuery<typeof api.shiftQueries.getWithDetails>>
  >['note']
  tasks: NonNullable<
    ReturnType<typeof useQuery<typeof api.shiftQueries.getWithDetails>>
  >['tasks']
  clerkOrgId: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentation Detail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <DetailField label="Start Time" value={note?.startTime} />
          <DetailField label="End Time" value={note?.endTime} />
          <DetailField label="Services Provided" value={note?.servicesProvided} wide />
          <DetailField label="Client Response" value={note?.clientResponse} wide />
          <DetailField label="Narrative" value={note?.narrative} wide />
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium text-atria-ink mb-2">Tasks</h4>
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskReviewItem
                key={task._id}
                clerkOrgId={clerkOrgId}
                task={task}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TaskReviewItem({
  clerkOrgId,
  task,
}: {
  clerkOrgId: string
  task: {
    _id: Id<'shiftTasks'>
    title: string
    requiredProof: boolean
    status: string
    proofUrl?: string
    proofName?: string
  }
}) {
  const downloadUrl = useQuery(
    api.files.getDownloadUrl,
    task.proofUrl ? { clerkOrgId, storageId: task.proofUrl } : 'skip',
  )

  return (
    <div className="flex items-center justify-between p-3 rounded-md border border-atria-border">
      <div className="min-w-0">
        <p className="text-sm text-atria-ink">{task.title}</p>
        {task.requiredProof && (
          <p className="text-xs text-atria-danger">Proof required</p>
        )}
        {task.proofName && (
          <p className="text-xs text-atria-muted mt-0.5 truncate">
            {task.proofName}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-atria-accent/10 px-2 py-1 text-xs font-medium text-atria-accent hover:bg-atria-accent/20"
          >
            <Download className="h-3 w-3" />
            Download
          </a>
        )}
        <Badge variant={task.status === 'complete' ? 'success' : 'warning'}>
          {task.status}
        </Badge>
      </div>
    </div>
  )
}

function DetailField({
  label,
  value,
  wide,
}: {
  label: string
  value?: string
  wide?: boolean
}) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <p className="text-xs text-atria-muted uppercase tracking-wider">{label}</p>
      <p className="text-atria-ink">{value || '—'}</p>
    </div>
  )
}

function DecisionCard({
  blockers,
  canApprove,
  canRequestCorrection,
  comment,
  onApprove,
  onCommentChange,
  onRequestCorrection,
}: {
  blockers: string[]
  canApprove: boolean
  canRequestCorrection: boolean
  comment: string
  onApprove: () => void
  onCommentChange: (value: string) => void
  onRequestCorrection: () => void
}) {
  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader>
        <CardTitle>Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {blockers.length > 0 && (
          <div className="rounded-md bg-atria-danger-bg p-3">
            <p className="text-xs font-medium text-atria-danger mb-1">
              Incomplete — cannot approve
            </p>
            <ul className="space-y-0.5">
              {blockers.map((blocker) => (
                <li key={blocker} className="text-xs text-atria-danger">
                  {blocker}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
            Comment
          </label>
          <Textarea
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Add a review comment..."
          />
        </div>

        <div className="flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            disabled={!canApprove}
            onClick={onApprove}
          >
            Approve
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            disabled={!canRequestCorrection}
            onClick={onRequestCorrection}
          >
            Request Correction
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function getDocumentationBlockers(
  note: Parameters<typeof DocumentationCard>[0]['note'],
  tasks: Parameters<typeof DocumentationCard>[0]['tasks'],
): string[] {
  const blockers: string[] = []
  if (!note?.startTime.trim()) blockers.push('Start time is missing.')
  if (!note?.endTime.trim()) blockers.push('End time is missing.')
  if (!note?.servicesProvided.trim()) blockers.push('Services provided is missing.')
  if (!note?.clientResponse.trim()) blockers.push('Client response is missing.')
  if (!note?.narrative.trim()) blockers.push('Narrative is missing.')

  for (const task of tasks) {
    if (task.status !== 'complete') blockers.push(`${task.title} is incomplete.`)
    if (task.requiredProof && !task.proofName?.trim()) {
      blockers.push(`${task.title} requires proof.`)
    }
  }
  return blockers
}
