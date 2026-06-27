import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: string
  detail: string
  icon: ReactNode
}

export function KpiCard({ label, value, detail, icon }: KpiCardProps) {
  return (
    <div className="min-h-[140px] rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface p-6 shadow-[var(--shadow-atria-card)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-atria-text-muted">
          {label}
        </span>
        <span className="text-atria-accent">{icon}</span>
      </div>
      <div className="mt-3 text-[32px] leading-[38px] font-bold text-atria-ink">
        {value}
      </div>
      <p className="mt-1 text-sm text-atria-text-secondary">{detail}</p>
    </div>
  )
}
