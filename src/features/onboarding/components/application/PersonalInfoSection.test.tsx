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
