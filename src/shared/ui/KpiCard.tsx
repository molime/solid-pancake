import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

interface KpiCardProps {
  label: string
  value: string
  detail?: string
  icon?: ReactNode
  trend?: ReactNode
  valueClassName?: string
}

export function KpiCard({
  label,
  value,
  detail,
  icon,
  trend,
  valueClassName = 'text-atria-ink',
}: KpiCardProps) {
  return (
    <div className="min-h-[140px] rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface p-6 shadow-[var(--shadow-atria-card)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-atria-text-muted">
          {label}
        </span>
        {icon && <span className="text-atria-accent">{icon}</span>}
      </div>
      <div
        className={cn(
          'mt-3 text-[32px] leading-[38px] font-bold',
          valueClassName,
        )}
      >
        {value}
      </div>
      {trend && <div className="mt-1">{trend}</div>}
      {!trend && detail && (
        <p className="mt-1 text-sm text-atria-text-secondary">{detail}</p>
      )}
    </div>
  )
}
