import type { PropsWithChildren, HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface shadow-[var(--shadow-atria-card)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('px-6 py-5 border-b border-atria-border', className)}>{children}</div>
}

export function CardTitle({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <h3 className={cn('text-lg font-semibold text-atria-ink', className)}>{children}</h3>
}

export function CardContent({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('p-6', className)}>{children}</div>
}
