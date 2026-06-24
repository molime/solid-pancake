import { describe, expect, it } from 'vitest'
import {
  haversineDistanceMeters,
  resolveShiftServiceTarget,
  validatePunchLocation,
} from './locationValidation'

describe('haversineDistanceMeters', () => {
  it('returns roughly 0 for the same point', () => {
    const point = { latitude: 44.9778, longitude: -93.265 }
    expect(haversineDistanceMeters(point, point)).toBeCloseTo(0, 0)
  })

  it('returns a sensible distance between two known points', () => {
    // Minneapolis to St. Paul is roughly 17 km.
    const minneapolis = { latitude: 44.9778, longitude: -93.265 }
    const stPaul = { latitude: 44.9537, longitude: -93.09 }
    const distance = haversineDistanceMeters(minneapolis, stPaul)
    expect(distance).toBeGreaterThan(10_000)
    expect(distance).toBeLessThan(20_000)
  })
})

describe('resolveShiftServiceTarget', () => {
  const settings = { defaultRadiusMeters: 100 }

  it('prefers the shift service-location override over client address', () => {
    const target = resolveShiftServiceTarget(
      {
        serviceLocationOverride: {
          label: 'Override park',
          latitude: 45,
          longitude: -93,
          radiusMeters: 50,
        },
      },
      {
        serviceAddress: {
          line1: 'Client home',
          latitude: 46,
          longitude: -94,
        },
      },
      settings,
    )

    expect(target).toEqual({
      label: 'Override park',
      latitude: 45,
      longitude: -93,
      radiusMeters: 50,
    })
  })

  it('falls back to the client service address', () => {
    const target = resolveShiftServiceTarget(
      {},
      {
        serviceAddress: {
          line1: 'Client home',
          latitude: 46,
          longitude: -94,
        },
      },
      settings,
    )

    expect(target).toEqual({
      label: 'Client home',
      latitude: 46,
      longitude: -94,
      radiusMeters: 100,
    })
  })

  it('uses the default radius when the override omits one', () => {
    const target = resolveShiftServiceTarget(
      {
        serviceLocationOverride: {
          label: 'Override park',
          latitude: 45,
          longitude: -93,
        },
      },
      {},
      settings,
    )

    expect(target?.radiusMeters).toBe(100)
  })

  it('returns null when no coordinates are configured', () => {
    const target = resolveShiftServiceTarget(
      {},
      { serviceAddress: { line1: 'No coords' } },
      settings,
    )

    expect(target).toBeNull()
  })
})

describe('validatePunchLocation', () => {
  const serviceTarget = {
    label: 'Client home',
    latitude: 44.9778,
    longitude: -93.265,
    radiusMeters: 100,
  }

  it('allows a location inside the radius and stores evidence', () => {
    const inside = {
      latitude: 44.9779,
      longitude: -93.2649,
      accuracyMeters: 10,
    }

    const evidence = validatePunchLocation({
      location: inside,
      target: serviceTarget,
      required: true,
      maxAccuracyMeters: 50,
    })

    expect(evidence).toMatchObject({
      latitude: 44.9779,
      longitude: -93.2649,
      accuracyMeters: 10,
      targetLabel: 'Client home',
      targetLatitude: 44.9778,
      targetLongitude: -93.265,
      withinGeofence: true,
    })
    expect(evidence?.distanceMeters).toBeGreaterThan(0)
    expect(evidence?.distanceMeters).toBeLessThan(100)
  })

  it('rejects a location outside the radius when required', () => {
    const outside = {
      latitude: 45.05,
      longitude: -93.1,
      accuracyMeters: 10,
    }

    expect(() =>
      validatePunchLocation({
        location: outside,
        target: serviceTarget,
        required: true,
        maxAccuracyMeters: 50,
      }),
    ).toThrow(/outside the allowed/)
  })

  it('records outside status when not required', () => {
    const outside = {
      latitude: 45.05,
      longitude: -93.1,
      accuracyMeters: 10,
    }

    const evidence = validatePunchLocation({
      location: outside,
      target: serviceTarget,
      required: false,
      maxAccuracyMeters: 50,
    })

    expect(evidence?.withinGeofence).toBe(false)
  })

  it('rejects missing location when required', () => {
    expect(() =>
      validatePunchLocation({
        location: undefined,
        target: serviceTarget,
        required: true,
        maxAccuracyMeters: 50,
      }),
    ).toThrow('Location is required')
  })

  it('allows missing location when not required', () => {
    const evidence = validatePunchLocation({
      location: undefined,
      target: serviceTarget,
      required: false,
      maxAccuracyMeters: 50,
    })

    expect(evidence).toBeUndefined()
  })

  it('rejects accuracy above the agency limit when enforcement is required', () => {
    const poorAccuracy = {
      latitude: 44.9778,
      longitude: -93.265,
      accuracyMeters: 100,
    }

    expect(() =>
      validatePunchLocation({
        location: poorAccuracy,
        target: serviceTarget,
        required: true,
        maxAccuracyMeters: 50,
      }),
    ).toThrow(/exceeds the agency limit/)
  })

  it('allows poor accuracy when geofence enforcement is not required', () => {
    const poorAccuracy = {
      latitude: 44.9778,
      longitude: -93.265,
      accuracyMeters: 100,
    }

    const evidence = validatePunchLocation({
      location: poorAccuracy,
      target: serviceTarget,
      required: false,
      maxAccuracyMeters: 50,
    })

    expect(evidence).toMatchObject({
      latitude: 44.9778,
      longitude: -93.265,
      accuracyMeters: 100,
      targetLabel: 'Client home',
    })
  })

  it('allows poor accuracy with no target when enforcement is not required', () => {
    const poorAccuracy = {
      latitude: 44.9778,
      longitude: -93.265,
      accuracyMeters: 100,
    }

    const evidence = validatePunchLocation({
      location: poorAccuracy,
      target: null,
      required: false,
      maxAccuracyMeters: 50,
    })

    expect(evidence).toMatchObject({
      latitude: 44.9778,
      longitude: -93.265,
      accuracyMeters: 100,
      withinGeofence: undefined,
      distanceMeters: undefined,
    })
  })

  it('rejects invalid coordinates', () => {
    expect(() =>
      validatePunchLocation({
        location: { latitude: 91, longitude: 0, accuracyMeters: 10 },
        target: serviceTarget,
        required: false,
        maxAccuracyMeters: 50,
      }),
    ).toThrow('latitude must be between')

    expect(() =>
      validatePunchLocation({
        location: { latitude: 0, longitude: 181, accuracyMeters: 10 },
        target: serviceTarget,
        required: false,
        maxAccuracyMeters: 50,
      }),
    ).toThrow('longitude must be between')
  })

  it('rejects when required and no target is configured', () => {
    expect(() =>
      validatePunchLocation({
        location: { latitude: 44.9778, longitude: -93.265, accuracyMeters: 10 },
        target: null,
        required: true,
        maxAccuracyMeters: 50,
      }),
    ).toThrow('No service location coordinates are configured')
  })
})
