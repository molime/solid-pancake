import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ApplicationFormPage } from './pages/ApplicationFormPage'

const mockCandidate = {
  _id: 'candidate-1',
  displayName: 'Sofia Herrera',
  email: 'sofia@atriax.example',
  dateOfBirth: '',
  homeAddress: '',
  yearsExperience: '1–2 years',
}

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123' }, isLoaded: true }),
  useUser: () => ({ user: { fullName: 'Sofia Herrera' }, isLoaded: true }),
}))

const submitMock = vi.fn().mockResolvedValue('candidate-1')

vi.mock('convex/react', () => ({
  useQuery: () => mockCandidate,
  useMutation: () => submitMock,
}))

describe('ApplicationFormPage', () => {
  it('submits correctly with Figma fields', async () => {
    render(
      <MemoryRouter>
        <ApplicationFormPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Your Application')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Sofia Herrera'), { target: { value: 'Sofia Herrera' } })
    fireEvent.change(screen.getByPlaceholderText('MM/DD/YYYY'), { target: { value: '01/15/1990' } })
    fireEvent.change(screen.getByPlaceholderText('123 Main St, Los Angeles, CA'), { target: { value: '123 Main St, Austin, TX' } })

    fireEvent.click(screen.getByRole('button', { name: /Next: Work History/i }))

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        fields: {
          fullName: 'Sofia Herrera',
          dateOfBirth: '01/15/1990',
          homeAddress: '123 Main St, Austin, TX',
          yearsExperience: '1–2 years',
        },
      })
    })
  })
})
