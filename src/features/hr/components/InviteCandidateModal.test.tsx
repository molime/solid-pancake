import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteCandidateModal } from './InviteCandidateModal'

const inviteCandidateMock = vi.fn()

vi.mock('@clerk/react', async () => {
  const actual = await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    useOrganization: vi.fn(() => ({
      organization: { id: 'org_123', name: 'Agency' },
    })),
  }
})

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useAction: vi.fn(() => inviteCandidateMock),
  }
})

describe('InviteCandidateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inviteCandidateMock.mockResolvedValue({})
  })

  function renderModal() {
    const onClose = vi.fn()
    const onInvited = vi.fn()
    render(
      <InviteCandidateModal open onClose={onClose} onInvited={onInvited} />,
    )
    return { onClose, onInvited }
  }

  it('shows an email error when email is invalid', async () => {
    const user = userEvent.setup()
    renderModal()

    const nameInput = screen.getByTestId('candidate-name-input')
    const emailInput = screen.getByTestId('candidate-email-input')

    await user.type(nameInput, 'Sofia Herrera')
    await user.type(emailInput, 'not-an-email')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument()
    })
  })

  it('shows a phone error when phone has too few digits', async () => {
    const user = userEvent.setup()
    renderModal()

    const phoneInput = screen.getByTestId('candidate-phone-input')

    await user.type(phoneInput, 'abc')
    await user.tab()

    await waitFor(() => {
      expect(
        screen.getByText('Please enter a valid phone number with at least 10 digits.'),
      ).toBeInTheDocument()
    })
  })

  it('does not call inviteCandidate while fields are invalid', async () => {
    const user = userEvent.setup()
    renderModal()

    const nameInput = screen.getByTestId('candidate-name-input')
    const emailInput = screen.getByTestId('candidate-email-input')

    await user.type(nameInput, 'Sofia Herrera')
    await user.type(emailInput, 'not-an-email')

    const submitButton = screen.getByTestId('send-invitation-button')
    expect(submitButton).toBeDisabled()

    await user.click(submitButton)
    expect(inviteCandidateMock).not.toHaveBeenCalled()
  })

  it('shows required field errors when name and email are blank', async () => {
    const user = userEvent.setup()
    renderModal()

    const nameInput = screen.getByTestId('candidate-name-input')
    const emailInput = screen.getByTestId('candidate-email-input')

    await user.click(nameInput)
    await user.tab()
    await user.click(emailInput)
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Name is required.')).toBeInTheDocument()
      expect(screen.getByText('Email is required.')).toBeInTheDocument()
    })

    const submitButton = screen.getByTestId('send-invitation-button')
    expect(submitButton).toBeDisabled()
    expect(inviteCandidateMock).not.toHaveBeenCalled()
  })

  it('calls inviteCandidate with valid fields', async () => {
    const user = userEvent.setup()
    renderModal()

    const nameInput = screen.getByTestId('candidate-name-input')
    const emailInput = screen.getByTestId('candidate-email-input')
    const phoneInput = screen.getByTestId('candidate-phone-input')

    await user.type(nameInput, 'Sofia Herrera')
    await user.type(emailInput, 'sofia@example.com')
    await user.type(phoneInput, '+1 (555) 123-4567')

    const submitButton = screen.getByTestId('send-invitation-button')
    expect(submitButton).not.toBeDisabled()

    await user.click(submitButton)

    await waitFor(() => {
      expect(inviteCandidateMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        displayName: 'Sofia Herrera',
        email: 'sofia@example.com',
        phone: '+1 (555) 123-4567',
        manualSetup: false,
      })
    })
  })
})
