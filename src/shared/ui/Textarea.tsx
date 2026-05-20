import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-[6px] border border-atria-border bg-atria-surface px-3 py-2 text-sm text-atria-ink placeholder:text-atria-muted/60 focus:outline-none focus:ring-1 focus:ring-atria-accent focus:border-atria-accent disabled:opacity-45 resize-y',
        className,
      )}
      {...props}
    />
  )
}
