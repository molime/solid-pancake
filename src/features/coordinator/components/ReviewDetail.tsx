import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { Separator } from '@/shared/ui/Separator'
import { Textarea } from '@/shared/ui/Textarea'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { ReviewHistory } from './ReviewHistory'
import {
  ArrowLeft,
  Check,
  Clock,
  Download,
  Flag,
  MapPin,
  AlertTriangle,
} from 'lucide-react'

export function ReviewDetail({
  clerkOrgId,
  caregiverName,
  clientName,
  onBack,
  shiftId,
}: {
  clerkOrgId: string
  caregiverName?: string
  clientName?: string
  onBack?: () => void
  shiftId: Id<'shifts'>
}) {
  const details = useQuery(api.shiftQueries.getWithDetails, {
    clerkOrgId,
    shiftId,
  })
  const approve = useMutation(api.reviews.approve)
  const requestCorrection = useMutation(api.reviews.requestCorrection)
  const escalateToSupervisor = useMutation(api.reviews.escalateToSupervisor)
  const member = useQuery(
    api.members.me,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const isAdmin = member?.role === 'org:admin'
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [correctionError, setCorrectionError] = useState(false)
  const [escalateOpen, setEscalateOpen] = useState(false)
  const [escalateReason, setEscalateReason] = useState('')
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  if (!details) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-sm text-atria-muted">Loading details…</div>
        </CardContent>
      </Card>
    )
  }

  const { shift, note, tasks, reviews, verification } = details
  const blockers = getDocumentationBlockers(note, tasks)
  const canApprove = shift.status === 'submitted' && blockers.length === 0
  const canRequestCorrection =
    shift.status === 'submitted' || shift.status === 'billing_ready'

  const displayCaregiverName = caregiverName ?? 'Unknown caregiver'
  const displayClientName = clientName ?? 'Unknown client'
  const initials = getInitials(displayCaregiverName)

  const handleApprove = async () => {
    setError(null)
    setWarning(null)
    setIsSubmitting(true)
    try {
      const result = await approve({ clerkOrgId, shiftId, comment })
      setComment('')
      // approve resolves to the shift id on success, or to a human-readable
      // warning string when the billing line was blocked by compliance.
      if (typeof result === 'string' && result !== shiftId) {
        setWarning(result)
      } else {
        onBack?.()
      }
    } catch (err) {
      setError(err instanceof Error ? sanitizeConvexError(err.message) : 'Approval failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOverrideApprove = async () => {
    setError(null)
    if (!overrideReason.trim()) return
    setIsSubmitting(true)
    try {
      await approve({
        clerkOrgId,
        shiftId,
        comment,
        complianceOverride: true,
        complianceOverrideReason: overrideReason.trim(),
      })
      setComment('')
      setOverrideReason('')
      setOverrideOpen(false)
      setWarning(null)
      onBack?.()
    } catch (err) {
      setError(err instanceof Error ? sanitizeConvexError(err.message) : 'Override approval failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEscalate = async () => {
    setError(null)
    setMessage(null)
    if (!escalateReason.trim()) return
    setIsSubmitting(true)
    try {
      await escalateToSupervisor({
        clerkOrgId,
        shiftId,
        reason: escalateReason.trim(),
      })
      setEscalateReason('')
      setEscalateOpen(false)
      setMessage('Escalated to admin for review.')
    } catch (err) {
      setError(err instanceof Error ? sanitizeConvexError(err.message) : 'Escalation failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRequestCorrection = async () => {
    setError(null)
    if (!comment.trim()) {
      setCorrectionError(true)
      return
    }
    setCorrectionError(false)
    setIsSubmitting(true)
    try {
      await requestCorrection({ clerkOrgId, shiftId, comment })
      setComment('')
      onBack?.()
    } catch (err) {
      setError(err instanceof Error ? sanitizeConvexError(err.message) : 'Correction request failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {onBack && (
        <button
          className="inline-flex items-center gap-1.5 text-sm text-atria-muted transition-colors hover:text-atria-ink"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Documentation
        </button>
      )}

      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-atria-accent text-atria-on-accent">
          <span className="text-base font-semibold">{initials}</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-atria-ink">
            {displayCaregiverName}&apos;s shift notes
          </h1>
          <p className="text-sm text-atria-muted">
            Client: {displayClientName} · {formatShiftMeta(shift)}
            {note?.submittedAt && ` · Submitted ${formatTime(note.submittedAt)}`}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-atria-danger/20 bg-atria-danger-bg px-4 py-3 text-sm text-atria-danger">
          {error}
        </div>
      )}

      {warning && (
        <div className="rounded-md border border-atria-warning/20 bg-atria-warning-bg px-4 py-3 text-sm text-atria-warning">
          <p>{warning}</p>
          {isAdmin && (
            <Button
              className="mt-2"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                setOverrideReason('')
                setOverrideOpen(true)
              }}
              data-testid="compliance-override-button"
            >
              Approve with compliance override
            </Button>
          )}
        </div>
      )}

      {message && (
        <div className="rounded-md border border-atria-success/20 bg-atria-success-bg px-4 py-3 text-sm text-atria-success">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <DocumentationCard
            blockers={blockers}
            caregiverName={displayCaregiverName}
            note={note}
            tasks={tasks}
            clerkOrgId={clerkOrgId}
            verification={verification}
          />
        </div>

        <div className="lg:col-span-2">
          <DecisionCard
            blockers={blockers}
            canApprove={canApprove}
            canEscalate={shift.status === 'submitted'}
            canRequestCorrection={canRequestCorrection}
            caregiverName={displayCaregiverName}
            comment={comment}
            commentError={correctionError}
            isSubmitting={isSubmitting}
            onApprove={handleApprove}
            onCommentChange={(value) => {
              setComment(value)
              if (value.trim()) setCorrectionError(false)
            }}
            onEscalate={() => {
              setEscalateReason('')
              setError(null)
              setMessage(null)
              setEscalateOpen(true)
            }}
            onRequestCorrection={handleRequestCorrection}
            reviews={reviews}
            shiftStatus={shift.status}
            submittedAt={note?.submittedAt}
            verification={verification}
          />
        </div>
      </div>

      <Dialog open={escalateOpen} onClose={() => setEscalateOpen(false)}>
        <DialogHeader>
          <DialogTitle>Escalate to Admin</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
            Reason
          </label>
          <Textarea
            className="mt-1.5"
            onChange={(event) => setEscalateReason(event.target.value)}
            placeholder="Why does this shift need admin review?"
            value={escalateReason}
            data-testid="escalate-reason-input"
          />
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setEscalateOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!escalateReason.trim() || isSubmitting}
            onClick={handleEscalate}
            data-testid="escalate-submit-button"
          >
            {isSubmitting ? 'Escalating…' : 'Escalate'}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={overrideOpen} onClose={() => setOverrideOpen(false)}>
        <DialogHeader>
          <DialogTitle>Approve with compliance override</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
            Override reason
          </label>
          <Textarea
            className="mt-1.5"
            onChange={(event) => setOverrideReason(event.target.value)}
            placeholder="Why is the compliance block being overridden?"
            value={overrideReason}
            data-testid="compliance-override-reason-input"
          />
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOverrideOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!overrideReason.trim() || isSubmitting}
            onClick={handleOverrideApprove}
            data-testid="compliance-override-submit-button"
          >
            {isSubmitting ? 'Approving…' : 'Approve with override'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

function DocumentationCard({
  blockers,
  caregiverName,
  clerkOrgId,
  note,
  tasks,
  verification,
}: {
  blockers: string[]
  caregiverName: string
  clerkOrgId: string
  note: NonNullable<
    ReturnType<typeof useQuery<typeof api.shiftQueries.getWithDetails>>
  >['note']
  tasks: NonNullable<
    ReturnType<typeof useQuery<typeof api.shiftQueries.getWithDetails>>
  >['tasks']
  verification: NonNullable<
    ReturnType<typeof useQuery<typeof api.shiftQueries.getWithDetails>>
  >['verification']
}) {
  const services = note?.servicesProvided
    ? note.servicesProvided.split(',').map((s) => s.trim()).filter(Boolean)
    : []
  const goals = services.filter((s) => /goal/i.test(s))
  const helpItems = services.filter((s) => !/goal/i.test(s))
  const issuesText = note?.clientResponse?.trim() || 'No problems — all good today'
  const noProblems = /no problems|all good|none|no issues/i.test(issuesText)

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-6 p-6">
        <NoteSection
          icon={<Clock className="h-4 w-4" />}
          label="WHEN"
          labelClass="text-atria-step-when"
        >
          <p className="text-base text-atria-ink">
            {formatTimeString(note?.startTime)} – {formatTimeString(note?.endTime)}
            {note?.startTime && note?.endTime && (
              <span className="text-atria-muted">
                {' '}
                ({formatDuration(note.startTime, note.endTime)})
              </span>
            )}
          </p>
        </NoteSection>

        <NoteSection
          icon={<span className="text-base">🧩</span>}
          label="WHAT THEY HELPED WITH"
          labelClass="text-atria-step-what"
        >
          <p className="text-base text-atria-ink">
            {helpItems.length > 0
              ? helpItems.join(' · ')
              : note?.servicesProvided || '—'}
          </p>
        </NoteSection>

        <NoteSection
          icon={<span className="text-base">✍</span>}
          label="HOW THE VISIT WENT (in caregiver's words)"
          labelClass="text-atria-step-how"
        >
          {note?.narrative ? (
            <div className="rounded-[var(--radius-atria-md)] bg-atria-surface-2 p-4">
              <p className="text-base text-atria-text-secondary">
                &ldquo;{note.narrative}&rdquo;
              </p>
            </div>
          ) : (
            <p className="text-base text-atria-muted">—</p>
          )}
        </NoteSection>

        <NoteSection
          icon={<span className="text-base">🎯</span>}
          label="CARE PLAN GOALS WORKED ON"
          labelClass="text-atria-step-goal"
        >
          {goals.length > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {goals.map((goal) => {
                const label = goal.replace(/\s*goal\s*$/i, '').trim()
                return (
                  <span key={goal} className="inline-flex items-center gap-1.5 text-base text-atria-ink">
                    <Check className="h-4 w-4 text-atria-success" />
                    {label}
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-base text-atria-muted">—</p>
          )}
        </NoteSection>

        <NoteSection
          icon={<span className="text-base">🩺</span>}
          label="ISSUES REPORTED"
          labelClass="text-atria-step-issues"
        >
          <Badge
            variant={noProblems ? 'success' : 'warning'}
            className="text-sm px-3 py-1"
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            {issuesText}
          </Badge>
        </NoteSection>

        <Separator />

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-atria-muted">
            Tasks & Proof
          </h4>
          <div className="mt-3 space-y-2">
            {tasks.length === 0 && (
              <p className="text-sm text-atria-muted">No tasks recorded.</p>
            )}
            {tasks.map((task: Doc<'shiftTasks'>) => (
              <TaskReviewItem
                key={task._id}
                clerkOrgId={clerkOrgId}
                task={task}
              />
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-atria-muted">
            Caregiver Confirmation
          </h4>
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-atria-ink">
            <Check className="h-4 w-4 text-atria-success" />
            {caregiverName} confirmed this is accurate and true
            {note?.submittedAt && (
              <span className="text-atria-muted">
                · Signed {formatTime(note.submittedAt)},{' '}
                {formatDateShort(note.submittedAt)}
              </span>
            )}
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-atria-muted">
            Verification
          </h4>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-atria-text-secondary">
            {verification.locationMatched ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-atria-success" />
                Location matched client address
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-atria-muted">
                <MapPin className="h-4 w-4" />
                Location not verified
              </span>
            )}
            {verification.submittedOnSite ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-atria-success" />
                Submitted from on-site
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-atria-muted">
                <Clock className="h-4 w-4" />
                On-site submission not verified
              </span>
            )}
          </div>
          {blockers.length > 0 && (
            <div className="mt-3 rounded-md border border-atria-danger/20 bg-atria-danger-bg p-3">
              <p className="text-xs font-medium text-atria-danger mb-1">
                Missing information
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
        </div>
      </CardContent>
    </Card>
  )
}

function NoteSection({
  children,
  icon,
  label,
  labelClass,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  label: string
  labelClass: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
        <span className="text-atria-text-secondary">{icon}</span>
        <span className={labelClass}>{label}</span>
      </div>
      {children}
    </div>
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
    <div className="flex items-center justify-between rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-3">
      <div className="min-w-0">
        <p className="text-sm text-atria-ink">{task.title}</p>
        {task.requiredProof && !task.proofName && (
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
          {task.status === 'complete' ? 'Complete' : 'Incomplete'}
        </Badge>
      </div>
    </div>
  )
}

function DecisionCard({
  blockers,
  canApprove,
  canEscalate,
  canRequestCorrection,
  caregiverName,
  comment,
  commentError,
  isSubmitting,
  onApprove,
  onCommentChange,
  onEscalate,
  onRequestCorrection,
  reviews,
  shiftStatus,
  submittedAt,
  verification,
}: {
  blockers: string[]
  canApprove: boolean
  canEscalate: boolean
  canRequestCorrection: boolean
  caregiverName: string
  comment: string
  commentError: boolean
  isSubmitting: boolean
  onApprove: () => void
  onCommentChange: (value: string) => void
  onEscalate: () => void
  onRequestCorrection: () => void
  reviews: Array<{ _id: string; createdAt: string; decision: 'approved' | 'correction_requested'; comment: string }>
  shiftStatus: string
  submittedAt?: string
  verification: NonNullable<
    ReturnType<typeof useQuery<typeof api.shiftQueries.getWithDetails>>
  >['verification']
}) {
  const dependency = getDependencyMessage(blockers, shiftStatus)

  return (
    <Card className="lg:sticky lg:top-4">
      <CardContent className="space-y-5 p-6">
        <div>
          <h3 className="text-base font-semibold text-atria-ink">Your decision</h3>
          <p className="mt-1 text-sm text-atria-muted">
            If everything looks right, approve it. If something needs fixing,
            send it back with a note.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
            Comment
          </label>
          <Textarea
            className="mt-1.5"
            hasError={commentError}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Add a review comment..."
            value={comment}
            data-testid="review-comment-input"
          />
        </div>

        <div className="space-y-3">
          <Button
            variant="primary"
            className="h-14 w-full rounded-full text-base"
            disabled={!canApprove || isSubmitting}
            onClick={onApprove}
            data-testid="approve-button"
          >
            {isSubmitting ? (
              'Approving…'
            ) : (
              <>
                <Check className="h-5 w-5" />
                Approve
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            className="h-14 w-full rounded-full border-atria-warning bg-transparent text-base text-atria-warning hover:bg-atria-warning/10"
            disabled={!canRequestCorrection || isSubmitting}
            onClick={onRequestCorrection}
            data-testid="request-correction-button"
          >
            {isSubmitting ? (
              'Sending…'
            ) : (
              <>
                <AlertTriangle className="h-5 w-5" />
                Request Correction
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            className="h-14 w-full rounded-full text-base"
            disabled={!canEscalate || isSubmitting}
            onClick={onEscalate}
            data-testid="escalate-button"
          >
            <Flag className="h-5 w-5" />
            Escalate to Admin
          </Button>
        </div>

        {commentError && (
          <p className="text-sm text-atria-danger">
            Add a comment before requesting a correction.
          </p>
        )}

        <div className="rounded-[var(--radius-atria-md)] bg-atria-surface-2 p-3 text-sm">
          <p className="text-atria-text-secondary">{dependency}</p>
          {blockers.length > 0 && (
            <ul className="mt-2 space-y-1">
              {blockers.map((blocker) => (
                <li key={blocker} className="text-xs text-atria-danger">
                  · {blocker}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />

        <ReviewHistory
          reviews={reviews}
          submittedAt={submittedAt}
          submittedBy={caregiverName}
          shiftStatus={shiftStatus}
          verified={verification.locationMatched && verification.submittedOnSite}
        />
      </CardContent>
    </Card>
  )
}

function getDependencyMessage(
  blockers: string[],
  shiftStatus: string,
): string {
  if (shiftStatus === 'billing_ready') {
    return 'Approved and ready for billing.'
  }
  if (shiftStatus === 'needs_correction') {
    return 'Returned to caregiver for correction. Billing is blocked until resubmitted and approved.'
  }
  if (blockers.length > 0) {
    return `Missing ${blockers.length} item${blockers.length === 1 ? '' : 's'}. Next: caregiver correction. Blocks: coordinator approval and billing.`
  }
  return 'Approving releases this note for billing. Next: billing. Blocks: none.'
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

function formatShiftMeta(shift: { scheduledStart: string; scheduledEnd: string }): string {
  const start = new Date(shift.scheduledStart)
  const startTime = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const end = new Date(shift.scheduledEnd)
  const endTime = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const weekday = start.toLocaleDateString('en-US', { weekday: 'short' })
  const monthDay = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  return `${weekday}, ${monthDay} · ${startTime} – ${endTime}`
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDateShort(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

function formatDuration(start: string, end: string): string {
  const startMinutes = parseTime(start)
  const endMinutes = parseTime(end)
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return ''
  }
  const hours = (endMinutes - startMinutes) / 60
  return hours === 1 ? '1 hour' : `${hours} hours`
}

function formatTimeString(value?: string): string {
  if (!value) return '--:--'
  const minutes = parseTime(value)
  if (minutes === null) return value
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayHour = h % 12 === 0 ? 12 : h % 12
  const displayMinute = m.toString().padStart(2, '0')
  return `${displayHour}:${displayMinute} ${ampm}`
}

function parseTime(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
