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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'w-full max-w-lg rounded-[8px] border border-atria-border bg-atria-surface shadow-lg',
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
  return <div className={cn('px-4 py-3 border-b border-atria-border', className)}>{children}</div>
}

export function DialogTitle({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <h3 className={cn('text-sm font-semibold text-atria-ink', className)}>{children}</h3>
}

export function DialogContent({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('p-4', className)}>{children}</div>
}

export function DialogFooter({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('px-4 py-3 border-t border-atria-border flex justify-end gap-2', className)}>{children}</div>
}
