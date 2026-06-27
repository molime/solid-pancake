import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export type ToastVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface ToastProps {
  variant?: ToastVariant
  title: string
  description?: string
  action?: ReactNode
  onClose?: () => void
  className?: string
}

const toastStyles: Record<ToastVariant, string> = {
  success:
    'border-atria-success/30 bg-atria-success-bg text-atria-success',
  warning:
    'border-atria-warning/30 bg-atria-warning-bg text-atria-warning',
  danger:
    'border-atria-danger/30 bg-atria-danger-bg text-atria-danger',
  info:
    'border-atria-info/30 bg-atria-info-bg text-atria-info',
  neutral:
    'border-atria-border-strong bg-atria-neutral-bg text-atria-neutral',
}

export function Toast({
  variant = 'neutral',
  title,
  description,
  action,
  onClose,
  className,
}: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-atria-lg)] border p-4 shadow-[var(--shadow-atria-pop)]',
        toastStyles[variant],
        className,
      )}
    >
      <div className="flex-1">
        <p className="text-base font-semibold">{title}</p>
        {description && (
          <p className="mt-1 text-sm opacity-90">{description}</p>
        )}
        {action && <div className="mt-3">{action}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 hover:bg-black/10"
          aria-label="Close notification"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
