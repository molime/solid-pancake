import { cn } from '@/shared/lib/cn'

type Tone = 'default' | 'danger' | 'warning' | 'info' | 'success'

const toneValueClass: Record<Tone, string> = {
  default: 'text-[#f5f7f6]',
  danger: 'text-[#ef4444]',
  warning: 'text-[#f59e0b]',
  info: 'text-[#3b82f6]',
  success: 'text-[#22c55e]',
}

export function PlatformKpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: Tone
}) {
  return (
    <div className="h-[120px] w-full rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5 lg:w-[266px]">
      <p className="text-sm font-medium text-[#9aa6a8]">{label}</p>
      <p
        className={cn(
          'mt-2 text-[38px] font-bold leading-none',
          toneValueClass[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-[13px] text-[#687173]">{hint}</p>}
    </div>
  )
}
