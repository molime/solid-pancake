import { useState } from 'react'
import type { ChangeEvent, FocusEvent, InputHTMLAttributes, Ref } from 'react'
import { Input } from './Input'

interface USDateInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** ISO date string (yyyy-mm-dd) or '' */
  value: string
  /** Emits an ISO date string (yyyy-mm-dd) or '' — never an invalid date */
  onChange: (isoDate: string) => void
  controlSize?: 'md' | 'lg'
  hasError?: boolean
  ref?: Ref<HTMLInputElement>
}

function isoToDisplay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return ''
  return `${match[2]}/${match[3]}/${match[1]}`
}

function isValidDate(month: number, day: number, year: number): boolean {
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  // Day 0 of the next month rolls back to the last day of this one,
  // which also handles February 29 in leap years
  const daysInMonth = new Date(year, month, 0).getDate()
  return day >= 1 && day <= daysInMonth
}

function parseDisplay(display: string): { month: number; day: number; year: number } | null {
  const digits = display.replace(/\D/g, '')
  if (digits.length !== 8) return null
  return {
    month: Number(digits.slice(0, 2)),
    day: Number(digits.slice(2, 4)),
    year: Number(digits.slice(4, 8)),
  }
}

function toIso(month: number, day: number, year: number): string {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

export function USDateInput({
  value,
  onChange,
  onBlur,
  placeholder = 'mm/dd/yyyy',
  ref,
  ...props
}: USDateInputProps) {
  const [display, setDisplay] = useState(() => isoToDisplay(value))
  const [isFocused, setIsFocused] = useState(false)
  const [lastValue, setLastValue] = useState(value)

  // Keep the display in sync with external value changes while not editing
  if (value !== lastValue) {
    setLastValue(value)
    if (!isFocused) setDisplay(isoToDisplay(value))
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    let next = digits
    if (digits.length > 4) {
      next = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
    } else if (digits.length > 2) {
      next = `${digits.slice(0, 2)}/${digits.slice(2)}`
    }
    setDisplay(next)

    const parsed = parseDisplay(next)
    if (parsed && isValidDate(parsed.month, parsed.day, parsed.year)) {
      onChange(toIso(parsed.month, parsed.day, parsed.year))
    } else {
      onChange('')
    }
  }

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    const parsed = parseDisplay(display)
    if (parsed && isValidDate(parsed.month, parsed.day, parsed.year)) {
      onChange(toIso(parsed.month, parsed.day, parsed.year))
    } else {
      // Clear invalid or incomplete input so it never reaches form state
      setDisplay('')
      onChange('')
    }
    onBlur?.(e)
  }

  return (
    <Input
      type='text'
      inputMode='numeric'
      placeholder={placeholder}
      value={display}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      ref={ref}
      {...props}
    />
  )
}
