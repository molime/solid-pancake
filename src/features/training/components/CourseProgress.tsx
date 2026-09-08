import { cn } from '@/shared/lib/cn'

export function CourseProgress({
  percent,
  completed,
}: {
  percent: number
  completed: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-atria-surface-3">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            completed ? 'bg-atria-success' : 'bg-atria-accent',
          )}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <span
        className={cn(
          'text-xs font-medium',
          completed ? 'text-atria-success' : 'text-atria-text-muted',
        )}
      >
        {completed ? 'Completed' : `${percent}%`}
      </span>
    </div>
  )
}
