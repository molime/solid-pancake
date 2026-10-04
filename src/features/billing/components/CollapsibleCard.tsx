import { useState, type ReactNode } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import { ChevronDown, ChevronRight } from 'lucide-react'

/**
 * A card whose body collapses under a clickable header — keeps long pages
 * (Billing) scannable. Sections default closed except the ones the caller
 * marks as primary.
 */
export function CollapsibleCard({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string
  badge?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-t-[inherit] p-4 text-left hover:bg-atria-surface-2"
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-atria-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-atria-muted" />
          )}
          <span className="text-base font-semibold text-atria-ink">{title}</span>
        </span>
        {badge}
      </button>
      {open && <CardContent className="border-t border-atria-border">{children}</CardContent>}
    </Card>
  )
}
