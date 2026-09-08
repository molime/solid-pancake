import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AcknowledgmentsSection } from './AcknowledgmentsSection'
import { createDefaultApplicationFormData } from './types'

describe('AcknowledgmentsSection', () => {
  it('renders the Individuals Choice policy documents by default', () => {
    const data = createDefaultApplicationFormData()
    render(
      <AcknowledgmentsSection
        value={data.acknowledgments}
        onChange={vi.fn()}
        agencyName='Individuals Choice, Inc'
      />,
    )

    expect(screen.getByText('Employee Contract')).toBeInTheDocument()
    expect(screen.getByText('HIPAA Privacy & Confidentiality')).toBeInTheDocument()
    expect(screen.getByText('Abuse, Neglect & Exploitation Reporting')).toBeInTheDocument()
  })

  it('renders the Golden Ages policy documents for Golden Ages', () => {
    const data = createDefaultApplicationFormData()
    render(
      <AcknowledgmentsSection
        value={data.acknowledgments}
        onChange={vi.fn()}
        agencyName='Golden Ages Home Care'
        isGoldenAges
      />,
    )

    // Same five acknowledgments, but with Golden Ages texts: the conduct
    // policy names Golden Ages Home Care, not Individuals Choice.
    expect(screen.getByText('Employee Contract')).toBeInTheDocument()
    expect(screen.getByText('HIPAA Privacy & Confidentiality')).toBeInTheDocument()
    expect(screen.getByText('Abuse, Neglect & Exploitation Reporting')).toBeInTheDocument()
    expect(screen.getAllByText(/Golden Ages Home Care/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Individuals Choice, Inc/)).not.toBeInTheDocument()
  })
})
