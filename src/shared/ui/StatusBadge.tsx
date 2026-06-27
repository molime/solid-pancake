import type { PropsWithChildren } from 'react'
import type { ShiftStatus } from '@/shared/domain/types'
import { formatStatusLabel } from '@/shared/format'
import { cn } from '@/shared/utils/cn'

export type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const statusVariantMap: Record<ShiftStatus, StatusBadgeVariant> = {
  scheduled: 'neutral',
  in_progress: 'info',
  submitted: 'warning',
  needs_correction: 'danger',
  approved: 'success',
  billing_ready: 'info',
}

const variantClasses: Record<StatusBadgeVariant, string> = {
  neutral:
    'border-atria-border-strong bg-atria-neutral-bg text-atria-neutral',
  info:
    'border-atria-info/30 bg-atria-info-bg text-atria-info',
  warning:
    'border-atria-warning/30 bg-atria-warning-bg text-atria-warning',
  danger:
    'border-atria-danger/30 bg-atria-danger-bg text-atria-danger',
  success:
    'border-atria-success/30 bg-atria-success-bg text-atria-success',
}

const variantLabels: Record<StatusBadgeVariant, string> = {
  neutral: 'Neutral',
  info: 'Info',
  warning: 'Warning',
  danger: 'Danger',
  success: 'Success',
}

type StatusBadgeProps = {
  status?: ShiftStatus
  variant?: StatusBadgeVariant
  className?: string
}

export function StatusBadge({
  status,
  variant,
  className,
  children,
}: PropsWithChildren<StatusBadgeProps>) {
  const resolvedVariant = variant ?? (status ? statusVariantMap[status] : 'neutral')
  const label =
    children ?? (status ? formatStatusLabel(status) : variantLabels[resolvedVariant])

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--radius-atria-sm)] border px-2 py-1 text-xs font-semibold',
        variantClasses[resolvedVariant],
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
