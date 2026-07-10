import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ApplicationFormPage } from './pages/ApplicationFormPage'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123' }, isLoaded: true }),
  useUser: () => ({
    user: {
      fullName: 'Sofia Herrera',
      primaryEmailAddress: { emailAddress: 'sofia@atriax.example' },
    },
    isLoaded: true,
  }),
}))

const submitMock = vi.fn().mockResolvedValue('candidate-1')

vi.mock('convex/react', () => ({
  useQuery: () => ({
    displayName: 'Sofia Herrera',
    email: 'sofia@atriax.example',
    phone: '555-000-0000',
  }),
  useMutation: () => submitMock,
}))

describe('ApplicationFormPage', () => {
  it('submits the Figma entry form with fullName, email, phone, and position', async () => {
    render(
      <MemoryRouter>
        <ApplicationFormPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Start your application 👋')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/FULL NAME/i), {
      target: { value: 'Sofia Herrera' },
    })
    fireEvent.change(screen.getByLabelText(/EMAIL ADDRESS/i), {
      target: { value: 'sofia@atriax.example' },
    })
    fireEvent.change(screen.getByLabelText(/PHONE NUMBER/i), {
      target: { value: '555-123-4567' },
    })
    fireEvent.change(screen.getByLabelText(/POSITION APPLYING FOR/i), {
      target: { value: 'CNA' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Submit application/i }))

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        fields: {
          fullName: 'Sofia Herrera',
          email: 'sofia@atriax.example',
          phone: '555-123-4567',
          position: 'CNA',
        },
      })
    })

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/onboarding/status', { replace: true })
    })
  })
})
