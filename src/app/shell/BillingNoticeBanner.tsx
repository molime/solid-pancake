import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useTenant } from '@/app/useTenant'
import { AlertTriangle, CreditCard } from 'lucide-react'

function formatGraceDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Persistent subscription-payment notice, driven by the tenant's billing
// status: 'past_due' shows a slim banner on every page (with a pay link for
// admins); 'suspended' blocks the app behind a full-screen notice until the
// balance is paid (reactivation is automatic on invoice.paid).
export function BillingNoticeBanner() {
  const { clerkOrgId } = useTenant()
  const notice = useQuery(
    api.agencyBilling.getMyBillingNotice,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  if (!notice) return null

  if (notice.status === 'suspended') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-atria-bg p-6">
        <div className="max-w-md space-y-4 rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface p-8 text-center shadow-lg">
          <AlertTriangle className="mx-auto h-10 w-10 text-atria-danger" />
          <h1 className="text-xl font-bold text-atria-ink">
            Access suspended
          </h1>
          <p className="text-sm text-atria-text-secondary">
            Your agency&apos;s access to Atria is suspended because a past-due
            subscription invoice was not paid within the 5-day grace period.
            Access is restored automatically as soon as the balance is paid.
          </p>
          {notice.isAdmin && notice.hostedInvoiceUrl ? (
            <a
              href={notice.hostedInvoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[var(--radius-atria-md)] bg-atria-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <CreditCard className="h-4 w-4" />
              Pay {notice.totalDue !== null ? `$${notice.totalDue.toFixed(2)}` : 'now'} →
            </a>
          ) : (
            <p className="text-sm font-medium text-atria-ink">
              Please contact your agency administrator.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-atria-warning/30 bg-atria-warning-bg px-4 py-2 text-sm text-atria-ink">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-atria-warning" />
        <span>
          <strong>Payment required.</strong> Your subscription invoice is past
          due
          {notice.graceUntil
            ? ` — pay by ${formatGraceDate(notice.graceUntil)} to avoid service suspension.`
            : '.'}
        </span>
      </span>
      {notice.isAdmin &&
        (notice.hostedInvoiceUrl ? (
          <a
            href={notice.hostedInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-atria-accent hover:underline"
          >
            Pay {notice.totalDue !== null ? `$${notice.totalDue.toFixed(2)}` : ''} now →
          </a>
        ) : (
          <span className="font-medium">
            Update your payment method from the Subscription page.
          </span>
        ))}
    </div>
  )
}
