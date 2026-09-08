import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DynamicApplicationPage } from './DynamicApplicationPage'
import { getFunctionName } from 'convex/server'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@clerk/react', () => ({
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => ({ isLoaded: true }),
}))

const sampleForms = [
  {
    _id: 'form-1',
    key: 'personal',
    name: 'Personal info',
    category: 'application',
    order: 1,
    active: true,
    fields: [{ id: 'fullName', type: 'text', label: 'Full name', required: true }],
  },
]

vi.mock('convex/react', () => ({
  useQuery: (query: unknown) => {
    const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
    if (name === 'forms:getApplicationForms') return sampleForms
    return undefined
  },
  useMutation: () => vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/app/useTenant', () => ({
  useTenant: () => ({ clerkOrgId: 'org_test', isLoading: false }),
}))

describe('DynamicApplicationPage', () => {
  it('renders the first form and submits', async () => {
    render(
      <MemoryRouter>
        <DynamicApplicationPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Personal info' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Full name/i), {
      target: { value: 'Sofia Herrera' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Save and continue/i }))

    await waitFor(() => {
      expect(screen.getByText('Review & submit')).toBeInTheDocument()
    })
  })
})
