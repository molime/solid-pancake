import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { getFunctionName } from 'convex/server'

const mocks = {
  generate: vi.fn(),
  updateEntries: vi.fn(),
  submit: vi.fn(),
}

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>(
    'convex/react',
  )
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useConvex: () => ({ query: vi.fn() }),
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  }
})

import { useMutation, useQuery } from 'convex/react'
import { ClientProgressReports } from './ClientProgressReports'

const DUE = {
  clientId: 'client_1',
  clientName: 'Alex Rivera',
  serviceType: 'SLS',
  periodType: 'quarterly',
  lastSubmittedPeriodEnd: null,
  nextDueAt: '2026-04-05',
  dueStatus: 'due_soon',
  suggestedPeriodStart: '2026-01-05',
  suggestedPeriodEnd: '2026-04-04',
}

const DRAFT_REPORT = {
  _id: 'report_1',
  clientId: 'client_1',
  periodType: 'quarterly',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  status: 'draft',
  entries: [
    {
      objectiveId: 'objective_1',
      objectiveTitle: 'Prepare a simple meal',
      servicesSummary: 'Meal prep practice',
      progressSummary: '',
      barriers: '',
      planForward: '',
      hoursDelivered: 6,
    },
  ],
}

const SUBMITTED_REPORT = {
  ...DRAFT_REPORT,
  _id: 'report_2',
  status: 'submitted',
  submittedAt: '2026-04-02T10:00:00.000Z',
  submittedTo: 'sc@rc.example.com',
}

function mockState(reports: unknown[], due: unknown[] = [DUE]) {
  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'progressReports:listProgressReports') {
        return { reports, due }
      }
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(
        mutationRef as Parameters<typeof getFunctionName>[0],
      )
      if (name === 'progressReports:generateProgressReport') return mocks.generate
      if (name === 'progressReports:updateProgressReportEntries')
        return mocks.updateEntries
      if (name === 'progressReports:submitProgressReport') return mocks.submit
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

function renderSection() {
  return render(
    <MemoryRouter>
      <ClientProgressReports
        clerkOrgId="org_123"
        clientId={'client_1' as never}
        serviceType="SLS"
        serviceCoordinatorEmail="sc@rc.example.com"
      />
    </MemoryRouter>,
  )
}

describe('ClientProgressReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the empty state and due badge when there are no reports', () => {
    mockState([])

    renderSection()

    expect(screen.getByText('No progress reports yet')).toBeInTheDocument()
    expect(screen.getByText(/Due 04\/05\/2026/)).toBeInTheDocument()
  })

  it('renders report rows with status badges and per-status actions', () => {
    mockState([DRAFT_REPORT, SUBMITTED_REPORT])

    renderSection()

    expect(screen.getAllByText('01/01/2026 – 03/31/2026')).toHaveLength(2)
    expect(screen.getByText('Draft')).toBeInTheDocument()
    // "Submitted" is both the column header and the status badge.
    expect(screen.getAllByText('Submitted').length).toBeGreaterThan(0)
    expect(screen.getByText(/04\/02\/2026 · sc@rc\.example\.com/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^edit$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^view$/i }),
    ).toBeInTheDocument()
  })

  it('generates a report with the suggested period prefilled', async () => {
    const user = userEvent.setup()
    mockState([])
    mocks.generate.mockResolvedValueOnce('report_1')

    renderSection()

    await user.click(screen.getByRole('button', { name: /generate report/i }))
    // Suggested period prefilled into the US date inputs.
    expect(screen.getByDisplayValue('01/05/2026')).toBeInTheDocument()
    expect(screen.getByDisplayValue('04/04/2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^generate$/i }))

    await waitFor(() => {
      expect(mocks.generate).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        clientId: 'client_1',
        periodType: 'quarterly',
        periodStart: '2026-01-05',
        periodEnd: '2026-04-04',
      })
    })
  })

  it('saves edited entries and keeps computed hours read-only', async () => {
    const user = userEvent.setup()
    mockState([DRAFT_REPORT])
    mocks.updateEntries.mockResolvedValueOnce('report_1')

    renderSection()

    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    expect(screen.getByText('Prepare a simple meal')).toBeInTheDocument()
    expect(screen.getByText('Hours delivered: 6 hrs')).toBeInTheDocument()

    const progressInput = screen.getByLabelText(
      'Progress for Prepare a simple meal',
    )
    await user.type(progressInput, 'Making steady progress')
    await user.click(screen.getByRole('button', { name: /save entries/i }))

    await waitFor(() => {
      expect(mocks.updateEntries).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        reportId: 'report_1',
        entries: [
          {
            objectiveId: 'objective_1',
            servicesSummary: 'Meal prep practice',
            progressSummary: 'Making steady progress',
            barriers: '',
            planForward: '',
          },
        ],
      })
    })
  })

  it('submits a report with the service coordinator prefilled', async () => {
    const user = userEvent.setup()
    mockState([DRAFT_REPORT])
    mocks.submit.mockResolvedValueOnce('report_1')

    renderSection()

    await user.click(screen.getByRole('button', { name: /^submit$/i }))

    expect(screen.getByDisplayValue('sc@rc.example.com')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /submit report/i }))

    await waitFor(() => {
      expect(mocks.submit).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        reportId: 'report_1',
        submittedTo: 'sc@rc.example.com',
      })
    })
  })

  it('shows a read-only view for submitted reports', async () => {
    const user = userEvent.setup()
    mockState([SUBMITTED_REPORT])

    renderSection()

    await user.click(screen.getByRole('button', { name: /^view$/i }))

    expect(screen.getByText(/Submitted 04\/02\/2026/)).toBeInTheDocument()
    expect(screen.getByText('Prepare a simple meal')).toBeInTheDocument()
    expect(screen.getByText('Meal prep practice')).toBeInTheDocument()
    expect(screen.getByText('6 hrs')).toBeInTheDocument()
  })
})
