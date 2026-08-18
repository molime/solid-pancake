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

import { useQuery, useMutation } from 'convex/react'

type QueryState = {
  requirements?: unknown[]
  obligations?: unknown[]
  archiveItems?: unknown[]
  memberRole?: string
}

function functionName(ref: unknown) {
  return getFunctionName(ref as Parameters<typeof getFunctionName>[0])
}

const DAY_MS = 24 * 60 * 60 * 1000

function mockState(state: QueryState, mutations: Record<string, unknown> = {}) {
  vi.mocked(useQuery).mockImplementation(((queryRef: unknown) => {
    const name = functionName(queryRef)
    if (name === 'compliance:getComplianceOverview') {
      return { compliant: 0, expiring: 0, expired: 0, blocked: 0, total: 0 }
    }
    if (name === 'compliance:listComplianceItems') return []
    if (name === 'compliance:complianceGaps') return []
    if (name === 'members:me') {
      return { role: state.memberRole ?? 'org:admin' }
    }
    if (name === 'compliance:listCredentialRequirements') {
      return state.requirements ?? []
    }
    if (name === 'agencyObligations:listObligations') {
      return state.obligations ?? []
    }
    if (name === 'documentArchive:listDocumentArchive') {
      return state.archiveItems ?? []
    }
    return undefined
  }) as unknown as typeof useQuery)

  vi.mocked(useMutation).mockImplementation(((mutationRef: unknown) => {
    const name = functionName(mutationRef)
    return mutations[name] ?? vi.fn()
  }) as unknown as typeof useMutation)
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ComplianceOverviewPageUnderTest />
    </MemoryRouter>,
  )
}

// Imported lazily inside the tests so the convex/react mock is in place.
let ComplianceOverviewPageUnderTest: (typeof import('./ComplianceOverviewPage'))['ComplianceOverviewPage']

describe('ComplianceOverviewPage — credential pack', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./ComplianceOverviewPage')
    ComplianceOverviewPageUnderTest = module.ComplianceOverviewPage
  })

  it('offers the CA pack to admins when no caregiver requirements exist', async () => {
    const applyPack = vi.fn().mockResolvedValue({
      status: 'applied',
      message: 'Applied the CA ILS/SLS credential pack: 10 requirements created.',
      counts: { created: 10, skipped: 0 },
    })
    mockState(
      { requirements: [] },
      { 'credentialPacks:applyCredentialPack': applyPack },
    )

    renderPage()

    const button = screen.getByRole('button', {
      name: /apply ca ils\/sls credential pack/i,
    })
    fireEvent.click(button)

    await waitFor(() =>
      expect(applyPack).toHaveBeenCalledWith({ clerkOrgId: 'org_123' }),
    )
    expect(
      await screen.findByText(/10 requirements created/i),
    ).toBeInTheDocument()
  })

  it('hides the pack card once caregiver requirements exist', () => {
    mockState({
      requirements: [
        {
          _id: 'req_1',
          role: 'org:caregiver',
          category: 'live_scan',
          label: 'Live Scan background clearance',
          isRequired: true,
        },
      ],
    })

    renderPage()

    expect(
      screen.queryByRole('button', {
        name: /apply ca ils\/sls credential pack/i,
      }),
    ).not.toBeInTheDocument()
  })

  it('hides the pack card from non-admin roles', () => {
    mockState({ requirements: [], memberRole: 'org:coordinator' })

    renderPage()

    expect(
      screen.queryByRole('button', {
        name: /apply ca ils\/sls credential pack/i,
      }),
    ).not.toBeInTheDocument()
  })
})

describe('ComplianceOverviewPage — agency obligations', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('./ComplianceOverviewPage')
    ComplianceOverviewPageUnderTest = module.ComplianceOverviewPage
  })

  it('renders obligations with client-computed status badges', () => {
    const now = Date.now()
    mockState({
      requirements: [{ _id: 'req_1', role: 'org:caregiver' }],
      obligations: [
        {
          _id: 'obl_ok',
          key: 'ds1891_disclosure',
          label: 'DS 1891 applicant/vendor disclosure statement',
          cadenceMonths: 24,
          dueAt: new Date(now + 200 * DAY_MS).toISOString(),
          createdAt: new Date(now).toISOString(),
        },
        {
          _id: 'obl_soon',
          key: 'insurance_general_liability',
          label: 'General liability insurance certificate',
          cadenceMonths: 12,
          dueAt: new Date(now + 10 * DAY_MS).toISOString(),
          createdAt: new Date(now).toISOString(),
        },
        {
          _id: 'obl_overdue',
          key: 'cpa_audit_or_review',
          label: 'Independent CPA audit or review (WIC §4652.5)',
          cadenceMonths: 12,
          dueAt: new Date(now - 5 * DAY_MS).toISOString(),
          createdAt: new Date(now).toISOString(),
        },
      ],
    })

    renderPage()

    expect(
      screen.getByText('DS 1891 applicant/vendor disclosure statement'),
    ).toBeInTheDocument()
    expect(screen.getByText('On track')).toBeInTheDocument()
    expect(screen.getByText('Due soon')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
  })

  it('offers seeding to admins when no obligations exist', async () => {
    const seed = vi.fn().mockResolvedValue({
      status: 'seeded',
      message: 'Seeded 9 standard CA obligations.',
      counts: { created: 9, skipped: 0 },
    })
    mockState(
      { requirements: [{ _id: 'req_1', role: 'org:caregiver' }], obligations: [] },
      { 'agencyObligations:seedObligations': seed },
    )

    renderPage()

    const button = screen.getByRole('button', {
      name: /seed standard ca obligations/i,
    })
    fireEvent.click(button)

    await waitFor(() =>
      expect(seed).toHaveBeenCalledWith({ clerkOrgId: 'org_123' }),
    )
    expect(
      await screen.findByText(/Seeded 9 standard CA obligations/i),
    ).toBeInTheDocument()
  })

  it('opens the complete dialog and submits with notes only', async () => {
    const complete = vi.fn().mockResolvedValue('obl_ok')
    const now = Date.now()
    mockState(
      {
        requirements: [{ _id: 'req_1', role: 'org:caregiver' }],
        obligations: [
          {
            _id: 'obl_ok',
            key: 'ds1891_disclosure',
            label: 'DS 1891 applicant/vendor disclosure statement',
            cadenceMonths: 24,
            dueAt: new Date(now + 200 * DAY_MS).toISOString(),
            createdAt: new Date(now).toISOString(),
          },
        ],
      },
      { 'agencyObligations:completeObligation': complete },
    )

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /^complete$/i }))
    fireEvent.change(
      screen.getByPlaceholderText(/renewal details/i),
      { target: { value: 'Filed with the regional center.' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /mark complete/i }))

    await waitFor(() =>
      expect(complete).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        obligationId: 'obl_ok',
        notes: 'Filed with the regional center.',
      }),
    )
  })

  it('pre-populates existing evidence and notes in the complete dialog', () => {
    const now = Date.now()
    mockState({
      requirements: [{ _id: 'req_1', role: 'org:caregiver' }],
      obligations: [
        {
          _id: 'obl_with_evidence',
          key: 'insurance_general_liability',
          label: 'General liability insurance certificate',
          cadenceMonths: 12,
          dueAt: new Date(now + 200 * DAY_MS).toISOString(),
          createdAt: new Date(now).toISOString(),
          evidenceItemId: 'evidence_1',
          notes: 'Previously renewed.',
        },
      ],
      archiveItems: [
        {
          _id: 'evidence_1',
          category: 'insurance_general_liability',
          file: { fileName: 'coi-2026.pdf' },
        },
      ],
    })

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /^complete$/i }))

    // The select should have the existing evidence pre-selected.
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('evidence_1')

    // The notes textarea should have the existing notes pre-filled.
    const textarea = screen.getByPlaceholderText(/renewal details/i)
    expect(textarea).toHaveValue('Previously renewed.')
  })

  it('submits with selected evidence', async () => {
    const complete = vi.fn().mockResolvedValue('obl_ok')
    const now = Date.now()
    mockState(
      {
        requirements: [{ _id: 'req_1', role: 'org:caregiver' }],
        obligations: [
          {
            _id: 'obl_ok',
            key: 'ds1891_disclosure',
            label: 'DS 1891 applicant/vendor disclosure statement',
            cadenceMonths: 24,
            dueAt: new Date(now + 200 * DAY_MS).toISOString(),
            createdAt: new Date(now).toISOString(),
          },
        ],
        archiveItems: [
          {
            _id: 'evidence_1',
            category: 'insurance_general_liability',
            file: { fileName: 'coi-2026.pdf' },
          },
        ],
      },
      { 'agencyObligations:completeObligation': complete },
    )

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /^complete$/i }))
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'evidence_1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /mark complete/i }))

    await waitFor(() =>
      expect(complete).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        obligationId: 'obl_ok',
        evidenceItemId: 'evidence_1',
      }),
    )
  })

  it('hides the complete button from coordinators', () => {
    const now = Date.now()
    mockState({
      requirements: [{ _id: 'req_1', role: 'org:caregiver' }],
      obligations: [
        {
          _id: 'obl_ok',
          key: 'ds1891_disclosure',
          label: 'DS 1891 applicant/vendor disclosure statement',
          cadenceMonths: 24,
          dueAt: new Date(now + 200 * DAY_MS).toISOString(),
          createdAt: new Date(now).toISOString(),
        },
      ],
      memberRole: 'org:coordinator',
    })

    renderPage()

    expect(
      screen.queryByRole('button', { name: /^complete$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('DS 1891 applicant/vendor disclosure statement'),
    ).toBeInTheDocument()
  })
})
