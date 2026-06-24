export interface LatLng {
  latitude: number
  longitude: number
}

export interface LocationInput extends LatLng {
  accuracyMeters: number
}

export interface LocationEvidence extends LocationInput {
  distanceMeters?: number
  targetLabel?: string
  targetLatitude?: number
  targetLongitude?: number
  withinGeofence?: boolean
}

export interface ServiceTarget extends LatLng {
  label: string
  radiusMeters: number
}

const EARTH_RADIUS_METERS = 6_371_000

export function haversineDistanceMeters(from: LatLng, to: LatLng): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const deltaLatitude = toRadians(to.latitude - from.latitude)
  const deltaLongitude = toRadians(to.longitude - from.longitude)

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

export function resolveShiftServiceTarget(
  shift: {
    serviceLocationOverride?: {
      label: string
      latitude: number
      longitude: number
      radiusMeters?: number
    } | null
  },
  client: {
    serviceAddress?: {
      latitude?: number
      longitude?: number
      line1?: string
    } | null
  },
  settings: { defaultRadiusMeters: number },
): ServiceTarget | null {
  if (shift.serviceLocationOverride) {
    return {
      latitude: shift.serviceLocationOverride.latitude,
      longitude: shift.serviceLocationOverride.longitude,
      label: shift.serviceLocationOverride.label,
      radiusMeters:
        shift.serviceLocationOverride.radiusMeters ??
        settings.defaultRadiusMeters,
    }
  }

  if (
    client.serviceAddress?.latitude !== undefined &&
    client.serviceAddress?.longitude !== undefined
  ) {
    return {
      latitude: client.serviceAddress.latitude,
      longitude: client.serviceAddress.longitude,
      label: client.serviceAddress.line1 ?? 'Client service address',
      radiusMeters: settings.defaultRadiusMeters,
    }
  }

  return null
}

function assertValidCoordinate(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Invalid location: latitude must be between -90 and 90.')
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Invalid location: longitude must be between -180 and 180.')
  }
}

export function validatePunchLocation({
  location,
  target,
  required,
  maxAccuracyMeters,
}: {
  location?: LocationInput | null
  target: ServiceTarget | null
  required: boolean
  maxAccuracyMeters: number
}): LocationEvidence | undefined {
  if (!location) {
    if (required) {
      throw new Error(
        'Location is required for this punch because geofence enforcement is enabled.',
      )
    }

    return undefined
  }

  assertValidCoordinate(location.latitude, location.longitude)

  if (!Number.isFinite(location.accuracyMeters) || location.accuracyMeters <= 0) {
    throw new Error('Invalid location: accuracyMeters must be a positive number.')
  }

  if (required && location.accuracyMeters > maxAccuracyMeters) {
    throw new Error(
      `Location accuracy (${location.accuracyMeters.toFixed(1)}m) exceeds the agency limit of ${maxAccuracyMeters}m. Please move to an area with better GPS signal and try again.`,
    )
  }

  if (!target) {
    if (required) {
      throw new Error(
        'No service location coordinates are configured for this shift. Contact your coordinator before clocking in/out.',
      )
    }

    return {
      ...location,
      withinGeofence: undefined,
      targetLabel: undefined,
      targetLatitude: undefined,
      targetLongitude: undefined,
      distanceMeters: undefined,
    }
  }

  if (!Number.isFinite(target.radiusMeters) || target.radiusMeters <= 0) {
    throw new Error('Invalid geofence radius: radiusMeters must be positive.')
  }

  const distanceMeters = haversineDistanceMeters(location, target)
  const withinGeofence = distanceMeters <= target.radiusMeters

  if (required && !withinGeofence) {
    throw new Error(
      `You are ${Math.round(distanceMeters)}m from the service location (${target.label}) and outside the allowed ${Math.round(target.radiusMeters)}m radius. Move closer and try again.`,
    )
  }

  return {
    ...location,
    distanceMeters,
    targetLabel: target.label,
    targetLatitude: target.latitude,
    targetLongitude: target.longitude,
    withinGeofence,
  }
}
