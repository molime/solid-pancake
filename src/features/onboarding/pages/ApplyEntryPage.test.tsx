import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getFunctionName } from 'convex/server'
import { ApplyEntryPage } from './ApplyEntryPage'

const applyPublicMock = vi.fn().mockResolvedValue({
  magicLink: 'https://example.com/magic',
  initialPassword: 'temp-pass-123',
  alreadyApplied: false,
})

const updateClerkPasswordMock = vi.fn().mockResolvedValue(undefined)

let agencyInfo: unknown = undefined

vi.mock('convex/react', () => ({
  useQuery: (query: unknown) => {
    const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
    if (name === 'agencyConfig:getPublicAgencyInfo') return agencyInfo
    return undefined
  },
  useAction: (action: unknown) => {
    const name = getFunctionName(action as Parameters<typeof getFunctionName>[0])
    if (name === 'candidates:updateClerkPassword') return updateClerkPasswordMock
    return applyPublicMock
  },
}))

vi.mock('@clerk/react', () => ({
  useClerk: () => ({ signOut: vi.fn() }),
}))

const twoBranchAgency = {
  clerkOrgId: 'org_1',
  name: 'Test Agency',
  address: null,
  branches: [
    { _id: 'branch_ils', label: 'ILS Branch', branchType: 'ILS' },
    { _id: 'branch_sls', label: 'SLS Branch', branchType: 'SLS' },
  ],
}

const singleBranchAgency = {
  clerkOrgId: 'org_1',
  name: 'Test Agency',
  address: null,
  branches: [{ _id: 'branch_sls', label: 'SLS Branch', branchType: 'SLS' }],
}

function renderApplyPage() {
  return render(
    <MemoryRouter initialEntries={['/apply?agency=test-agency']}>
      <ApplyEntryPage />
    </MemoryRouter>,
  )
}

function fillContactFields() {
  fireEvent.change(screen.getByLabelText(/FULL NAME/i), { target: { value: 'Jane Doe' } })
  fireEvent.change(screen.getByLabelText(/EMAIL ADDRESS/i), { target: { value: 'jane@example.com' } })
  fireEvent.change(screen.getByLabelText(/PHONE NUMBER/i), { target: { value: '5555555555' } })
}

describe('ApplyEntryPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    applyPublicMock.mockClear()
    updateClerkPasswordMock.mockClear()
    agencyInfo = twoBranchAgency
  })

  it('shows the position dropdown only after a branch is selected', () => {
    renderApplyPage()

    expect(screen.queryByLabelText(/WHICH POSITION ARE YOU APPLYING FOR\?/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ILS Branch' }))

    const positionSelect = screen.getByLabelText(/WHICH POSITION ARE YOU APPLYING FOR\?/i) as HTMLSelectElement
    expect(positionSelect).toBeInTheDocument()
    const optionLabels = Array.from(positionSelect.options).map((o) => o.label)
    expect(optionLabels).toContain('ILS Instructor')
    expect(optionLabels).toContain('Support Coordinator')
    expect(optionLabels).not.toContain('Caregiver')
  })

  it('shows the position dropdown immediately for a single-branch agency', () => {
    agencyInfo = singleBranchAgency
    renderApplyPage()

    const positionSelect = screen.getByLabelText(/WHICH POSITION ARE YOU APPLYING FOR\?/i) as HTMLSelectElement
    const optionLabels = Array.from(positionSelect.options).map((o) => o.label)
    expect(optionLabels).toContain('Caregiver')
    expect(optionLabels).toContain('Support Coordinator')
  })

  it('shows an error and does not submit when no position is selected', () => {
    const { container } = renderApplyPage()

    fillContactFields()
    fireEvent.click(screen.getByRole('button', { name: 'SLS Branch' }))

    const submitButton = screen.getByRole('button', { name: /Start application/i })
    expect(submitButton).toBeDisabled()

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    expect(screen.getByText('Please select a position.')).toBeInTheDocument()
    expect(applyPublicMock).not.toHaveBeenCalled()
  })

  it('clears the selected position when the branch changes', () => {
    renderApplyPage()

    fireEvent.click(screen.getByRole('button', { name: 'SLS Branch' }))
    fireEvent.change(screen.getByLabelText(/WHICH POSITION ARE YOU APPLYING FOR\?/i), {
      target: { value: 'Caregiver' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'ILS Branch' }))

    const positionSelect = screen.getByLabelText(/WHICH POSITION ARE YOU APPLYING FOR\?/i) as HTMLSelectElement
    expect(positionSelect.value).toBe('')
  })

  it('stores the selected position in sessionStorage on submit', async () => {
    renderApplyPage()

    fillContactFields()
    fireEvent.click(screen.getByRole('button', { name: 'SLS Branch' }))
    fireEvent.change(screen.getByLabelText(/WHICH POSITION ARE YOU APPLYING FOR\?/i), {
      target: { value: 'Caregiver' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Start application/i }))

    await waitFor(() => {
      expect(applyPublicMock).toHaveBeenCalled()
    })

    expect(sessionStorage.getItem('atriax_apply_position')).toBe('Caregiver')
    expect(sessionStorage.getItem('atriax_apply_slug')).toBe('test-agency')
  })

  it('shows a user-friendly Clerk message when the new password is rejected', async () => {
    updateClerkPasswordMock.mockRejectedValueOnce(
      new Error(
        '[CONVEX A(candidates:updateClerkPassword)] [Request ID: req_123] Server Error\n' +
          'Uncaught ConvexError: Password has been found in an online data breach.',
      ),
    )

    renderApplyPage()

    fillContactFields()
    fireEvent.click(screen.getByRole('button', { name: 'SLS Branch' }))
    fireEvent.change(screen.getByLabelText(/WHICH POSITION ARE YOU APPLYING FOR\?/i), {
      target: { value: 'Caregiver' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Start application/i }))

    await screen.findByText('Application started!')

    fireEvent.change(screen.getByLabelText(/NEW PASSWORD/i), { target: { value: 'Password123' } })
    fireEvent.change(screen.getByLabelText(/CONFIRM PASSWORD/i), { target: { value: 'Password123' } })
    fireEvent.click(screen.getByRole('button', { name: /Set password and continue/i }))

    await screen.findByText('Password has been found in an online data breach.')
    expect(screen.queryByText(/Request ID/i)).not.toBeInTheDocument()
  })
})
