import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  controlSize?: 'md' | 'lg'
  hasError?: boolean
}

export function Select({ className, children, controlSize = 'md', hasError, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'flex w-full rounded-[var(--radius-atria-md)] border bg-atria-surface-3 px-3 text-base text-atria-ink focus:outline-none focus:ring-1 focus:ring-atria-accent focus:border-atria-accent disabled:opacity-45',
        controlSize === 'md' && 'h-10',
        controlSize === 'lg' && 'h-[52px]',
        hasError && 'border-atria-danger focus:ring-atria-danger focus:border-atria-danger',
        !hasError && 'border-atria-border',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
