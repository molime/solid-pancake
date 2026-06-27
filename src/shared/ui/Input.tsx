import type { InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  controlSize?: 'md' | 'lg'
  hasError?: boolean
}

export function Input({ className, controlSize = 'md', hasError, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'flex w-full rounded-[var(--radius-atria-md)] border bg-atria-surface-3 px-3 text-base text-atria-ink placeholder:text-atria-text-muted/60 focus:outline-none focus:ring-1 focus:ring-atria-accent focus:border-atria-accent disabled:opacity-45',
        controlSize === 'md' && 'h-10',
        controlSize === 'lg' && 'h-[52px]',
        hasError && 'border-atria-danger focus:ring-atria-danger focus:border-atria-danger',
        !hasError && 'border-atria-border',
        className,
      )}
      {...props}
    />
  )
}
