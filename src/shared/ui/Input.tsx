import type { InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-[6px] border border-atria-border bg-atria-surface px-3 text-sm text-atria-ink placeholder:text-atria-muted/60 focus:outline-none focus:ring-1 focus:ring-atria-accent focus:border-atria-accent disabled:opacity-45',
        className,
      )}
      {...props}
    />
  )
}
