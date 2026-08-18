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

const convexQuery = vi.fn()

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>(
    'convex/react',
  )
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useConvex: () => ({ query: convexQuery }),
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  }
})

import { useQuery } from 'convex/react'

function functionName(ref: unknown) {
  return getFunctionName(ref as Parameters<typeof getFunctionName>[0])
}

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    agency: { name: 'Agency', ein: '12-3456789', address: '123 Main St' },
    branches: ['SLS'],
    personnel: { compliant: 3, expiring: 0, expired: 0, blocked: 0, total: 3 },
    gaps: [
      {
        clerkUserId: 'user_cg',
        displayName: 'Caregiver One',
        missing: [],
        expired: [],
        overridden: [],
        overriddenCategories: [],
      },
    ],
    backgroundChecks: { clear: 2, pending: 0, consider: 0, other: 0, total: 2 },
    training: { completed: 2, pending: 0, expiring: 0, total: 2 },
    documentation: { total: 10, withNotes: 10, withoutNotes: 0 },
    blockedBillingLines: 0,
    evidence: { complete: 2, total: 2 },
    auditEvents: { total: 12, last30Days: 5 },
    ...overrides,
  }
}

const TIMELINESS_CLEAR = {
  windowDays: 90,
  total: 1,
  verbalOnTime: 1,
  verbalBreached: 0,
  verbalPending: 0,
  writtenOnTime: 1,
  writtenBreached: 0,
  writtenPending: 0,
}

const SUMMARY_CLEAR = {
  clients: 1,
  overdue: 0,
  dueSoon: 0,
  onTrack: 1,
  noBaseline: 0,
  submittedReports: 1,
  draftReports: 0,
}

const RETENTION = {
  windowDays: 90,
  recordTypes: [
    {
      key: 'documentArchiveItems',
      label: 'Archived documents',
      total: 4,
      expiringSoon: 1,
      legalHold: 1,
    },
    {
      key: 'specialIncidents',
      label: 'Special incident reports',
      total: 2,
      expiringSoon: 0,
      legalHold: 0,
    },
    {
      key: 'progressReports',
      label: 'Progress reports',
      total: 1,
      expiringSoon: 0,
      legalHold: 0,
    },
  ],
}

function makeObligations(now = Date.now()) {
  return [
    {
      _id: 'ob_gl',
      key: 'insurance_general_liability',
      label: 'General liability insurance certificate',
      cadenceMonths: 12,
      dueAt: new Date(now + 100 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now).toISOString(),
    },
    {
      _id: 'ob_wc',
      key: 'insurance_workers_comp',
      label: "Workers' compensation insurance certificate",
      cadenceMonths: 12,
      dueAt: new Date(now + 100 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now).toISOString(),
    },
    {
      _id: 'ob_ds1891',
      key: 'ds1891_disclosure',
      label: 'DS 1891 applicant/vendor disclosure statement',
      cadenceMonths: 24,
      dueAt: new Date(now + 300 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now).toISOString(),
    },
  ]
}

type MockState = {
  report?: ReturnType<typeof makeReport>
  timeliness?: typeof TIMELINESS_CLEAR
  summary?: typeof SUMMARY_CLEAR
  obligations?: ReturnType<typeof makeObligations>
  retention?: typeof RETENTION
}

function mockState(state: MockState) {
  vi.mocked(useQuery).mockImplementation(((queryRef: unknown) => {
    const name = functionName(queryRef)
    if (name === 'auditReadiness:getReport') return state.report
    if (name === 'incidents:getIncidentTimeliness') return state.timeliness
    if (name === 'auditReadiness:getAnnualEvaluation') return undefined
    if (name === 'agencyObligations:listObligations') return state.obligations
    if (name === 'progressReports:getProgressReportSummary') {
      return state.summary
    }
    if (name === 'documentArchive:getRetentionReport') return state.retention
    return undefined
  }) as unknown as typeof useQuery)
}

// Imported lazily inside the tests so the convex/react mock is in place.
let AuditReadinessPageUnderTest: (typeof import('./AuditReadinessPage'))['AuditReadinessPage']

function renderPage() {
  return render(
    <MemoryRouter>
      <AuditReadinessPageUnderTest />
    </MemoryRouter>,
  )
}

describe('AuditReadinessPage — five pillars', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./AuditReadinessPage')
    AuditReadinessPageUnderTest = module.AuditReadinessPage
  })

  it('renders all five pillar sections with deep links', () => {
    mockState({
      report: makeReport(),
      timeliness: TIMELINESS_CLEAR,
      summary: SUMMARY_CLEAR,
      obligations: makeObligations(),
      retention: RETENTION,
    })

    renderPage()

    for (const pillar of [
      'Service Delivery & Billing',
      'Personnel',
      'Incidents & Rights',
      'Program Integrity',
      'Agency & Vendor File',
    ]) {
      expect(screen.getByText(pillar)).toBeInTheDocument()
    }
    const links = screen.getAllByRole('link', { name: /view details/i })
    const hrefs = links.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/billing')
    expect(hrefs).toContain('/compliance')
    expect(hrefs).toContain('/incidents')
    expect(hrefs).toContain('/clients')
    expect(screen.getByText('2 of 2 billing lines evidence-complete'))
  })

  it('flags the incidents pillar when a SIR deadline is breached', () => {
    mockState({
      report: makeReport(),
      timeliness: { ...TIMELINESS_CLEAR, writtenBreached: 1 },
      summary: SUMMARY_CLEAR,
      obligations: makeObligations(),
      retention: RETENTION,
    })

    renderPage()

    const pillar = screen
      .getByText('Incidents & Rights')
      .closest('div[class*="rounded"]')
    expect(pillar?.textContent).toContain('Action Needed')
  })

  it('renders the retention card counts', () => {
    mockState({
      report: makeReport(),
      timeliness: TIMELINESS_CLEAR,
      summary: SUMMARY_CLEAR,
      obligations: makeObligations(),
      retention: RETENTION,
    })

    renderPage()

    expect(
      screen.getByText('Record retention (17 CCR §54326(a)(3))'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Archived documents:/).textContent).toContain(
      '1 approaching expiry',
    )
    expect(screen.getByText(/Archived documents:/).textContent).toContain(
      '1 under legal hold',
    )
  })

  it('checklist reflects live data — met and unmet items', () => {
    mockState({
      report: makeReport({
        personnel: {
          compliant: 2,
          expiring: 0,
          expired: 1,
          blocked: 1,
          total: 3,
        },
        gaps: [
          {
            clerkUserId: 'user_cg',
            displayName: 'Caregiver One',
            missing: [],
            expired: ['CPR certificate'],
            overridden: [],
            overriddenCategories: [],
          },
        ],
      }),
      timeliness: TIMELINESS_CLEAR,
      summary: SUMMARY_CLEAR,
      obligations: makeObligations(),
      retention: RETENTION,
    })

    renderPage()

    expect(
      screen.getByText('Regional center vendor-file review'),
    ).toBeInTheDocument()

    const expiredRow = screen
      .getByText('No expired caregiver credentials')
      .closest('li')
    expect(expiredRow?.textContent).toContain('Review')

    const ds1891Row = screen
      .getByText('DS 1891 disclosure current (2-year cycle)')
      .closest('li')
    expect(ds1891Row?.textContent).toContain('Met')
  })

  it('marks the DS 1891 checklist item unmet when the obligation is overdue', () => {
    const obligations = makeObligations()
    obligations[2] = {
      ...obligations[2]!,
      dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    }
    mockState({
      report: makeReport(),
      timeliness: TIMELINESS_CLEAR,
      summary: SUMMARY_CLEAR,
      obligations,
      retention: RETENTION,
    })

    renderPage()

    const ds1891Row = screen
      .getByText('DS 1891 disclosure current (2-year cycle)')
      .closest('li')
    expect(ds1891Row?.textContent).toContain('Review')
  })

  it('downloads the audit packet for the selected date range', async () => {
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
    convexQuery.mockResolvedValue('"csv"')
    mockState({
      report: makeReport(),
      timeliness: TIMELINESS_CLEAR,
      summary: SUMMARY_CLEAR,
      obligations: makeObligations(),
      retention: RETENTION,
    })

    renderPage()

    fireEvent.click(
      screen.getByRole('button', { name: /download audit packet/i }),
    )

    await waitFor(() => expect(convexQuery).toHaveBeenCalled())
    const [ref, args] = convexQuery.mock.calls[0] as [unknown, unknown]
    expect(functionName(ref)).toBe('auditPacket:exportPacketCsv')
    expect(args).toMatchObject({ clerkOrgId: 'org_123' })
    expect((args as { startDate: string }).startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
