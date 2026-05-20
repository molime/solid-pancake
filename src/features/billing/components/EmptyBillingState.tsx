import { FileText } from 'lucide-react'

export function EmptyBillingState({
  title,
  detail,
}: {
  title: string
  detail: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-atria-border/50">
        <FileText className="h-6 w-6 text-atria-muted" />
      </div>
      <p className="text-sm font-medium text-atria-ink">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-atria-muted">{detail}</p>
    </div>
  )
}
