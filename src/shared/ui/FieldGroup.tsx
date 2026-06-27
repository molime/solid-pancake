import { type PropsWithChildren, type ReactNode, type ReactElement, isValidElement, cloneElement } from 'react'
import { cn } from '@/shared/lib/cn'

interface FieldGroupProps {
  label: ReactNode
  htmlFor?: string
  helperText?: ReactNode
  error?: ReactNode
  required?: boolean
  className?: string
}

export function FieldGroup({
  label,
  htmlFor,
  helperText,
  error,
  required,
  className,
  children,
}: PropsWithChildren<FieldGroupProps>) {
  const helperId = helperText ? `${htmlFor}-helper` : undefined
  const errorId = error ? `${htmlFor}-error` : undefined
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined

  const input = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{ 'aria-describedby'?: string; 'aria-invalid'?: boolean }>,
        {
          'aria-describedby': describedBy,
          'aria-invalid': error ? true : undefined,
        },
      )
    : children

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-base font-medium text-atria-ink"
      >
        {label}
        {required && <span className="ml-1 text-atria-danger">*</span>}
      </label>
      {input}
      {helperText && !error && (
        <span id={helperId} className="text-sm text-atria-text-secondary">
          {helperText}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-sm text-atria-danger">
          {error}
        </span>
      )}
    </div>
  )
}
