import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { formatTime } from '@/shared/format'

export function ShiftSuccessScreen({
  firstName,
  clientName,
  onHome,
}: {
  firstName: string
  clientName: string
  onHome: () => void
}) {
  const sentAt = formatTime(new Date().toISOString())

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-6 text-center" data-testid="shift-success-screen">
      <div className="w-full max-w-sm space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-atria-success-bg">
          <CheckCircle2 className="h-10 w-10 text-atria-success" />
        </div>

        <div className="space-y-2 text-left">
          <h2 className="text-2xl font-semibold text-atria-ink">
            All done, {firstName || 'Caregiver'}! 🎉
          </h2>
          <p className="text-base text-atria-text-secondary">
            Your shift notes for {clientName} have been sent to your coordinator. Thank you for taking good care of her.
          </p>
        </div>

        <div className="rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface-2 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-atria-text-muted">
            Sent
          </p>
          <p className="mt-1 text-base text-atria-ink">
            Today at {sentAt} · Awaiting review
          </p>
        </div>

        <Button variant="primary" size="lg" className="w-full rounded-full" onClick={onHome}>
          Back to home
        </Button>
      </div>
    </div>
  )
}
