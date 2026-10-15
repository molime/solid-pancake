import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { AppLoader } from './AppLoader'

vi.mock('@clerk/react', async () => {
  const actual =
    await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    useClerk: vi.fn(() => ({ signOut: vi.fn(() => Promise.resolve()) })),
  }
})

describe('AppLoader watchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hides the reset escape hatch before the stall threshold', () => {
    render(<AppLoader label="Loading billing workspace" />)
    expect(screen.getByText('Loading billing workspace')).toBeTruthy()
    expect(screen.queryByText(/Sign out/)).toBeNull()

    act(() => {
      vi.advanceTimersByTime(14_999)
    })
    expect(screen.queryByText(/Sign out/)).toBeNull()
  })

  it('offers "Sign out & reset" once the loader stalls', () => {
    render(<AppLoader label="Loading billing workspace" />)

    act(() => {
      vi.advanceTimersByTime(15_000)
    })

    expect(screen.getByText(/Taking longer than expected/)).toBeTruthy()
    expect(screen.getByText(/Sign out/)).toBeTruthy()
  })
})
