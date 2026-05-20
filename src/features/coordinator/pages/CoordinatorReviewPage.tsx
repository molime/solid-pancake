import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useState } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { ReviewDetail } from '../components/ReviewDetail'
import { ClipboardCheck } from 'lucide-react'

export function CoordinatorReviewPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const shifts = useQuery(
    api.shiftQueries.listForReview,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const [selectedShiftId, setSelectedShiftId] = useState<Id<'shifts'> | null>(
    null,
  )

  const activeSelectedShiftId =
    selectedShiftId && shifts?.some((shift) => shift._id === selectedShiftId)
      ? selectedShiftId
      : null

  if (!shifts) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-muted">Loading review queue…</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-atria-ink">Review Queue</h1>
        <p className="text-sm text-atria-muted">
          {shifts.length} shift{shifts.length !== 1 ? 's' : ''} awaiting review
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className="lg:col-span-1 overflow-y-auto space-y-2 pr-1">
          {shifts.map((shift) => (
            <Card
              key={shift._id}
              className={`cursor-pointer transition-colors ${
                selectedShiftId === shift._id
                  ? 'border-atria-accent'
                  : 'hover:border-atria-border'
              }`}
              onClick={() => setSelectedShiftId(shift._id)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-atria-ink">
                      {shift.scheduledStart.slice(0, 10)}
                    </p>
                    <p className="text-xs text-atria-muted">
                      {shift.scheduledStart.slice(11, 16)} –{' '}
                      {shift.scheduledEnd.slice(11, 16)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      shift.status === 'needs_correction' ? 'danger' : 'info'
                    }
                  >
                    {shift.status === 'needs_correction'
                      ? 'Correction'
                      : 'Submitted'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}

          {shifts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-atria-border/50 mb-3">
                <ClipboardCheck className="h-6 w-6 text-atria-muted" />
              </div>
              <p className="text-sm font-medium text-atria-ink">Review queue is clear</p>
              <p className="text-xs text-atria-muted mt-1 max-w-xs">
                All submitted shifts have been reviewed. New submissions will appear here.
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 overflow-y-auto">
          {activeSelectedShiftId && clerkOrgId ? (
            <ReviewDetail
              clerkOrgId={clerkOrgId}
              onDecisionComplete={() => setSelectedShiftId(null)}
              shiftId={activeSelectedShiftId}
            />
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent>
                <p className="text-sm text-atria-muted">
                  Select a shift to review documentation
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
