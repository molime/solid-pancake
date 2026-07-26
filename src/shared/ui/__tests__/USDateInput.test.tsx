import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { USDateInput } from '../USDateInput'

function renderInput(value = '', onChange = vi.fn()) {
  render(<USDateInput aria-label='Date' value={value} onChange={onChange} />)
  return { input: screen.getByLabelText('Date') as HTMLInputElement, onChange }
}

describe('USDateInput', () => {
  it('renders an ISO value in mm/dd/yyyy format', () => {
    const { input } = renderInput('2024-12-25')
    expect(input.value).toBe('12/25/2024')
  })

  it('auto-inserts slashes as digits are typed', () => {
    const { input } = renderInput()

    fireEvent.change(input, { target: { value: '12' } })
    expect(input.value).toBe('12')

    fireEvent.change(input, { target: { value: '122' } })
    expect(input.value).toBe('12/2')

    fireEvent.change(input, { target: { value: '12/25' } })
    expect(input.value).toBe('12/25')

    fireEvent.change(input, { target: { value: '12/252' } })
    expect(input.value).toBe('12/25/2')
  })

  it('emits an ISO string for a valid date', () => {
    const { input, onChange } = renderInput()
    fireEvent.change(input, { target: { value: '12252024' } })
    expect(input.value).toBe('12/25/2024')
    expect(onChange).toHaveBeenLastCalledWith('2024-12-25')
  })

  it('accepts February 29 in a leap year', () => {
    const { input, onChange } = renderInput()
    fireEvent.change(input, { target: { value: '02292024' } })
    expect(onChange).toHaveBeenLastCalledWith('2024-02-29')
  })

  it('never emits an invalid date while typing', () => {
    const { input, onChange } = renderInput()
    fireEvent.change(input, { target: { value: '13012025' } })
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('clears an invalid month on blur', () => {
    const { input, onChange } = renderInput()
    fireEvent.change(input, { target: { value: '13012025' } })
    fireEvent.blur(input)
    expect(input.value).toBe('')
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('clears an invalid day on blur', () => {
    const { input, onChange } = renderInput()
    fireEvent.change(input, { target: { value: '02302025' } })
    fireEvent.blur(input)
    expect(input.value).toBe('')
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('clears February 29 in a non-leap year on blur', () => {
    const { input, onChange } = renderInput()
    fireEvent.change(input, { target: { value: '02292025' } })
    fireEvent.blur(input)
    expect(input.value).toBe('')
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('clears incomplete input on blur', () => {
    const { input, onChange } = renderInput()
    fireEvent.change(input, { target: { value: '1225' } })
    expect(input.value).toBe('12/25')
    fireEvent.blur(input)
    expect(input.value).toBe('')
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('keeps a valid date on blur', () => {
    const { input, onChange } = renderInput()
    fireEvent.change(input, { target: { value: '12252024' } })
    fireEvent.blur(input)
    expect(input.value).toBe('12/25/2024')
    expect(onChange).toHaveBeenLastCalledWith('2024-12-25')
  })

  it('preserves mask integrity when deleting', () => {
    const { input } = renderInput()
    fireEvent.change(input, { target: { value: '12252024' } })
    expect(input.value).toBe('12/25/2024')

    fireEvent.change(input, { target: { value: '12/25/202' } })
    expect(input.value).toBe('12/25/202')

    fireEvent.change(input, { target: { value: '12/25' } })
    expect(input.value).toBe('12/25')

    fireEvent.change(input, { target: { value: '12/' } })
    expect(input.value).toBe('12')
  })

  it('forwards ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>()
    render(<USDateInput aria-label='Date' value='' onChange={() => {}} ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
    expect(ref.current).toBe(screen.getByLabelText('Date'))
  })

  it('does not allow input when disabled', () => {
    const onChange = vi.fn()
    render(<USDateInput aria-label='Date' value='' onChange={onChange} disabled />)
    const input = screen.getByLabelText('Date') as HTMLInputElement
    expect(input).toBeDisabled()
  })
})
