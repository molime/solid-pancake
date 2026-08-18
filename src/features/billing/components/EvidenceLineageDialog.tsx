import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Badge } from '@/shared/ui/Badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { formatDateUS, formatStatusLabel, formatTime } from '@/shared/format'

/**
 * Auditor-facing evidence lineage for one billing line (docs/07 §5, gap row
 * B7): shift → GPS time punches → progress notes → review events → invoice.
 * Read-only; opened from the billing ledger row ("View evidence").
 */
export function EvidenceLineageDialog({
  billingLineId,
  onClose,
}: {
  billingLineId: Id<'billingLines'> | null
  onClose: () => void
}) {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const evidence = useQuery(
    api.evidence.getShiftEvidence,
    clerkOrgId && billingLineId ? { clerkOrgId, billingLineId } : 'skip',
  )

  return (
    <Dialog open={billingLineId !== null} onClose={onClose} className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Evidence lineage</DialogTitle>
      </DialogHeader>
      <DialogContent className="space-y-5">
        {!evidence ? (
          <p className="text-sm text-atria-muted">Loading evidence…</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-atria-muted">
                {evidence.client?.displayName ?? 'Unknown client'} ·{' '}
                {evidence.caregiverName ?? 'Unknown caregiver'} ·{' '}
                {evidence.shift
                  ? formatDateUS(evidence.shift.scheduledStart)
                  : '—'}
              </p>
              <StatusBadge
                variant={evidence.evidenceComplete ? 'success' : 'warning'}
              >
                {evidence.evidenceComplete
                  ? 'Evidence complete'
                  : 'Evidence incomplete'}
              </StatusBadge>
            </div>

            <EvidenceSection title="Shift">
              {evidence.shift ? (
                <EvidenceLine
                  label={`${formatStatusLabel(evidence.shift.status)} · ${evidence.shift.serviceType}`}
                  value={`${formatDateUS(evidence.shift.scheduledStart)} ${formatTime(evidence.shift.scheduledStart)}–${formatTime(evidence.shift.scheduledEnd)}`}
                />
              ) : (
                <EvidenceLine label="Shift" value="Not found" />
              )}
              {evidence.shift?.clockInAt && (
                <EvidenceLine
                  label="Clock in"
                  value={formatTime(evidence.shift.clockInAt)}
                />
              )}
              {evidence.shift?.clockOutAt && (
                <EvidenceLine
                  label="Clock out"
                  value={formatTime(evidence.shift.clockOutAt)}
                />
              )}
            </EvidenceSection>

            <EvidenceSection title="GPS time punches">
              {evidence.punches.length === 0 ? (
                <EvidenceLine label="Punches" value="None recorded" />
              ) : (
                evidence.punches.map((punch) => (
                  <div
                    key={punch._id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-sm text-atria-text-secondary">
                      {formatStatusLabel(punch.punchType)} ·{' '}
                      {formatTime(punch.at)}
                      {punch.targetLabel ? ` · ${punch.targetLabel}` : ''}
                    </span>
                    {punch.withinGeofence !== undefined && (
                      <Badge
                        variant={punch.withinGeofence ? 'success' : 'warning'}
                      >
                        {punch.withinGeofence
                          ? 'Within geofence'
                          : 'Outside geofence'}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </EvidenceSection>

            <EvidenceSection title="Progress notes">
              {evidence.notes.length === 0 ? (
                <EvidenceLine label="Notes" value="None recorded" />
              ) : (
                evidence.notes.map((note) => (
                  <div key={note._id} className="space-y-1">
                    <p className="text-sm text-atria-text-secondary">
                      {formatTime(note.startTime)}–{formatTime(note.endTime)} ·{' '}
                      {note.servicesProvided}
                    </p>
                    <p className="text-sm text-atria-ink">{note.narrative}</p>
                  </div>
                ))
              )}
            </EvidenceSection>

            <EvidenceSection title="Review events">
              {evidence.reviews.length === 0 ? (
                <EvidenceLine label="Reviews" value="None recorded" />
              ) : (
                evidence.reviews.map((review) => (
                  <div
                    key={review._id}
                    className="flex items-start justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm text-atria-text-secondary">
                        {review.reviewerName} ·{' '}
                        {formatDateUS(review.createdAt)}
                        {review.comment ? ` — ${review.comment}` : ''}
                      </p>
                      {review.complianceOverride && (
                        <p className="text-xs text-atria-warning">
                          Compliance override
                          {review.complianceOverrideReason
                            ? `: ${review.complianceOverrideReason}`
                            : ''}
                        </p>
                      )}
                    </div>
                    <StatusBadge
                      variant={
                        review.decision === 'approved' ? 'success' : 'danger'
                      }
                    >
                      {formatStatusLabel(review.decision)}
                    </StatusBadge>
                  </div>
                ))
              )}
            </EvidenceSection>

            <EvidenceSection title="Billing">
              <EvidenceLine
                label="Line"
                value={`${evidence.line.hours} hrs × $${evidence.line.rate.toFixed(2)} = $${evidence.line.amount.toFixed(2)}`}
              />
              {evidence.line.blockedReason && (
                <EvidenceLine
                  label="Blocked"
                  value={evidence.line.blockedReason}
                />
              )}
              <EvidenceLine
                label="Invoice"
                value={
                  evidence.invoice
                    ? (evidence.invoice.invoiceNumber ?? evidence.invoice.name)
                    : 'Not invoiced'
                }
              />
            </EvidenceSection>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EvidenceSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-atria-muted">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function EvidenceLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-atria-text-secondary">
      <span className="font-medium text-atria-ink">{label}:</span> {value}
    </p>
  )
}
