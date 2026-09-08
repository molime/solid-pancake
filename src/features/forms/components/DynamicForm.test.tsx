import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DynamicForm } from './DynamicForm'
import { DynamicFormReview } from './DynamicFormReview'

const sampleForm = {
  _id: 'form-1',
  name: 'Sample Application',
  description: 'A sample form for testing.',
  fields: [
    { id: 'fullName', type: 'text' as const, label: 'Full name', required: true },
    { id: 'startDate', type: 'date' as const, label: 'Start date', required: false },
    { id: 'notes', type: 'textarea' as const, label: 'Notes', required: false },
    {
      id: 'position',
      type: 'select' as const,
      label: 'Position',
      required: true,
      options: ['Caregiver', 'HHA'],
    },
    {
      id: 'agree',
      type: 'checkbox' as const,
      label: 'I agree to the terms',
      required: true,
    },
  ],
}

describe('DynamicForm', () => {
  it('renders all field types', () => {
    render(<DynamicForm form={sampleForm} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Position/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/I agree to the terms/i)).toBeInTheDocument()
  })

  it('validates required fields before submit', async () => {
    const onSubmit = vi.fn()
    render(<DynamicForm form={sampleForm} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: /Submit/i }))

    await waitFor(() => {
      expect(screen.getByText(/Full name is required/i)).toBeInTheDocument()
      expect(screen.getByText(/Position is required/i)).toBeInTheDocument()
      expect(screen.getByText(/I agree to the terms is required/i)).toBeInTheDocument()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits with valid answers', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<DynamicForm form={sampleForm} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/Full name/i), {
      target: { value: 'Sofia Herrera' },
    })
    fireEvent.change(screen.getByLabelText(/Position/i), {
      target: { value: 'HHA' },
    })
    fireEvent.click(screen.getByLabelText(/I agree to the terms/i))
    fireEvent.click(screen.getByRole('button', { name: /Submit/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        fullName: 'Sofia Herrera',
        position: 'HHA',
        agree: true,
      })
    })
  })

  it('calls onChange when a field changes', () => {
    const onChange = vi.fn()
    render(<DynamicForm form={sampleForm} onChange={onChange} onSubmit={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/Full name/i), {
      target: { value: 'A' },
    })

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'A' }))
  })
})

describe('DynamicFormReview', () => {
  it('renders answers in review mode', () => {
    render(
      <DynamicFormReview
        form={sampleForm}
        answers={{
          fullName: 'Sofia Herrera',
          startDate: '2026-09-01',
          notes: 'Ready to work',
          position: 'HHA',
          agree: true,
        }}
      />,
    )

    expect(screen.getByText('Sofia Herrera')).toBeInTheDocument()
    expect(screen.getByText('Ready to work')).toBeInTheDocument()
    expect(screen.getByText('HHA')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })
})
