import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HireConvertPage } from './HireConvertPage'
import { getFunctionName } from 'convex/server'

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123' }, isLoaded: true }),
}))

const detailResponse = {
  candidate: {
    _id: 'cand_1',
    displayName: 'Jane Doe',
    status: 'accepted',
    email: 'jane@example.com',
    createdAt: '2026-07-09T10:00:00.000Z',
  },
  applications: [{ fields: { position: 'Caregiver' }, submittedAt: '2026-07-09T10:00:00.000Z' }],
  tasks: [],
  documents: [],
}

vi.mock('convex/react', () => ({
  useQuery: vi.fn().mockImplementation((query) => {
    const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
    if (name === 'candidates:getCandidateDetail') return detailResponse
    if (name === 'members:listManagers') {
      return [
        { clerkUserId: 'mgr_1', displayName: 'Coordinator Amy' },
        { clerkUserId: 'mgr_2', displayName: 'HR Bob' },
      ]
    }
    if (name === 'members:listCaregivers') {
      return [{ clerkUserId: 'cg_1', displayName: 'Caregiver Charlie' }]
    }
    return undefined
  }),
  useMutation: () => vi.fn(),
}))

vi.mock('../components/HrToast', () => ({
  HrToast: () => null,
}))

describe('HireConvertPage supervisor dropdown', () => {
  it('shows only managers/coordinators/HR, not caregivers', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1/hire']}>
        <Routes>
          <Route path='/hr/candidates/:candidateId/hire' element={<HireConvertPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Convert to Employee — Jane Doe')).toBeInTheDocument()
    })

    const select = screen.getByLabelText(/Supervisor \/ Coordinator/i)
    expect(select).toBeInTheDocument()

    expect(screen.getByText('Coordinator Amy')).toBeInTheDocument()
    expect(screen.getByText('HR Bob')).toBeInTheDocument()
    expect(screen.queryByText('Caregiver Charlie')).not.toBeInTheDocument()
  })
})
