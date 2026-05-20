import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-9 w-full rounded-[6px] border border-atria-border bg-atria-surface px-3 text-sm text-atria-ink focus:outline-none focus:ring-1 focus:ring-atria-accent focus:border-atria-accent disabled:opacity-45',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
