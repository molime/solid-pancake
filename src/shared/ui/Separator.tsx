import { cn } from '@/shared/lib/cn'

export function Separator({ className }: { className?: string }) {
  return <div className={cn('h-px bg-atria-border', className)} />
}
