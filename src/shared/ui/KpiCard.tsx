import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: string
  detail: string
  icon: ReactNode
}

export function KpiCard({ label, value, detail, icon }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-slate-500">
          {label}
        </span>
        <span className="text-teal-700">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-950">{value}</div>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </div>
  )
}
