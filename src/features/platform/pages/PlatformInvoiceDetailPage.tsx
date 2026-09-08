import { useState } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Dialog } from '@/shared/ui/Dialog'
import { formatCurrency, formatDateUS, formatTime } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { cn } from '@/shared/lib/cn'
import { usePlatformAdmin } from '../usePlatformAdmin'
import { PlatformGate } from '../components/PlatformGate'
import { PlatformStatusPill } from '../components/PlatformStatusPill'
import {
  PlatformTable,
  PlatformTableBody,
  PlatformTableCell,
  PlatformTableHead,
  PlatformTableHeader,
  PlatformTableRow,
} from '../components/PlatformTable'

const fieldClass =
  'w-full rounded-lg border border-[#2a3437] bg-[#1e2629] px-3 py-2 text-[15px] text-[#f5f7f6] outline-none focus:border-[#22c55e]'

const primaryButtonClass =
  'rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0f10] transition-opacity hover:opacity-90 disabled:opacity-50'

const dangerButtonClass =
  'rounded-lg bg-[rgba(239,68,68,0.16)] px-4 py-2 text-sm font-semibold text-[#ef4444] transition-colors hover:bg-[rgba(239,68,68,0.28)] disabled:opacity-50'

const ghostButtonClass =
  'rounded-lg border border-[#2a3437] px-4 py-2 text-sm font-medium text-[#9aa6a8] transition-colors hover:text-[#f5f7f6]'

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[#687173]">{label}</span>
      <span className="max-w-[60%] truncate text-right text-[15px] text-[#f5f7f6]">
        {value}
      </span>
    </div>
  )
}

export function PlatformInvoiceDetailPage() {
  const { invoiceId } = useParams()
  const isAdmin = usePlatformAdmin()
  const invoice = useQuery(
    api.platform.getPlatformInvoice,
    isAdmin && invoiceId
      ? { invoiceId: invoiceId as Id<'platformInvoices'> }
      : 'skip',
  )
  const sendPlatformInvoice = useMutation(api.platform.sendPlatformInvoice)
  const markInvoicePaid = useMutation(api.platform.markInvoicePaid)
  const voidInvoice = useMutation(api.platform.voidInvoice)
  const syncStripeInvoiceStatus = useAction(
    api.platformStripe.syncStripeInvoiceStatus,
  )
  const sendInvoiceWithStripe = useAction(
    api.platformStripe.sendInvoiceWithStripe,
  )

  const [sendToOverride, setSendToOverride] = useState('')
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const status = invoice?.status
  // Backend sendPlatformInvoice only rejects paid/void, so overdue invoices
  // can (and should) be re-sent from here too.
  const canSend =
    status === 'draft' || status === 'sent' || status === 'overdue'
  const canMarkPaid = status === 'sent' || status === 'overdue'
  const canVoid =
    status === 'draft' || status === 'sent' || status === 'overdue'

  const runAction = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await action()
      setVoidConfirmOpen(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Action failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleSend = () => {
    if (!invoiceId) return
    const emails = sendToOverride
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean)
    return runAction(() =>
      sendPlatformInvoice({
        invoiceId: invoiceId as Id<'platformInvoices'>,
        sendTo: emails.length > 0 ? emails : undefined,
      }),
    )
  }

  const handleMarkPaid = () => {
    if (!invoiceId) return
    return runAction(() =>
      markInvoicePaid({ invoiceId: invoiceId as Id<'platformInvoices'> }),
    )
  }

  const handleVoid = () => {
    if (!invoiceId) return
    return runAction(() =>
      voidInvoice({ invoiceId: invoiceId as Id<'platformInvoices'> }),
    )
  }

  const handleSyncStripe = () => {
    if (!invoiceId) return
    return runAction(() =>
      syncStripeInvoiceStatus({
        invoiceId: invoiceId as Id<'platformInvoices'>,
      }),
    )
  }

  const handleChargeViaStripe = () => {
    if (!invoiceId) return
    return runAction(() =>
      sendInvoiceWithStripe({
        invoiceId: invoiceId as Id<'platformInvoices'>,
      }),
    )
  }

  return (
    <PlatformGate>
      <div className="space-y-6">
        <Link
          to="/platform/billing"
          className="inline-flex items-center gap-2 text-sm text-[#9aa6a8] transition-colors hover:text-[#f5f7f6]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to billing
        </Link>

        {!invoice ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            Loading invoice…
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <h1 className="text-[26px] font-bold text-[#f5f7f6]">
                  {invoice.invoiceNumber}
                </h1>
                <p className="mt-1 text-sm text-[#687173]">
                  {invoice.tenantName} · {formatDateUS(invoice.periodStart)} –{' '}
                  {formatDateUS(invoice.periodEnd)} · due{' '}
                  {formatDateUS(invoice.dueDate)}
                </p>
              </div>
              <PlatformStatusPill status={invoice.status} />
            </div>

            {error && <p className="text-sm text-[#ef4444]">{error}</p>}

            <PlatformTable>
              <PlatformTableHead>
                <PlatformTableHeader>Description</PlatformTableHeader>
                <PlatformTableHeader>Qty</PlatformTableHeader>
                <PlatformTableHeader>Unit price</PlatformTableHeader>
                <PlatformTableHeader>Amount</PlatformTableHeader>
                <PlatformTableHeader>Source</PlatformTableHeader>
              </PlatformTableHead>
              <PlatformTableBody>
                {invoice.lineItems.map((item, index) => (
                  <PlatformTableRow key={index}>
                    <PlatformTableCell className="text-[#9aa6a8]">
                      {item.description}
                    </PlatformTableCell>
                    <PlatformTableCell>{item.quantity}</PlatformTableCell>
                    <PlatformTableCell>
                      {formatCurrency(item.unitPrice)}
                    </PlatformTableCell>
                    <PlatformTableCell>
                      {formatCurrency(item.amount)}
                    </PlatformTableCell>
                    <PlatformTableCell>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-[15px] px-3 py-1 text-[13px] font-semibold',
                          item.source === 'auto'
                            ? 'bg-[rgba(59,130,246,0.16)] text-[#3b82f6]'
                            : 'bg-[rgba(154,166,168,0.16)] text-[#9aa6a8]',
                        )}
                      >
                        {item.source}
                      </span>
                    </PlatformTableCell>
                  </PlatformTableRow>
                ))}
              </PlatformTableBody>
            </PlatformTable>

            <div className="space-y-1 text-right">
              <p className="text-sm text-[#9aa6a8]">
                Subtotal: {formatCurrency(invoice.subtotal)}
              </p>
              <p className="text-lg font-bold text-[#f5f7f6]">
                Total: {formatCurrency(invoice.total)}
              </p>
            </div>

            {(canSend || canMarkPaid || canVoid) && (
              <div className="rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
                <h2 className="text-lg font-bold text-[#f5f7f6]">Actions</h2>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  {canSend && (
                    <div className="flex min-w-[280px] flex-1 items-end gap-2">
                      <div className="flex-1">
                        <label className="mb-1.5 block text-sm font-medium text-[#9aa6a8]">
                          Send to override (optional, comma-separated)
                        </label>
                        <input
                          value={sendToOverride}
                          onChange={(e) => setSendToOverride(e.target.value)}
                          placeholder="Leave empty to use billing emails"
                          className={fieldClass}
                        />
                      </div>
                      <button
                        onClick={handleSend}
                        disabled={busy}
                        className={primaryButtonClass}
                      >
                        {busy
                          ? 'Working…'
                          : status === 'sent'
                            ? 'Resend'
                            : 'Send'}
                      </button>
                    </div>
                  )}
                  {canMarkPaid && (
                    <button
                      onClick={handleMarkPaid}
                      disabled={busy}
                      className={primaryButtonClass}
                    >
                      Mark as paid
                    </button>
                  )}
                  {!invoice.stripeInvoiceId &&
                    (status === 'sent' || status === 'overdue') && (
                      <button
                        onClick={handleChargeViaStripe}
                        disabled={busy}
                        className={ghostButtonClass}
                      >
                        Charge via Stripe
                      </button>
                    )}
                  {canVoid && (
                    <button
                      onClick={() => setVoidConfirmOpen(true)}
                      disabled={busy}
                      className={dangerButtonClass}
                    >
                      Void invoice
                    </button>
                  )}
                </div>
              </div>
            )}

            {invoice.stripeInvoiceId && (
              <div className="rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
                <h2 className="text-lg font-bold text-[#f5f7f6]">Stripe</h2>
                <p className="mt-2 text-sm text-[#9aa6a8]">
                  Stripe invoice: {invoice.stripeInvoiceId} · hosted payment
                  page{' '}
                  {invoice.stripeHostedInvoiceUrl ? 'available' : 'not yet available'}
                </p>
                {invoice.paymentMethod && (
                  <p className="mt-1 text-sm text-[#9aa6a8]">
                    Payment method: {invoice.paymentMethod}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  {invoice.stripeHostedInvoiceUrl && (
                    <a
                      href={invoice.stripeHostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={ghostButtonClass}
                    >
                      Open in Stripe
                    </a>
                  )}
                  <button
                    onClick={handleSyncStripe}
                    disabled={busy}
                    className={primaryButtonClass}
                  >
                    {busy ? 'Working…' : 'Sync with Stripe'}
                  </button>
                </div>
              </div>
            )}

            <div className="max-w-xl rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
              <h2 className="text-lg font-bold text-[#f5f7f6]">Details</h2>
              <div className="mt-3 divide-y divide-[#2a3437]">
                <MetaRow label="Created by" value={invoice.createdBy} />
                <MetaRow
                  label="Created at"
                  value={`${formatDateUS(invoice.createdAt)} ${formatTime(invoice.createdAt)}`}
                />
                <MetaRow
                  label="Sent at"
                  value={
                    invoice.sentAt
                      ? `${formatDateUS(invoice.sentAt)} ${formatTime(invoice.sentAt)}`
                      : '—'
                  }
                />
                <MetaRow
                  label="Sent to"
                  value={invoice.sentTo?.join(', ') || '—'}
                />
                <MetaRow
                  label="Paid at"
                  value={
                    invoice.paidAt
                      ? `${formatDateUS(invoice.paidAt)} ${formatTime(invoice.paidAt)}`
                      : '—'
                  }
                />
                <MetaRow label="Notes" value={invoice.notes || '—'} />
              </div>
            </div>
          </>
        )}

        <Dialog
          open={voidConfirmOpen}
          onClose={() => setVoidConfirmOpen(false)}
          className="border-[#2a3437] bg-[#151b1d]"
        >
          <div className="border-b border-[#2a3437] px-6 py-5">
            <h3 className="text-lg font-bold text-[#f5f7f6]">Void invoice</h3>
          </div>
          <div className="p-6">
            <p className="text-[15px] text-[#9aa6a8]">
              Void {invoice?.invoiceNumber ?? 'this invoice'}? This cannot be
              undone.
            </p>
            {error && <p className="mt-3 text-sm text-[#ef4444]">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#2a3437] px-6 py-5">
            <button
              onClick={() => setVoidConfirmOpen(false)}
              className={ghostButtonClass}
            >
              Cancel
            </button>
            <button
              onClick={handleVoid}
              disabled={busy}
              className={dangerButtonClass}
            >
              {busy ? 'Working…' : 'Void invoice'}
            </button>
          </div>
        </Dialog>
      </div>
    </PlatformGate>
  )
}
