import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PersonalInfoSection } from './PersonalInfoSection'
import { createDefaultApplicationFormData } from './types'

function renderSection(overrides: Partial<ReturnType<typeof createDefaultApplicationFormData>['personal']> = {}) {
  const value = { ...createDefaultApplicationFormData().personal, ...overrides }
  const onChange = vi.fn()
  render(<PersonalInfoSection value={value} onChange={onChange} />)
  return { onChange, value }
}

describe('PersonalInfoSection transport question', () => {
  it('renders the transport question with Yes and No options', () => {
    renderSection()

    expect(
      screen.getByText('Do you plan to use your personal vehicle to transport clients?'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Yes')).toBeInTheDocument()
    expect(screen.getByLabelText('No')).toBeInTheDocument()
  })

  it('is marked optional and defaults to unanswered', () => {
    renderSection()

    expect(
      screen.getByText('Optional — your answer does not affect your application.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Yes')).not.toBeChecked()
    expect(screen.getByLabelText('No')).not.toBeChecked()
  })

  it('calls onChange with canTransportClients true when Yes is selected', () => {
    const { onChange } = renderSection()

    fireEvent.click(screen.getByLabelText('Yes'))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ canTransportClients: true }),
    )
  })

  it('calls onChange with canTransportClients false when No is selected', () => {
    const { onChange } = renderSection()

    fireEvent.click(screen.getByLabelText('No'))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ canTransportClients: false }),
    )
  })

  it('shows the mileage reimbursement info box only when Yes is selected', () => {
    const infoText = /reimbursed for mileage when transporting clients/

    const { unmount } = render(
      <PersonalInfoSection
        value={createDefaultApplicationFormData().personal}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByText(infoText)).not.toBeInTheDocument()
    unmount()

    const yesValue = {
      ...createDefaultApplicationFormData().personal,
      canTransportClients: true,
    }
    render(<PersonalInfoSection value={yesValue} onChange={vi.fn()} />)
    expect(screen.getByText(infoText)).toBeInTheDocument()
  })
})

describe('PersonalInfoSection position selector', () => {
  it('does not render a position selector (position is chosen on step 0)', () => {
    renderSection()

    expect(screen.queryByText('Position applying for')).not.toBeInTheDocument()
  })
})

describe('PersonalInfoSection SSN/ITIN label', () => {
  it('shows the combined label when no ID type is selected', () => {
    renderSection()

    expect(screen.getByText('SSN / ITIN')).toBeInTheDocument()
  })

  it('shows ITIN as the label when ITIN is selected', () => {
    renderSection({ idType: 'itin' })

    expect(screen.getByText('ITIN')).toBeInTheDocument()
    expect(screen.queryByText('SSN / ITIN')).not.toBeInTheDocument()
  })

  it('shows SSN as the label when SSN is selected', () => {
    renderSection({ idType: 'ssn' })

    expect(screen.getByText('SSN')).toBeInTheDocument()
    expect(screen.queryByText('SSN / ITIN')).not.toBeInTheDocument()
  })
})

describe('PersonalInfoSection phone and email validation', () => {
  it('formats phone input as (XXX) XXX-XXXX on change', () => {
    const { onChange } = renderSection()

    fireEvent.change(screen.getByLabelText(/Home phone/), { target: { value: '5551234567' } })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ homePhone: '(555) 123-4567' }),
    )
  })

  it('shows a phone error when showErrors is set and the number is invalid', () => {
    const value = { ...createDefaultApplicationFormData().personal, homePhone: '(555) 123' }
    render(<PersonalInfoSection value={value} onChange={vi.fn()} showErrors />)

    expect(screen.getByText('Enter a valid 10-digit phone number')).toBeInTheDocument()
  })

  it('shows an email error when showErrors is set and the email is invalid', () => {
    const value = { ...createDefaultApplicationFormData().personal, email: 'not-an-email' }
    render(<PersonalInfoSection value={value} onChange={vi.fn()} showErrors />)

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
  })
})
