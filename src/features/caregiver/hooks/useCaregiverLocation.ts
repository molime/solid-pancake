import { useCallback, useRef, useState } from 'react'

export type BrowserLocation = {
  latitude: number
  longitude: number
  accuracyMeters: number
}

type LocationState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'granted'; location: BrowserLocation }
  | { status: 'denied'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'error'; message: string }
  | { status: 'outside'; message: string }

export type ShiftGeofence = {
  enabled: boolean
  enforceClockIn: boolean
  enforceClockOut: boolean
}

function isLocationRequired(
  geofence: ShiftGeofence | undefined,
  punchType: 'clock_in' | 'clock_out',
) {
  if (!geofence?.enabled) return false
  return punchType === 'clock_in'
    ? geofence.enforceClockIn
    : geofence.enforceClockOut
}

function parsePosition(position: GeolocationPosition): BrowserLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
  }
}

export function useCaregiverLocation() {
  const [state, setState] = useState<LocationState>({ status: 'idle' })
  const pendingRef = useRef<Promise<BrowserLocation | undefined> | null>(null)

  const requestLocation = useCallback(
    async (options?: {
      geofence?: ShiftGeofence
      punchType?: 'clock_in' | 'clock_out'
    }): Promise<BrowserLocation | undefined> => {
      const punchType = options?.punchType ?? 'clock_in'
      const required = isLocationRequired(options?.geofence, punchType)

      if (!required) {
        setState({ status: 'idle' })
        return undefined
      }

      if (!navigator.geolocation) {
        const message =
          'Your browser does not support location services. Contact your coordinator.'
        setState({ status: 'unsupported', message })
        return undefined
      }

      setState({ status: 'checking' })

      const promise = new Promise<BrowserLocation | undefined>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = parsePosition(position)
            setState({ status: 'granted', location })
            resolve(location)
          },
          (error) => {
            let message = 'Unable to read your location. Please try again.'
            if (error.code === error.PERMISSION_DENIED) {
              message =
                'Location access was denied. Enable location permissions in your browser settings to clock in.'
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              message =
                'Location is temporarily unavailable. Move to an area with better GPS signal and try again.'
            } else if (error.code === error.TIMEOUT) {
              message = 'Location request timed out. Please try again.'
            }
            const denied = error.code === error.PERMISSION_DENIED
            setState({ status: denied ? 'denied' : 'error', message })
            resolve(undefined)
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        )
      })

      pendingRef.current = promise
      return promise
    },
    [],
  )

  const setOutsideError = useCallback((message: string) => {
    setState({ status: 'outside', message })
  }, [])

  const clearLocationError = useCallback(() => {
    setState({ status: 'idle' })
  }, [])

  return {
    state,
    requestLocation,
    setOutsideError,
    clearLocationError,
  }
}
