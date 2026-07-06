import { useOrganization, useUser } from '@clerk/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Textarea'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { HrToast } from '../components/HrToast'
import { useHrToast } from '../hooks/useHrToast'
import { candidateStatusPill, candidateStatusAccentClass } from '../lib/candidateStatus'
import { formatWeekdayDate } from '@/shared/format'
import { ArrowLeft, CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Id } from '../../../../convex/_generated/dataModel'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function ApplicationField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
        {label}
      </p>
      <p className="mt-1 text-base text-atria-ink">{value || '—'}</p>
    </div>
  )
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface p-6 shadow-[var(--shadow-atria-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-atria-ink">{title}</h3>
        <p className="mt-2 text-base text-atria-text-secondary">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ApplicationReviewPage() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const { organization } = useOrganization()
  const { user } = useUser()

  const clerkOrgId = organization?.id

  const detail = useQuery(
    api.candidates.getCandidateDetail,
    clerkOrgId && candidateId
      ? { clerkOrgId, candidateId: candidateId as Id<'candidates'> }
      : 'skip',
  )
  const tasks = useQuery(
    api.candidates.listCandidateTasksForHR,
    clerkOrgId && candidateId
      ? { clerkOrgId, candidateId: candidateId as Id<'candidates'> }
      : 'skip',
  )
  const reviewApplication = useMutation(api.candidates.reviewApplication)
  const sendOffer = useMutation(api.candidates.sendOffer)

  const [hrNotes, setHrNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)
  const { toast, show, hide } = useHrToast()

  const candidate = detail?.candidate
  const application = detail?.applications?.[0]

  const allTasksComplete = useMemo(() => {
    const list = tasks ?? []
    if (list.length === 0) return false
    return list.every((t) => t.status === 'complete' || t.status === 'waived')
  }, [tasks])

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-text-secondary">Loading application…</div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-danger">Candidate not found.</div>
      </div>
    )
  }

  const fields = (application?.fields ?? {}) as Record<string, string>
  const pill = candidateStatusPill(candidate.status)

  const handleAdvance = async () => {
    if (!clerkOrgId || !candidateId) return
    setSubmitting(true)
    try {
      await sendOffer({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
      })
      show('success', 'Offer sent', 'The candidate can now accept the offer.')
    } catch (err) {
      show(
        'danger',
        'Could not advance candidate',
        err instanceof Error ? err.message : 'Unknown error.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleCorrection = async () => {
    if (!clerkOrgId || !candidateId || !hrNotes.trim()) return
    setSubmitting(true)
    try {
      await reviewApplication({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
        decision: 'needs_correction',
        hrNotes: hrNotes.trim(),
      })
      setHrNotes('')
      show('warning', 'Correction requested', 'The candidate has been notified.')
    } catch (err) {
      show(
        'danger',
        'Request failed',
        err instanceof Error ? err.message : 'Unknown error.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!clerkOrgId || !candidateId) return
    setSubmitting(true)
    try {
      await reviewApplication({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
        decision: 'rejected',
        hrNotes: hrNotes.trim() || undefined,
      })
      setConfirmReject(false)
      show('danger', 'Application rejected')
    } catch (err) {
      show(
        'danger',
        'Rejection failed',
        err instanceof Error ? err.message : 'Unknown error.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/hr/candidates"
        className="inline-flex items-center gap-1 text-sm font-medium text-atria-accent hover:text-atria-accent-hover"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Candidate Pipeline
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-atria-ink">Application Review</h1>
        <p className="text-base text-atria-text-secondary">
          {candidate.displayName} · {fields.position || 'Caregiver'} · Applied{' '}
          {application?.submittedAt
            ? formatWeekdayDate(application.submittedAt)
            : '—'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold ${candidateStatusAccentClass(candidate.status)}`}
              >
                {initials(candidate.displayName)}
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold text-atria-ink">
                  {candidate.displayName}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-atria-text-secondary">
                  <span>{candidate.email}</span>
                  {candidate.phone && <span>{candidate.phone}</span>}
                  <StatusBadge variant={pill.variant}>{pill.label}</StatusBadge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-atria-ink">
                Application details
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ApplicationField
                  label="POSITION"
                  value={fields.position || 'Caregiver'}
                />
                <ApplicationField
                  label="EXPERIENCE"
                  value={fields.yearsExperience || fields.experience || ''}
                />
                <ApplicationField
                  label="AVAILABILITY"
                  value={fields.availability || ''}
                />
                <ApplicationField
                  label="RECRUITER"
                  value={fields.recruiter || user?.fullName || ''}
                />
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-atria-ink">
                Documents submitted
              </h3>
              <div className="mt-3 space-y-2">
                {(detail.documents ?? []).length === 0 ? (
                  <p className="text-sm text-atria-text-secondary">
                    No documents submitted yet.
                  </p>
                ) : (
                  detail.documents!.map((doc) => (
                    <div
                      key={doc._id}
                      className="flex items-center justify-between rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-3"
                    >
                      <span className="text-sm text-atria-ink">
                        {doc.category}
                      </span>
                      <StatusBadge
                        variant={
                          doc.status === 'active' || doc.status === 'verified'
                            ? 'success'
                            : doc.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {doc.status === 'active'
                          ? 'Received'
                          : doc.status === 'verified'
                            ? 'Verified'
                            : doc.status === 'rejected'
                              ? 'Missing'
                              : 'Under review'}
                      </StatusBadge>
                    </div>
                  ))
                )}
              </div>
            </div>

            <FieldGroup
              label="Recruiter notes"
              htmlFor="hr-notes"
              helperText="Required when requesting a correction."
            >
              <Textarea
                id="hr-notes"
                value={hrNotes}
                onChange={(e) => setHrNotes(e.target.value)}
                placeholder="Add notes about the application…"
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={submitting || !allTasksComplete}
              onClick={handleAdvance}
            >
              <CheckCircle2 className="h-4 w-4" />
              Advance to next stage
            </Button>
            {!allTasksComplete && (
              <p className="text-xs text-atria-text-secondary">
                Complete or waive all candidate tasks before advancing.
              </p>
            )}

            <Button
              variant="secondary"
              size="lg"
              className="w-full border-atria-warning text-atria-warning hover:bg-atria-warning-bg"
              disabled={submitting || !hrNotes.trim()}
              onClick={handleCorrection}
            >
              <RotateCcw className="h-4 w-4" />
              Request a correction
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="w-full border-atria-danger text-atria-danger hover:bg-atria-danger-bg"
              disabled={submitting}
              onClick={() => setConfirmReject(true)}
            >
              <XCircle className="h-4 w-4" />
              Reject application
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmReject}
        title="Reject application"
        message={`Are you sure you want to reject ${candidate.displayName}'s application? This action cannot be undone.`}
        confirmLabel="Reject"
        onConfirm={handleReject}
        onCancel={() => setConfirmReject(false)}
      />
      <HrToast toast={toast} onClose={hide} />
    </div>
  )
}
