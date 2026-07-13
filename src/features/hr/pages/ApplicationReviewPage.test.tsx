import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ApplicationReviewPage } from './ApplicationReviewPage'
import { getFunctionName } from 'convex/server'

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123' } }),
  useUser: () => ({ user: { fullName: 'HR Person' } }),
}))

const reviewApplicationMock = vi.fn()
const sendOfferMock = vi.fn()
const downloadUrlMock = vi.fn()

function createDetailResponse(options?: {
  status?: string
  tasks?: unknown[]
  documents?: unknown[]
}) {
  const status = options?.status ?? 'applied'
  return {
    candidate: {
      _id: 'cand_1',
      displayName: 'Jane Doe',
      status,
      email: 'jane@example.com',
      createdAt: '2026-07-09T10:00:00.000Z',
    },
    applications: [
      {
        fields: {
          position: 'Caregiver',
          payRate: '$22.00 / hr',
          startDate: '2026-08-01',
          schedule: 'Flexible',
          supervisor: 'Coordinator',
          offerExpiresAt: '2026-08-15',
        },
        submittedAt: '2026-07-09T10:00:00.000Z',
      },
    ],
    tasks: options?.tasks ?? [],
    documents: options?.documents ?? [
      {
        _id: 'doc_1',
        category: 'photo_id',
        status: 'active',
        fileName: 'license.png',
        storageId: 'storage-1',
        expiresAt: '2027-12-31',
      },
    ],
  }
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn().mockImplementation((query) => {
    const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
    if (name === 'candidates:getCandidateDetail') return createDetailResponse()
    if (name === 'candidates:listCandidateTasksForHR') return []
    if (name === 'files:getDownloadUrl') {
      downloadUrlMock()
      return 'https://example.com/download/storage-1'
    }
    return undefined
  }),
  useMutation: vi.fn().mockImplementation((mutation) => {
    const name = getFunctionName(mutation as Parameters<typeof getFunctionName>[0])
    if (name === 'candidates:reviewApplication') return reviewApplicationMock
    if (name === 'candidates:sendOffer') return sendOfferMock
    return vi.fn()
  }),
}))

vi.mock('../components/HrToast', () => ({
  HrToast: () => null,
}))

describe('ApplicationReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reviewApplicationMock.mockResolvedValue(undefined)
    sendOfferMock.mockResolvedValue(undefined)
  })

  it('shows a Download link for each uploaded document', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
        <Routes>
          <Route
            path='/hr/candidates/:candidateId'
            element={<ApplicationReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Photo identification')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Download/i })).toHaveAttribute(
        'href',
        'https://example.com/download/storage-1',
      )
    })

    expect(downloadUrlMock).toHaveBeenCalled()
  })

  it('renders combined approve and send offer button for applied status', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
        <Routes>
          <Route
            path='/hr/candidates/:candidateId'
            element={<ApplicationReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(
        screen.getByTestId('approve-and-send-offer-button'),
      ).toHaveTextContent('Approve application & send offer')
    })
  })

  it('disables approve and send offer button when tasks are incomplete', async () => {
    const { useQuery } = await import('convex/react')
    vi.mocked(useQuery).mockImplementation(
      ((query: unknown) => {
        const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
        if (name === 'candidates:getCandidateDetail') {
          return createDetailResponse({
            tasks: [{ _id: 'task_1', status: 'pending', title: 'Background check' }],
          })
        }
        if (name === 'candidates:listCandidateTasksForHR') {
          return [{ _id: 'task_1', status: 'pending', title: 'Background check' }]
        }
        if (name === 'files:getDownloadUrl') {
          downloadUrlMock()
          return 'https://example.com/download/storage-1'
        }
        return undefined
      }) as unknown as typeof useQuery,
    )

    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
        <Routes>
          <Route
            path='/hr/candidates/:candidateId'
            element={<ApplicationReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('approve-and-send-offer-button')).toBeDisabled()
    })
  })

  it('calls reviewApplication then sendOffer when approve and send offer is clicked', async () => {
    const user = userEvent.setup()

    const { useQuery } = await import('convex/react')
    vi.mocked(useQuery).mockImplementation(
      ((query: unknown) => {
        const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
        if (name === 'candidates:getCandidateDetail') {
          return createDetailResponse({
            tasks: [{ _id: 'task_1', status: 'complete', title: 'Background check' }],
          })
        }
        if (name === 'candidates:listCandidateTasksForHR') {
          return [{ _id: 'task_1', status: 'complete', title: 'Background check' }]
        }
        if (name === 'files:getDownloadUrl') {
          downloadUrlMock()
          return 'https://example.com/download/storage-1'
        }
        return undefined
      }) as unknown as typeof useQuery,
    )

    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
        <Routes>
          <Route
            path='/hr/candidates/:candidateId'
            element={<ApplicationReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    const button = await waitFor(() =>
      screen.getByTestId('approve-and-send-offer-button'),
    )
    expect(button).not.toBeDisabled()
    await user.click(button)

    await waitFor(() => {
      expect(reviewApplicationMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        candidateId: 'cand_1',
        decision: 'approved',
      })
    })

    await waitFor(() => {
      expect(sendOfferMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        candidateId: 'cand_1',
        payRate: '$22.00 / hr',
        startDate: '2026-08-01',
        schedule: 'Flexible',
        supervisor: 'Coordinator',
        expiresAt: '2026-08-15',
      })
    })

    expect(reviewApplicationMock.mock.invocationCallOrder[0]).toBeLessThan(
      sendOfferMock.mock.invocationCallOrder[0],
    )
  })
})
