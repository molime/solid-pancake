import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCaregiverLocation } from './useCaregiverLocation'

const mockGetCurrentPosition = vi.fn()

describe('useCaregiverLocation', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns idle when geofence is disabled', async () => {
    const { result } = renderHook(() => useCaregiverLocation())
    const location = await act(async () =>
      result.current.requestLocation({ geofence: { enabled: false, enforceClockIn: false, enforceClockOut: false } }),
    )
    expect(location).toBeUndefined()
    expect(result.current.state.status).toBe('idle')
    expect(mockGetCurrentPosition).not.toHaveBeenCalled()
  })

  it('requests location when geofence is enabled for clock-in', async () => {
    const { result } = renderHook(() => useCaregiverLocation())
    mockGetCurrentPosition.mockImplementation((success: (p: GeolocationPosition) => void) =>
      success({ coords: { latitude: 44.98, longitude: -93.26, accuracy: 10 } } as GeolocationPosition),
    )

    await act(async () => {
      result.current.requestLocation({
        geofence: { enabled: true, enforceClockIn: true, enforceClockOut: false },
        punchType: 'clock_in',
      })
    })

    await waitFor(() => expect(result.current.state.status).toBe('granted'))
    expect(mockGetCurrentPosition).toHaveBeenCalledOnce()
  })

  it('shows denied state when permission is denied', async () => {
    const { result } = renderHook(() => useCaregiverLocation())
    mockGetCurrentPosition.mockImplementation((_: unknown, error: (e: GeolocationPositionError) => void) =>
      error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
    )

    await act(async () => {
      result.current.requestLocation({
        geofence: { enabled: true, enforceClockIn: true, enforceClockOut: false },
        punchType: 'clock_in',
      })
    })

    await waitFor(() => expect(result.current.state.status).toBe('denied'))
    expect('message' in result.current.state ? result.current.state.message : '').toContain('denied')
  })

  it('shows outside error from server rejection', () => {
    const { result } = renderHook(() => useCaregiverLocation())
    act(() => result.current.setOutsideError('You are 500m outside the allowed radius.'))
    expect(result.current.state.status).toBe('outside')
    expect('message' in result.current.state ? result.current.state.message : '').toContain('500m')
  })

  it('does not request location when enforcement is disabled for the punch type', async () => {
    const { result } = renderHook(() => useCaregiverLocation())
    await act(async () => {
      result.current.requestLocation({
        geofence: { enabled: true, enforceClockIn: false, enforceClockOut: false },
        punchType: 'clock_in',
      })
    })
    expect(mockGetCurrentPosition).not.toHaveBeenCalled()
  })
})
