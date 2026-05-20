import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useState } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { ShiftDocumentationForm } from '../components/ShiftDocumentationForm'
import { CalendarDays } from 'lucide-react'

export function CaregiverTodayPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const shifts = useQuery(
    api.shiftQueries.listMyShifts,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const [selectedShiftId, setSelectedShiftId] = useState<Id<'shifts'> | null>(
    null,
  )

  const selectedShift = shifts?.find((s) => s._id === selectedShiftId)

  if (!shifts) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-muted">Loading shifts…</div>
      </div>
    )
  }

  if (shifts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-atria-border/50 mb-3">
            <CalendarDays className="h-6 w-6 text-atria-muted" />
          </div>
          <p className="text-sm font-medium text-atria-ink">No shifts assigned</p>
          <p className="text-xs text-atria-muted mt-1">
            You have no shifts for today in {organization?.name}. Check back later or contact your coordinator.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-atria-ink">My Shifts</h1>
        <p className="text-sm text-atria-muted">
          Complete documentation for your assigned shifts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
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
                  <StatusBadge status={shift.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selectedShift ? (
            <ShiftDocumentationForm
              key={selectedShift._id}
              clerkOrgId={clerkOrgId!}
              shiftId={selectedShift._id}
            />
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent>
                <p className="text-sm text-atria-muted">
                  Select a shift to view documentation details
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'danger' }> = {
    scheduled: { label: 'Scheduled', variant: 'default' },
    in_progress: { label: 'In Progress', variant: 'warning' },
    submitted: { label: 'Submitted', variant: 'info' },
    needs_correction: { label: 'Correction', variant: 'danger' },
    approved: { label: 'Approved', variant: 'success' },
    billing_ready: { label: 'Billing Ready', variant: 'success' },
  }
  const config = map[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
