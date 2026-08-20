import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getFunctionName } from 'convex/server'

vi.mock('@clerk/react', async () => {
  const actual = await vi.importActual<typeof import('@clerk/react')>(
    '@clerk/react',
  )
  return {
    ...actual,
    useOrganization: vi.fn(() => ({
      organization: { id: 'org_123', name: 'Agency' },
    })),
  }
})

const createIncident = vi.fn()

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>(
    'convex/react',
  )
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useConvex: () => ({ query: vi.fn() }),
    useQuery: vi.fn(),
    useMutation: vi.fn(() => createIncident),
  }
})

import { useQuery } from 'convex/react'

const CLIENT_OPTIONS = [
  { clientId: 'client_1', displayName: 'Alex Rivera' },
  { clientId: 'client_2', displayName: 'Sam Lee' },
]

function mockState(role: string) {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      if (typeof queryRef !== 'object' || queryRef === null) return undefined
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'members:me') return { role }
      if (name === 'incidents:listIncidentClientOptions') return CLIENT_OPTIONS
      return undefined
    }) as unknown as typeof useQuery,
  )
}

// Imported lazily inside the tests so the convex/react mock is in place.
let IncidentFormPageUnderTest: (typeof import('./IncidentFormPage'))['IncidentFormPage']

function renderPage() {
  return render(
    <MemoryRouter>
      <IncidentFormPageUnderTest />
    </MemoryRouter>,
  )
}

function clickNext() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
}

/** Walks the wizard from step 0 through the review screen. */
function walkWizard(container: HTMLElement) {
  fireEvent.change(screen.getByLabelText('Who was involved?'), {
    target: { value: 'client_1' },
  })
  fireEvent.change(screen.getByLabelText('What kind of incident?'), {
    target: { value: 'medication_error' },
  })
  clickNext()

  fireEvent.change(
    screen.getByPlaceholderText('Tell us what happened, in your own words'),
    { target: { value: 'Gave the morning dose twice.' } },
  )
  fireEvent.change(screen.getByPlaceholderText('Where the incident occurred'), {
    target: { value: 'Client home' },
  })
  clickNext()

  const dateInputs = screen.getAllByPlaceholderText('mm/dd/yyyy')
  fireEvent.change(dateInputs[0]!, { target: { value: '08102026' } })
  const timeInputs = container.querySelectorAll('input[type="time"]')
  fireEvent.change(timeInputs[0]!, { target: { value: '08:30' } })
  clickNext()

  // "Was anyone hurt?" — all fields optional.
  clickNext()

  fireEvent.change(
    screen.getByPlaceholderText('Immediate actions taken by staff'),
    { target: { value: 'Called poison control and monitored the client.' } },
  )
  clickNext()

  // "Who did you call?" — optional.
  clickNext()
}

describe('IncidentFormPage wizard', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    createIncident.mockResolvedValue('incident_new')
    const module = await import('./IncidentFormPage')
    IncidentFormPageUnderTest = module.IncidentFormPage
  })

  it('gates each step on its own required fields', () => {
    mockState('org:coordinator')
    renderPage()

    // Step 0: nothing selected yet.
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Who was involved?'), {
      target: { value: 'client_1' },
    })
    // Still missing the category.
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('What kind of incident?'), {
      target: { value: 'medication_error' },
    })
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('walks one question per screen and files the incident', async () => {
    mockState('org:coordinator')
    const { container } = renderPage()

    walkWizard(container)

    // Review step summarizes the answers before filing.
    expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThan(0)
    expect(screen.getByText('Gave the morning dose twice.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'File incident' }))

    await waitFor(() => expect(createIncident).toHaveBeenCalledTimes(1))
    const payload = createIncident.mock.calls[0]![0] as Record<string, unknown>
    expect(payload).toMatchObject({
      clerkOrgId: 'org_123',
      clientId: 'client_1',
      category: 'medication_error',
      location: 'Client home',
      description: 'Gave the morning dose twice.',
      actionsTaken: 'Called poison control and monitored the client.',
      agenciesNotified: [],
    })
    expect(payload.occurredAt).toBe(new Date('2026-08-10T08:30').toISOString())
    // "Found out" is prefilled to now, so learnedAt is always set.
    expect(typeof payload.learnedAt).toBe('string')
  })

  it('shows the confirmation instead of navigating for caregivers', async () => {
    mockState('org:caregiver')
    const { container } = renderPage()

    walkWizard(container)
    fireEvent.click(screen.getByRole('button', { name: 'File incident' }))

    await waitFor(() =>
      expect(screen.getByText(/Incident filed/)).toBeInTheDocument(),
    )
    // The wizard resets to the first step for the next report.
    expect(screen.getByLabelText('Who was involved?')).toBeInTheDocument()
  })
})
