import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ApplicationReviewPage } from './ApplicationReviewPage'
import { getFunctionName } from 'convex/server'

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123' } }),
  useUser: () => ({ user: { fullName: 'HR Person' } }),
}))

const downloadUrlMock = vi.fn()

const detailResponse = {
  candidate: { _id: 'cand_1', displayName: 'Jane Doe', status: 'applied', email: 'jane@example.com', createdAt: '2026-07-09T10:00:00.000Z' },
  applications: [{ fields: { position: 'Caregiver' }, submittedAt: '2026-07-09T10:00:00.000Z' }],
  tasks: [],
  documents: [
    {
      _id: 'doc_1',
      category: 'Photo ID',
      status: 'active',
      fileName: 'license.png',
      storageId: 'storage-1',
      expiresAt: '2027-12-31',
    },
  ],
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn().mockImplementation((query) => {
    const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
    if (name === 'candidates:getCandidateDetail') return detailResponse
    if (name === 'candidates:listCandidateTasksForHR') return []
    if (name === 'files:getDownloadUrl') {
      downloadUrlMock()
      return 'https://example.com/download/storage-1'
    }
    return undefined
  }),
  useMutation: () => vi.fn(),
}))

vi.mock('../components/HrToast', () => ({
  HrToast: () => null,
}))

describe('ApplicationReviewPage', () => {
  it('shows a Download link for each uploaded document', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
        <Routes>
          <Route path='/hr/candidates/:candidateId' element={<ApplicationReviewPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Photo ID')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Download/i })).toHaveAttribute(
        'href',
        'https://example.com/download/storage-1',
      )
    })

    expect(downloadUrlMock).toHaveBeenCalled()
  })
})
