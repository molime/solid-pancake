import { formatStatusLabel } from '@/shared/format'
import { cn } from '@/shared/lib/cn'

// Maps domain statuses to the platform dark palette. Background is the color
// at 16% opacity, text is the full color.
const statusColorClass: Record<string, string> = {
  active: 'bg-[rgba(34,197,94,0.16)] text-[#22c55e]',
  paid: 'bg-[rgba(34,197,94,0.16)] text-[#22c55e]',
  healthy: 'bg-[rgba(34,197,94,0.16)] text-[#22c55e]',
  trialing: 'bg-[rgba(245,158,11,0.16)] text-[#f59e0b]',
  warning: 'bg-[rgba(245,158,11,0.16)] text-[#f59e0b]',
  past_due: 'bg-[rgba(239,68,68,0.16)] text-[#ef4444]',
  overdue: 'bg-[rgba(239,68,68,0.16)] text-[#ef4444]',
  critical: 'bg-[rgba(239,68,68,0.16)] text-[#ef4444]',
  suspended: 'bg-[rgba(239,68,68,0.16)] text-[#ef4444]',
  draft: 'bg-[rgba(154,166,168,0.16)] text-[#9aa6a8]',
  void: 'bg-[rgba(154,166,168,0.16)] text-[#9aa6a8]',
  canceled: 'bg-[rgba(154,166,168,0.16)] text-[#9aa6a8]',
  none: 'bg-[rgba(154,166,168,0.16)] text-[#9aa6a8]',
  sent: 'bg-[rgba(59,130,246,0.16)] text-[#3b82f6]',
}

export function PlatformStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[15px] px-3 py-1 text-[13px] font-semibold',
        statusColorClass[status] ??
          'bg-[rgba(154,166,168,0.16)] text-[#9aa6a8]',
      )}
    >
      {formatStatusLabel(status)}
    </span>
  )
}
