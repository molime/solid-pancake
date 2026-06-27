import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean
}

export function Textarea({ className, hasError, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-[var(--radius-atria-md)] border bg-atria-surface-3 px-3 py-2 text-base text-atria-ink placeholder:text-atria-text-muted/60 focus:outline-none focus:ring-1 focus:ring-atria-accent focus:border-atria-accent disabled:opacity-45 resize-y',
        hasError && 'border-atria-danger focus:ring-atria-danger focus:border-atria-danger',
        !hasError && 'border-atria-border',
        className,
      )}
      {...props}
    />
  )
}
