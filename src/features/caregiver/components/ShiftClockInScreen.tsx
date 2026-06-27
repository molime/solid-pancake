import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { LocationStatusPanel } from './LocationStatusPanel'
import type { ShiftGeofence, useCaregiverLocation } from '../hooks/useCaregiverLocation'
import { formatTime, formatDurationHours } from '@/shared/format'

type LocationState = ReturnType<typeof useCaregiverLocation>['state']

export function ShiftClockInScreen({
  scheduledStart,
  scheduledEnd,
  clientName,
  address,
  geofence,
  locationState,
  isLoading,
  onClockIn,
}: {
  scheduledStart: string
  scheduledEnd: string
  clientName: string
  address: string
  geofence: ShiftGeofence
  locationState: LocationState
  isLoading: boolean
  onClockIn: () => void
}) {
  const [currentTime, setCurrentTime] = useState(() => formatTime(new Date().toISOString()))

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(formatTime(new Date().toISOString()))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const duration = formatDurationHours(scheduledStart, scheduledEnd)
  const start = formatTime(scheduledStart)
  const end = formatTime(scheduledEnd)

  const locationBlocked =
    geofence.enabled &&
    geofence.enforceClockIn &&
    (locationState.status === 'denied' ||
      locationState.status === 'unsupported' ||
      locationState.status === 'outside')

  return (
    <div className="space-y-3" data-testid="shift-clock-in-screen">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-atria-ink">Clock in</h2>
        <p className="text-base text-atria-text-secondary">
          Start your shift to begin your notes.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-lg font-semibold text-atria-ink">{clientName}</p>
            <p className="text-base text-atria-text-secondary">
              🕐 {start} – {end} {duration && ` · ${duration}`}
            </p>
          </div>
          <div className="flex items-start gap-2 text-base text-atria-text-secondary">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{address}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-atria-success/30 bg-atria-success-bg">
        <CardContent className="space-y-1 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-atria-success">
            Current time
          </p>
          <p className="text-5xl font-semibold text-atria-success">{currentTime}</p>
        </CardContent>
      </Card>

      {geofence.enabled && geofence.enforceClockIn && (
        <LocationStatusPanel state={locationState} data-testid="clock-in-location-panel" />
      )}

      <Button
        variant="primary"
        size="lg"
        className="h-16 w-full rounded-full text-lg"
        onClick={onClockIn}
        disabled={isLoading || locationBlocked}
        data-testid="clock-in-button"
      >
        {isLoading ? 'Clocking in…' : 'Clock in now'}
        {!isLoading && <span className="ml-2">→</span>}
      </Button>

      <p className="text-center text-sm text-atria-text-secondary">
        Your start time is sent to ADP for payroll. You can begin your shift notes right after clocking in.
      </p>

      <p className="text-center text-sm text-atria-text-muted">
        Need help? Call your coordinator
      </p>
    </div>
  )
}
