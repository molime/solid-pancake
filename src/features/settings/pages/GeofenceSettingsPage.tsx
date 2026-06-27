import { useOrganization } from '@clerk/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Checkbox } from '@/shared/ui/Checkbox'
import { MapPin } from 'lucide-react'

export function GeofenceSettingsPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const settings = useQuery(
    api.tenantSettings.get,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const update = useMutation(api.tenantSettings.updateShiftGeofence)

  const [draft, setDraft] = useState<Partial<{
    enabled: boolean
    enforceClockIn: boolean
    enforceClockOut: boolean
    defaultRadiusMeters: number
    maxAccuracyMeters: number
  }>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = settings
    ? { ...settings.shiftGeofence, ...draft }
    : {
        enabled: false,
        enforceClockIn: false,
        enforceClockOut: false,
        defaultRadiusMeters: 150,
        maxAccuracyMeters: 100,
      }

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-muted">Loading settings…</div>
      </div>
    )
  }

  const handleSave = async () => {
    if (!clerkOrgId) return
    setIsSaving(true)
    setError(null)
    setMessage(null)

    try {
      await update({
        clerkOrgId,
        ...form,
      })
      setMessage('Geofence settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateToggle = (key: 'enabled' | 'enforceClockIn' | 'enforceClockOut') => {
    setDraft((prev) => ({ ...prev, [key]: !(prev[key] ?? form[key]) }))
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-atria-ink">Settings</h1>
        <p className="text-sm text-atria-muted">Clock-in location rules</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-atria-accent" />
            Clock-in location rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-atria-muted">
            Require caregivers to be near the service location when clocking in
            or out. If no client address coordinates are configured, clock
            punches will be blocked when enforcement is on.
          </p>

          <div className="flex items-start gap-3">
            <Checkbox
              id="enabled"
              checked={form.enabled}
              onChange={() => updateToggle('enabled')}
              data-testid="geofence-enabled-checkbox"
            />
            <div className="space-y-1">
              <label
                htmlFor="enabled"
                className="text-sm font-medium text-atria-ink"
              >
                Enable geofence
              </label>
              <p className="text-xs text-atria-muted">
                Turn location validation on for the agency.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="enforceClockIn"
              checked={form.enforceClockIn}
              onChange={() => updateToggle('enforceClockIn')}
              disabled={!form.enabled}
              data-testid="geofence-enforce-clock-in-checkbox"
            />
            <div className="space-y-1">
              <label
                htmlFor="enforceClockIn"
                className="text-sm font-medium text-atria-ink"
              >
                Enforce on clock-in
              </label>
              <p className="text-xs text-atria-muted">
                Block clock-in when outside the allowed radius.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="enforceClockOut"
              checked={form.enforceClockOut}
              onChange={() => updateToggle('enforceClockOut')}
              disabled={!form.enabled}
              data-testid="geofence-enforce-clock-out-checkbox"
            />
            <div className="space-y-1">
              <label
                htmlFor="enforceClockOut"
                className="text-sm font-medium text-atria-ink"
              >
                Enforce on clock-out
              </label>
              <p className="text-xs text-atria-muted">
                Block clock-out when outside the allowed radius.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                Default radius (meters)
              </label>
              <Input
                type="number"
                value={form.defaultRadiusMeters}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    defaultRadiusMeters: Number(e.target.value),
                  }))
                }
                className="mt-1"
                data-testid="geofence-radius-input"
              />
              <p className="text-xs text-atria-muted mt-1">
                How close a caregiver must be to the service address.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                Max accuracy (meters)
              </label>
              <Input
                type="number"
                value={form.maxAccuracyMeters}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    maxAccuracyMeters: Number(e.target.value),
                  }))
                }
                className="mt-1"
                data-testid="geofence-accuracy-input"
              />
              <p className="text-xs text-atria-muted mt-1">
                Reject GPS readings that are too imprecise.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="save-geofence-button"
          >
            {isSaving ? 'Saving…' : 'Save geofence settings'}
          </Button>

          {error && <p className="text-sm text-atria-danger" data-testid="geofence-error">{error}</p>}
          {message && <p className="text-sm text-atria-success" data-testid="geofence-message">{message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
