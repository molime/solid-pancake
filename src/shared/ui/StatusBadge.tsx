import type { ShiftStatus } from '@/shared/domain/types'
import { formatStatusLabel } from '@/shared/format'
import { cn } from '@/shared/utils/cn'

const statusStyles: Record<ShiftStatus, string> = {
  scheduled: 'border-slate-300 bg-slate-50 text-slate-700',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-800',
  submitted: 'border-amber-200 bg-amber-50 text-amber-800',
  needs_correction: 'border-red-200 bg-red-50 text-red-800',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  billing_ready: 'border-teal-200 bg-teal-50 text-teal-800',
}

export function StatusBadge({ status }: { status: ShiftStatus }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-1 text-xs font-semibold',
        statusStyles[status],
      )}
    >
      {formatStatusLabel(status)}
    </span>
  )
}
