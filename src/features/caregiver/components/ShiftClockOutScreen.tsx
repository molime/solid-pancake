import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { LocationStatusPanel } from './LocationStatusPanel'
import { MissingChecklist, CompleteChecklist } from './MissingChecklist'
import type { ShiftGeofence, useCaregiverLocation } from '../hooks/useCaregiverLocation'
import { formatTime } from '@/shared/format'

type LocationState = ReturnType<typeof useCaregiverLocation>['state']

export function ShiftClockOutScreen({
  scheduledStart,
  clientName,
  actualClockInAt,
  actualClockOutAt,
  blockers,
  geofence,
  locationState,
  isLoading,
  onClockOut,
}: {
  scheduledStart: string
  clientName: string
  actualClockInAt?: string | null
  actualClockOutAt?: string | null
  blockers: string[]
  geofence: ShiftGeofence
  locationState: LocationState
  isLoading: boolean
  onClockOut: () => void
}) {
  const [currentTime, setCurrentTime] = useState(() => formatTime(new Date().toISOString()))

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(formatTime(new Date().toISOString()))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const locationRequired = geofence.enabled && geofence.enforceClockOut
  const locationReady = !locationRequired || locationState.status === 'granted'
  const canSubmit = blockers.length === 0 && locationReady && !isLoading

  const clockInTime = actualClockInAt ? formatTime(actualClockInAt) : formatTime(scheduledStart)
  const clockOutTime = actualClockOutAt
    ? formatTime(actualClockOutAt)
    : currentTime

  return (
    <div className="space-y-3" data-testid="shift-clock-out-screen">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-atria-ink">Clock out</h2>
        <p className="text-base text-atria-text-secondary">
          Your shift notes are complete. You can clock out now.
        </p>
      </div>

      <Badge variant="success" className="h-8 px-3 text-sm">
        ✓ Shift note done
      </Badge>

      <Card className="border-atria-success/30 bg-atria-success-bg">
        <CardContent className="space-y-1 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-atria-success">
            Current time
          </p>
          <p className="text-5xl font-semibold text-atria-success">{currentTime}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-atria-text-muted">
            Shift summary
          </p>
          <div className="flex items-start gap-2 text-base text-atria-ink">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-atria-text-muted" />
            <span>
              {clientName} · {clockInTime} – {clockOutTime}
            </span>
          </div>
        </CardContent>
      </Card>

      {locationRequired && <LocationStatusPanel state={locationState} data-testid="clock-out-location-panel" />}

      {canSubmit ? <CompleteChecklist data-testid="complete-checklist" /> : (
        <MissingChecklist
          blockers={blockers}
          geofence={geofence}
          locationState={locationState}
          data-testid="missing-checklist"
        />
      )}

      <Button
        variant="primary"
        size="lg"
        className="h-16 w-full rounded-full text-lg"
        onClick={onClockOut}
        disabled={!canSubmit}
        data-testid="clock-out-button"
      >
        {isLoading ? 'Submitting…' : 'Clock out now'}
        {!isLoading && <span className="ml-2">→</span>}
      </Button>

      <p className="text-center text-sm text-atria-text-secondary">
        Your end time is sent to ADP for payroll. Your shift note stays in ATRIA-X for your coordinator to review.
      </p>

      <p className="text-center text-sm text-atria-text-muted">
        Need help? Call your coordinator
      </p>
    </div>
  )
}
