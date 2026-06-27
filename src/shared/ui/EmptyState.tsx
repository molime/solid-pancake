import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-atria-lg)] border border-dashed border-atria-border bg-atria-surface p-8 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-atria-surface-2 text-atria-text-secondary">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-atria-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-base text-atria-text-secondary">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
