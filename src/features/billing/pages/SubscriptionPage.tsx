import { useState } from 'react'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useTenant } from '@/app/useTenant'
import { AppLoader } from '@/shared/ui/AppLoader'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { CreditCard, Receipt } from 'lucide-react'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  trialing: 'neutral',
  past_due: 'warning',
  suspended: 'danger',
  canceled: 'neutral',
}

const INVOICE_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  sent: 'warning',
  paid: 'success',
  overdue: 'danger',
  void: 'neutral',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Agency admins see their own Atria subscription here: plan, price, billing
// period, invoices, and a link to update the payment method on file.
export function SubscriptionPage() {
  const { clerkOrgId } = useTenant()
  const data = useQuery(
    api.agencyBilling.getMySubscription,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const invoices = useQuery(
    api.agencyBilling.listMyInvoices,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const createSetupSession = useAction(api.agencyBilling.createMyPaymentSetupSession)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState('')

  if (!clerkOrgId || data === undefined || invoices === undefined) {
    return <AppLoader fullScreen label="Loading subscription..." />
  }

  const handleUpdatePaymentMethod = async () => {
    setIsRedirecting(true)
    setError('')
    try {
      const { url } = await createSetupSession({ clerkOrgId })
      window.location.href = url
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Could not open the payment setup page.',
      )
      setIsRedirecting(false)
    }
  }

  const subscription = data?.subscription ?? null
  const plan = data?.plan ?? null

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-atria-ink">Subscription</h1>
        <p className="text-base text-atria-text-secondary">
          Your Atria plan, invoices, and payment method.
        </p>
      </div>

      {!subscription ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-base font-medium text-atria-ink">
              No subscription is set up for your agency yet.
            </p>
            <p className="mt-1 text-sm text-atria-text-secondary">
              Atria will activate your plan with you — contact support if you
              have questions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Your plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xl font-bold text-atria-ink">
                    {plan?.label ?? subscription.planKey}
                  </p>
                  {plan && (
                    <p className="text-sm text-atria-text-secondary">
                      {formatMoney(plan.basePrice)} / month
                      {plan.includedSeats
                        ? ` · includes ${plan.includedSeats} seats`
                        : ''}
                      {plan.perSeatPrice
                        ? ` · then ${formatMoney(plan.perSeatPrice)} / seat`
                        : ''}
                    </p>
                  )}
                </div>
                <Badge variant={STATUS_VARIANT[subscription.status] ?? 'neutral'}>
                  {subscription.status.replace('_', ' ')}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-atria-text-muted">
                    Current period
                  </p>
                  <p className="text-atria-ink">
                    {formatDate(subscription.currentPeriodStart)} –{' '}
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-atria-text-muted">
                    Renews
                  </p>
                  <p className="text-atria-ink">
                    {formatDate(subscription.renewsAt ?? subscription.currentPeriodEnd)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-atria-text-muted">
                    Billing email
                  </p>
                  <p className="text-atria-ink">
                    {subscription.billingEmails.join(', ') || '—'}
                  </p>
                </div>
              </div>
              <div className="border-t border-atria-border pt-4">
                <Button
                  variant="secondary"
                  size="md"
                  disabled={isRedirecting}
                  onClick={handleUpdatePaymentMethod}
                >
                  <CreditCard className="h-4 w-4" />
                  {isRedirecting
                    ? 'Opening secure page...'
                    : 'Update payment method'}
                </Button>
                {error && (
                  <p className="mt-2 text-sm text-atria-danger">{error}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="py-4 text-center text-sm text-atria-text-secondary">
                  No invoices yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice._id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-atria-md)] border border-atria-border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Receipt className="h-4 w-4 shrink-0 text-atria-text-muted" />
                        <div>
                          <p className="text-sm font-medium text-atria-ink">
                            {invoice.invoiceNumber}
                          </p>
                          <p className="text-xs text-atria-text-secondary">
                            {formatDate(invoice.periodStart)} –{' '}
                            {formatDate(invoice.periodEnd)} · due{' '}
                            {formatDate(invoice.dueDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-atria-ink">
                          {formatMoney(invoice.total)}
                        </span>
                        <Badge
                          variant={
                            INVOICE_STATUS_VARIANT[invoice.status] ?? 'neutral'
                          }
                        >
                          {invoice.status}
                        </Badge>
                        {invoice.stripeHostedInvoiceUrl &&
                          invoice.status !== 'paid' &&
                          invoice.status !== 'void' && (
                            <a
                              href={invoice.stripeHostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-atria-accent hover:underline"
                            >
                              Pay now →
                            </a>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
