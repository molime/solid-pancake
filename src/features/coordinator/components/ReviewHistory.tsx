import { cn } from '@/shared/lib/cn'
import { Check, AlertTriangle, Clock } from 'lucide-react'

export interface ReviewHistoryItem {
  _id: string
  createdAt: string
  decision: 'approved' | 'correction_requested'
  comment: string
}

export function ReviewHistory({
  reviews,
  submittedAt,
  submittedBy,
  shiftStatus,
  verified,
}: {
  reviews: ReviewHistoryItem[]
  submittedAt?: string
  submittedBy?: string
  shiftStatus?: string
  verified?: boolean
}) {
  const events: Array<{
    id: string
    icon: React.ReactNode
    iconClass: string
    title: string
    subtitle: string
  }> = []

  if (submittedAt) {
    events.push({
      id: 'submitted',
      icon: <Check className="h-3.5 w-3.5" />,
      iconClass: 'bg-atria-success text-atria-on-accent',
      title: `Note submitted${submittedBy ? ` by ${submittedBy}` : ''}`,
      subtitle: formatHistoryWhen(submittedAt),
    })
    if (verified) {
      events.push({
        id: 'verified',
        icon: <Check className="h-3.5 w-3.5" />,
        iconClass: 'bg-atria-success text-atria-on-accent',
        title: 'Accuracy confirmed · location verified',
        subtitle: formatHistoryWhen(submittedAt),
      })
    }
  }

  if (shiftStatus === 'submitted') {
    events.push({
      id: 'waiting',
      icon: <Clock className="h-3.5 w-3.5" />,
      iconClass: 'bg-atria-warning text-atria-bg',
      title: 'Waiting for your review',
      subtitle: 'You · now',
    })
  }

  for (const review of reviews) {
    const isApproved = review.decision === 'approved'
    events.push({
      id: review._id,
      icon: isApproved ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" />
      ),
      iconClass: isApproved
        ? 'bg-atria-success text-atria-on-accent'
        : 'bg-atria-danger text-white',
      title: isApproved ? 'Approved' : 'Correction requested',
      subtitle: `${formatHistoryWhen(review.createdAt)}${review.comment ? ` · ${review.comment}` : ''}`,
    })
  }

  if (events.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-atria-ink">History</h3>
      <div className="space-y-4">
        {events.map((event, index) => (
          <div key={event.id} className="flex gap-3">
            <div className="relative flex flex-col items-center">
              <div
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  event.iconClass,
                )}
              >
                {event.icon}
              </div>
              {index < events.length - 1 && (
                <div className="mt-1 h-full min-h-[24px] w-px bg-atria-border" />
              )}
            </div>
            <div className="pb-1">
              <p className="text-sm font-medium text-atria-ink">{event.title}</p>
              <p className="text-xs text-atria-muted">{event.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatHistoryWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  if (isToday) return `Today · ${time}`
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return `${datePart} · ${time}`
}
