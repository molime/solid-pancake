import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EmploymentAgreementPage } from './EmploymentAgreementPage'

const navigateMock = vi.fn()
const acknowledgeMock = vi.fn().mockResolvedValue(undefined)

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123' }, isLoaded: true }),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => acknowledgeMock,
  useQuery: () => undefined,
}))

describe('EmploymentAgreementPage', () => {
  it('requires all agreements before continuing', async () => {
    render(
      <MemoryRouter>
        <EmploymentAgreementPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Employment agreements')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Confirm and continue/i }))
    expect(acknowledgeMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox', { name: /same legal validity as a handwritten signature/i }))

    const docs = ['Employee Contract', 'Employee Rights', 'HIPAA', 'Abuse']
    for (const doc of docs) {
      fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(doc, 'i') }))
    }

    const initialsInputs = screen.getAllByLabelText(/^INITIALS/i)
    const dateInputs = screen.getAllByLabelText(/Date/i)
    for (let i = 0; i < docs.length; i++) {
      fireEvent.change(initialsInputs[i], { target: { value: 'SH' } })
      fireEvent.change(dateInputs[i], { target: { value: '2026-01-15' } })
    }

    fireEvent.click(screen.getByRole('button', { name: /Confirm and continue/i }))

    await waitFor(() => {
      expect(acknowledgeMock).toHaveBeenCalledWith({ clerkOrgId: 'org_123' })
    })

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/onboarding', { replace: true })
    })
  })
})
