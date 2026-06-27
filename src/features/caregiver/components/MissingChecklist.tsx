import { XCircle, CheckCircle2 } from 'lucide-react'
import type { ShiftGeofence, useCaregiverLocation } from '../hooks/useCaregiverLocation'

type LocationState = ReturnType<typeof useCaregiverLocation>['state']

export function MissingChecklist({
  blockers,
  geofence,
  locationState,
  'data-testid': testId,
}: {
  blockers: string[]
  geofence: ShiftGeofence
  locationState: LocationState
  'data-testid'?: string
}) {
  const locationRequired = geofence.enabled && geofence.enforceClockOut
  const locationReady = !locationRequired || locationState.status === 'granted'
  const locationBlocked =
    locationRequired &&
    (locationState.status === 'denied' ||
      locationState.status === 'unsupported' ||
      locationState.status === 'outside' ||
      locationState.status === 'error')

  if (blockers.length === 0 && locationReady) return null

  return (
    <div className="space-y-2 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4" data-testid={testId}>
      <p className="text-base font-semibold text-atria-ink">What is still missing</p>
      <ul className="space-y-2">
        {blockers.map((blocker) => (
          <li key={blocker} className="flex items-start gap-2 text-sm text-atria-danger">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{blocker}</span>
          </li>
        ))}
        {locationRequired && !locationReady && !locationBlocked && (
          <li className="flex items-start gap-2 text-sm text-atria-text-secondary">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Location needed for clock-out</span>
          </li>
        )}
        {locationBlocked && (
          <li className="flex items-start gap-2 text-sm text-atria-danger">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{locationState.message}</span>
          </li>
        )}
      </ul>
    </div>
  )
}

export function CompleteChecklist({
  'data-testid': testId,
}: {
  'data-testid'?: string
}) {
  return (
    <div className="rounded-[var(--radius-atria-md)] border border-atria-success/30 bg-atria-success-bg p-4" data-testid={testId}>
      <div className="flex items-center gap-2 text-sm text-atria-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Everything looks good. You can clock out.</span>
      </div>
    </div>
  )
}
