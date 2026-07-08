import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ApplicationFormPage } from './pages/ApplicationFormPage'

const mockCandidate = {
  _id: 'candidate-1',
  displayName: 'Sofia Herrera',
  email: 'sofia@atriax.example',
  phone: '555-000-0000',
  dateOfBirth: '',
  homeAddress: '',
  yearsExperience: '1-3',
  application: { fields: {} },
}

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123' }, isLoaded: true }),
  useUser: () => ({ user: { fullName: 'Sofia Herrera', primaryEmailAddress: { emailAddress: 'sofia@atriax.example' } }, isLoaded: true }),
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

    fireEvent.change(screen.getByLabelText(/FULL NAME/i), { target: { value: 'Sofia Herrera' } })
    fireEvent.change(screen.getByLabelText(/PHONE/i), { target: { value: '555-123-4567' } })
    fireEvent.change(document.querySelector("input[type='date']") as Element, { target: { value: '1990-01-15' } })
    fireEvent.change(screen.getByLabelText(/HOME ADDRESS/i), { target: { value: '123 Main St, Austin, TX' } })
    fireEvent.change(screen.getByLabelText(/WORK HISTORY/i), { target: { value: 'Home Health Aide at Golden Care' } })

    fireEvent.click(screen.getByRole('button', { name: /Next: Work History/i }))

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        fields: {
          fullName: 'Sofia Herrera',
          email: 'sofia@atriax.example',
          phone: '555-123-4567',
          position: 'Caregiver',
          yearsExperience: '1-3',
          dob: '1990-01-15',
          address: '123 Main St, Austin, TX',
          workHistory: 'Home Health Aide at Golden Care',
        },
      })
    })
  })
})
