import { useUser } from '@clerk/react'
import { useTenant } from '@/app/useTenant'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useState } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ShiftDocumentationForm } from '../components/ShiftDocumentationForm'
import { CalendarDays, ChevronLeft, Clock, MapPin } from 'lucide-react'
import { formatTime, formatWeekdayDate, formatDurationHours, formatStreetAddress } from '@/shared/format'
import { cn } from '@/shared/lib/cn'

export function CaregiverTodayPage() {
  const { clerkOrgId, tenantName } = useTenant()
  const { user } = useUser()
  const firstName = user?.firstName ?? ''

  const data = useQuery(
    api.shiftQueries.listMyShifts,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const [selectedShiftId, setSelectedShiftId] = useState<Id<'shifts'> | null>(
    null,
  )

  const selectedItem = data?.find((item) => item.shift._id === selectedShiftId)

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-base text-atria-muted">Loading shifts…</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-atria-surface-2">
            <CalendarDays className="h-7 w-7 text-atria-text-muted" />
          </div>
          <p className="text-base font-semibold text-atria-ink">No shifts assigned</p>
          <p className="mt-1 text-sm text-atria-text-secondary">
            You have no shifts for today in {tenantName}. Check back later or contact your coordinator.
          </p>
        </div>
      </div>
    )
  }

  const showList = !selectedShiftId
  const showForm = Boolean(selectedItem)

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-atria-ink">
          Good morning, {firstName || 'Caregiver'} 👋
        </h1>
        <p className="text-base text-atria-text-secondary">
          {formatWeekdayDate(new Date())}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`space-y-4 ${showList ? '' : 'hidden lg:block'}`}>
          <p className="text-base font-semibold text-atria-ink">Your visit today</p>
          {data.map(({ shift, client }) => {
            const start = formatTime(shift.scheduledStart)
            const end = formatTime(shift.scheduledEnd)
            const duration = formatDurationHours(shift.scheduledStart, shift.scheduledEnd)
            const address = formatStreetAddress(client?.serviceAddress)
            const noteNotStarted =
              (shift.status === 'scheduled' || shift.status === 'in_progress') &&
              !shift.clockOutAt

            return (
              <div key={shift._id} className="space-y-4">
                <Card
                  className={cn(
                    'cursor-pointer transition-colors',
                    selectedShiftId === shift._id
                      ? 'border-atria-accent'
                      : 'hover:border-atria-border-strong',
                  )}
                  onClick={() => setSelectedShiftId(shift._id)}
                  data-testid={`shift-card-${shift._id}`}
                >
                  <CardContent className="space-y-4 p-5">
                    <StatusBadge status={shift.status} data-testid="shift-status-badge" />

                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-atria-ink">
                        {client?.displayName ?? 'Unknown client'}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-base text-atria-text-secondary">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {start} – {end} {duration && ` · ${duration}`}
                        </span>
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-base text-atria-text-secondary">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{address}</span>
                      </p>
                    </div>

                    {noteNotStarted && (
                      <p className="flex items-center gap-2 text-sm text-atria-warning">
                        <span>⚠</span>
                        Shift notes not started yet
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Button
                  variant="primary"
                  size="lg"
                  className="h-16 w-full rounded-full text-lg"
                  onClick={() => setSelectedShiftId(shift._id)}
                  data-testid="clock-in-start-button"
                >
                  Clock in & start
                  <span className="ml-2">→</span>
                </Button>

                <p className="text-center text-sm text-atria-text-secondary">
                  It only takes a few minutes. We'll guide you step by step.
                </p>

                <p className="text-center text-sm text-atria-text-muted">
                  Need help? Call your coordinator
                </p>
              </div>
            )
          })}
        </div>

        <div className={`lg:col-span-2 ${showForm ? '' : 'hidden lg:block'}`}>
          {selectedItem ? (
            <div className="flex h-svh flex-col gap-3 lg:h-full">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSelectedShiftId(null)}
              >
                <ChevronLeft className="h-4 w-4" />
                Back to shifts
              </Button>
              <div className="min-h-0 flex-1">
                <ShiftDocumentationForm
                  key={selectedItem.shift._id}
                  clerkOrgId={clerkOrgId!}
                  shiftId={selectedItem.shift._id}
                  firstName={firstName}
                  onDone={() => setSelectedShiftId(null)}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({
  status,
  'data-testid': testId,
}: {
  status: string
  'data-testid'?: string
}) {
  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'danger' }> = {
    scheduled: { label: 'UPCOMING', variant: 'info' },
    in_progress: { label: 'IN PROGRESS', variant: 'warning' },
    submitted: { label: 'SUBMITTED', variant: 'info' },
    needs_correction: { label: 'CORRECTION', variant: 'danger' },
    approved: { label: 'APPROVED', variant: 'success' },
    billing_ready: { label: 'BILLING READY', variant: 'success' },
  }
  const config = map[status] ?? { label: status.toUpperCase(), variant: 'default' as const }
  return (
    <Badge variant={config.variant} data-testid={testId}>
      {config.label}
    </Badge>
  )
}
