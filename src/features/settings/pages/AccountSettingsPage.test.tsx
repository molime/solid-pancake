import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const userProfileProps = vi.fn()

vi.mock('@clerk/react', () => ({
  useUser: () => ({
    user: {
      primaryEmailAddress: { emailAddress: 'maria@agency.example' },
      emailAddresses: [{ emailAddress: 'maria@agency.example' }],
    },
  }),
  UserProfile: (props: unknown) => {
    userProfileProps(props)
    return <div data-testid="clerk-user-profile" />
  },
}))

import { AccountSettingsPage } from './AccountSettingsPage'

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the account email read-only with the agency-admin note', () => {
    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('account-email')).toHaveTextContent(
      'maria@agency.example',
    )
    expect(
      screen.getByText(/contact your agency admin/i),
    ).toBeInTheDocument()
  })

  it('themes the Clerk UserProfile and keeps the email section hidden', () => {
    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    const props = userProfileProps.mock.calls[0]?.[0] as {
      appearance: {
        variables: { colorBackground: string }
        elements: { profileSection__emailAddresses: { display: string } }
      }
    }
    expect(props.appearance.variables.colorBackground).toBe('#11171a')
    expect(
      props.appearance.elements.profileSection__emailAddresses.display,
    ).toBe('none')
  })
})
