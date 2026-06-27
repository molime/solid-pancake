import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShiftClockOutScreen } from './ShiftClockOutScreen'

describe('ShiftClockOutScreen', () => {
  it('disables clock-out when note is incomplete', () => {
    render(
      <ShiftClockOutScreen
        scheduledStart="2026-06-25T08:00:00Z"
        clientName="Client A"
        blockers={['Narrative is required.']}
        geofence={{ enabled: false, enforceClockIn: false, enforceClockOut: false }}
        locationState={{ status: 'idle' }}
        isLoading={false}
        onClockOut={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /Clock out now/i })).toBeDisabled()
    expect(screen.getByText(/Narrative is required/i)).toBeInTheDocument()
  })

  it('enables clock-out when note is complete and geofence is disabled', () => {
    render(
      <ShiftClockOutScreen
        scheduledStart="2026-06-25T08:00:00Z"
        clientName="Client A"
        blockers={[]}
        geofence={{ enabled: false, enforceClockIn: false, enforceClockOut: false }}
        locationState={{ status: 'idle' }}
        isLoading={false}
        onClockOut={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /Clock out now/i })).toBeEnabled()
  })

  it('requires location when geofence enforcement is enabled for clock-out', () => {
    render(
      <ShiftClockOutScreen
        scheduledStart="2026-06-25T08:00:00Z"
        clientName="Client A"
        blockers={[]}
        geofence={{ enabled: true, enforceClockIn: false, enforceClockOut: true }}
        locationState={{ status: 'idle' }}
        isLoading={false}
        onClockOut={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /Clock out now/i })).toBeDisabled()
    expect(screen.getByText(/Location needed for clock-out/i)).toBeInTheDocument()
  })

  it('does not require location when an existing clock-out punch is reused', () => {
    render(
      <ShiftClockOutScreen
        scheduledStart="2026-06-25T08:00:00Z"
        clientName="Client A"
        actualClockOutAt="2026-06-25T16:00:00Z"
        blockers={[]}
        geofence={{ enabled: true, enforceClockIn: false, enforceClockOut: true }}
        locationState={{ status: 'idle' }}
        isLoading={false}
        onClockOut={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /Clock out now/i })).toBeEnabled()
    expect(screen.queryByText(/Location needed for clock-out/i)).not.toBeInTheDocument()
  })
})
