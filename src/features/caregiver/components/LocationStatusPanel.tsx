import { MapPin, MapPinOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import type { useCaregiverLocation } from '../hooks/useCaregiverLocation'

type LocationState = ReturnType<typeof useCaregiverLocation>['state']

export function LocationStatusPanel({
  state,
  'data-testid': testId,
}: {
  state: LocationState
  'data-testid'?: string
}) {
  const sharedProps = { 'data-testid': testId, 'data-location-status': state.status }

  if (state.status === 'idle') {
    return (
      <Card className="border-atria-border bg-atria-surface-2" {...sharedProps}>
        <div className="flex items-center gap-3 p-4">
          <MapPin className="h-5 w-5 text-atria-text-muted" />
          <p className="text-sm text-atria-text-secondary">
            Location will be checked when you tap Clock In.
          </p>
        </div>
      </Card>
    )
  }

  if (state.status === 'checking') {
    return (
      <Card className="border-atria-info/30 bg-atria-info-bg" {...sharedProps}>
        <div className="flex items-center gap-3 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-atria-info" />
          <p className="text-sm text-atria-info">Checking your location…</p>
        </div>
      </Card>
    )
  }

  if (state.status === 'granted') {
    return (
      <Card className="border-atria-success/30 bg-atria-success-bg" {...sharedProps}>
        <div className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-atria-success" />
          <div className="text-sm text-atria-success">
            <p>Location available</p>
            <p className="text-xs opacity-90">
              Accuracy: {Math.round(state.location.accuracyMeters)}m
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const isBlocked =
    state.status === 'denied' ||
    state.status === 'unsupported' ||
    state.status === 'outside'
  const icon = isBlocked ? (
    <MapPinOff className="h-5 w-5 text-atria-danger" />
  ) : (
    <AlertCircle className="h-5 w-5 text-atria-warning" />
  )
  const toneClass = isBlocked
    ? 'border-atria-danger/30 bg-atria-danger-bg'
    : 'border-atria-warning/30 bg-atria-warning-bg'
  const textClass = isBlocked ? 'text-atria-danger' : 'text-atria-warning'

  return (
    <Card className={toneClass} {...sharedProps}>
      <div className="flex items-start gap-3 p-4">
        {icon}
        <p className={`text-sm ${textClass}`}>{state.message}</p>
      </div>
    </Card>
  )
}
