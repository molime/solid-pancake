import type { PropsWithChildren } from 'react'
import { cn } from '@/shared/lib/cn'

export function Dialog({
  open,
  onClose,
  children,
  className,
}: PropsWithChildren<{
  open: boolean
  onClose: () => void
  className?: string
}>) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface shadow-[var(--shadow-atria-pop)]',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('px-6 py-5 border-b border-atria-border', className)}>{children}</div>
}

export function DialogTitle({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <h3 className={cn('text-lg font-semibold text-atria-ink', className)}>{children}</h3>
}

export function DialogContent({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('flex-1 overflow-y-auto p-6', className)}>{children}</div>
}

export function DialogFooter({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('px-6 py-5 border-t border-atria-border flex justify-end gap-2', className)}>{children}</div>
}
