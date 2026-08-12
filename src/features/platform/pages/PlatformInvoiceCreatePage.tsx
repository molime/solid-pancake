import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { formatCurrency, formatDateUS } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { cn } from '@/shared/lib/cn'
import { usePlatformAdmin } from '../usePlatformAdmin'
import { PlatformGate } from '../components/PlatformGate'
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

const ghostButtonClass =
  'rounded-lg border border-[#2a3437] px-4 py-2 text-sm font-medium text-[#9aa6a8] transition-colors hover:text-[#f5f7f6]'

type LineItem = {
  description: string
  quantity: number
  unitPrice: number
  amount: number
  source: 'auto' | 'manual'
}

type InvoicePreview = {
  lineItems: LineItem[]
  seats: number
  plan: {
    key: string
    label: string
    basePrice: number
    includedSeats: number
    perSeatPrice: number
  }
  subtotal: number
  total: number
  billingEmails: string[]
}

type ManualRow = {
  description: string
  quantity: string
  unitPrice: string
}

const STEPS = ['Agency', 'Period', 'Line items', 'Review']

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function toDateInputValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function defaultPeriod() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  const due = new Date(end)
  due.setDate(due.getDate() + 14)
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
    due: toDateInputValue(due),
  }
}

// Auto-mode preview section. Remounted (via key) when the admin clicks
// Recalculate; reports the loaded preview up so step 4 can render it.
function AutoPreviewSection({
  tenantId,
  periodStart,
  periodEnd,
  onPreview,
}: {
  tenantId: Id<'tenants'>
  periodStart: string
  periodEnd: string
  onPreview: (preview: InvoicePreview | null) => void
}) {
  const preview = useQuery(api.platform.calculateInvoicePreview, {
    tenantId,
    periodStart,
    periodEnd,
  })

  useEffect(() => {
    onPreview(preview ?? null)
  }, [preview, onPreview])

  if (!preview) {
    return (
      <p className="py-8 text-center text-sm text-[#9aa6a8]">
        Calculating preview…
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#9aa6a8]">
        {preview.plan.label} plan · {preview.seats} active seats ·{' '}
        {preview.plan.includedSeats} included
      </p>
      <PlatformTable>
        <PlatformTableHead>
          <PlatformTableHeader>Description</PlatformTableHeader>
          <PlatformTableHeader>Qty</PlatformTableHeader>
          <PlatformTableHeader>Unit price</PlatformTableHeader>
          <PlatformTableHeader>Amount</PlatformTableHeader>
        </PlatformTableHead>
        <PlatformTableBody>
          {preview.lineItems.map((item, index) => (
            <PlatformTableRow key={index}>
              <PlatformTableCell className="text-[#9aa6a8]">
                {item.description}
              </PlatformTableCell>
              <PlatformTableCell>{item.quantity}</PlatformTableCell>
              <PlatformTableCell>
                {formatCurrency(item.unitPrice)}
              </PlatformTableCell>
              <PlatformTableCell>{formatCurrency(item.amount)}</PlatformTableCell>
            </PlatformTableRow>
          ))}
        </PlatformTableBody>
      </PlatformTable>
      <p className="text-right text-[15px] font-semibold text-[#f5f7f6]">
        Total: {formatCurrency(preview.total)}
      </p>
    </div>
  )
}

export function PlatformInvoiceCreatePage() {
  const isAdmin = usePlatformAdmin()
  const navigate = useNavigate()
  const tenants = useQuery(
    api.platform.listTenantsWithUsage,
    isAdmin ? {} : 'skip',
  )
  const createPlatformInvoice = useMutation(api.platform.createPlatformInvoice)

  const [step, setStep] = useState(1)
  const [tenantId, setTenantId] = useState('')
  const [period, setPeriod] = useState(defaultPeriod)
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [manualRows, setManualRows] = useState<ManualRow[]>([
    { description: '', quantity: '1', unitPrice: '0' },
  ])
  const [preview, setPreview] = useState<InvoicePreview | null>(null)
  const [previewNonce, setPreviewNonce] = useState(0)
  const [sendToInput, setSendToInput] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const subscription = useQuery(
    api.platform.getTenantSubscription,
    isAdmin && tenantId ? { tenantId: tenantId as Id<'tenants'> } : 'skip',
  )

  const handlePreview = useCallback((value: InvoicePreview | null) => {
    setPreview(value)
  }, [])

  // Clear the auto-mode preview whenever the agency or period changes so a
  // stale preview from a previous selection can't pass the Continue gate.
  const handleTenantChange = (value: string) => {
    setTenantId(value)
    setPreview(null)
  }

  const handlePeriodChange = (
    field: 'start' | 'end' | 'due',
    value: string,
  ) => {
    setPeriod((p) => ({ ...p, [field]: value }))
    setPreview(null)
  }

  const selectedTenant = tenants?.find((t) => t._id === tenantId)

  const manualItems: LineItem[] = manualRows
    .filter((row) => row.description.trim())
    .map((row) => {
      const quantity = Number(row.quantity) || 0
      const unitPrice = Number(row.unitPrice) || 0
      return {
        description: row.description.trim(),
        quantity,
        unitPrice,
        amount: round2(quantity * unitPrice),
        source: 'manual' as const,
      }
    })

  const reviewItems = mode === 'auto' ? (preview?.lineItems ?? []) : manualItems
  const reviewTotal = round2(
    reviewItems.reduce((sum, item) => sum + item.amount, 0),
  )

  const canContinue =
    (step === 1 && !!tenantId) ||
    (step === 2 &&
      !!period.start &&
      !!period.end &&
      !!period.due &&
      period.start <= period.end) ||
    (step === 3 &&
      (mode === 'auto' ? preview !== null : manualItems.length > 0))

  const goNext = () => {
    setError('')
    if (step === 3 && sendToInput === '') {
      const emails =
        mode === 'auto'
          ? (preview?.billingEmails ?? [])
          : (subscription?.subscription?.billingEmails ?? [])
      setSendToInput(emails.join(', '))
    }
    setStep((s) => Math.min(4, s + 1))
  }

  const handleCreate = async (sendImmediately: boolean) => {
    if (!tenantId) return
    const emails = sendToInput
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean)
    if (sendImmediately && emails.length === 0) {
      setError('Add at least one recipient email to send the invoice.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const invoiceId = await createPlatformInvoice({
        tenantId: tenantId as Id<'tenants'>,
        periodStart: period.start,
        periodEnd: period.end,
        dueDate: period.due,
        mode,
        lineItems:
          mode === 'manual'
            ? manualItems.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: item.amount,
              }))
            : undefined,
        sendTo: emails.length > 0 ? emails : undefined,
        notes: notes.trim() || undefined,
        sendImmediately,
        chargeViaStripe: true,
      })
      navigate(`/platform/billing/${invoiceId}`)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to create invoice.',
      )
      setBusy(false)
    }
  }

  const updateManualRow = (
    index: number,
    field: keyof ManualRow,
    value: string,
  ) => {
    setManualRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
  }

  return (
    <PlatformGate>
      <div className="space-y-6">
        <button
          onClick={() => navigate('/platform/billing')}
          className="inline-flex items-center gap-2 text-sm text-[#9aa6a8] transition-colors hover:text-[#f5f7f6]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to billing
        </button>

        <h1 className="text-[26px] font-bold text-[#f5f7f6]">
          Create Invoice
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          {STEPS.map((label, index) => {
            const number = index + 1
            const active = step === number
            const done = step > number
            return (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold',
                    active || done
                      ? 'bg-[rgba(34,197,94,0.16)] text-[#22c55e]'
                      : 'bg-[#1e2629] text-[#687173]',
                  )}
                >
                  {number}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    active ? 'text-[#f5f7f6]' : 'text-[#687173]',
                  )}
                >
                  {label}
                </span>
                {number < STEPS.length && (
                  <span className="mx-1 h-px w-6 bg-[#2a3437]" />
                )}
              </div>
            )
          })}
        </div>

        <div className="rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
          {step === 1 && (
            <div className="max-w-xl space-y-4">
              <h2 className="text-lg font-bold text-[#f5f7f6]">
                Select agency
              </h2>
              {!tenants ? (
                <p className="py-8 text-center text-sm text-[#9aa6a8]">
                  Loading agencies…
                </p>
              ) : (
                <select
                  value={tenantId}
                  onChange={(e) => handleTenantChange(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select an agency…</option>
                  {tenants.map((tenant) => (
                    <option key={tenant._id} value={tenant._id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="max-w-xl space-y-4">
              <h2 className="text-lg font-bold text-[#f5f7f6]">
                Billing period
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#9aa6a8]">
                    Period start
                  </label>
                  <input
                    type="date"
                    value={period.start}
                    onChange={(e) =>
                      handlePeriodChange('start', e.target.value)
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#9aa6a8]">
                    Period end
                  </label>
                  <input
                    type="date"
                    value={period.end}
                    onChange={(e) =>
                      handlePeriodChange('end', e.target.value)
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#9aa6a8]">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={period.due}
                    onChange={(e) =>
                      handlePeriodChange('due', e.target.value)
                    }
                    className={fieldClass}
                  />
                </div>
              </div>
              <p className="text-sm text-[#687173]">
                Defaults to the previous calendar month, due 14 days after
                period end.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-[#f5f7f6]">Line items</h2>
                <div className="flex gap-2">
                  {(['auto', 'manual'] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => setMode(value)}
                      className={cn(
                        'rounded-[15px] px-3 py-1 text-[13px] font-semibold transition-colors',
                        mode === value
                          ? 'bg-[rgba(34,197,94,0.16)] text-[#22c55e]'
                          : 'bg-[#1e2629] text-[#9aa6a8] hover:text-[#f5f7f6]',
                      )}
                    >
                      {value === 'auto' ? 'Auto' : 'Manual'}
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'auto' ? (
                // calculateInvoicePreview throws for tenants without an
                // active subscription, which would bubble to the app-level
                // error boundary — gate the preview on the subscription
                // query (already loaded above) and show an inline message.
                !subscription || !subscription.subscription ||
                !subscription.plan?.active ? (
                  <p className="rounded-lg border border-[#2a3437] bg-[#1e2629] px-4 py-6 text-center text-sm text-[#9aa6a8]">
                    {subscription
                      ? 'This agency has no active subscription, so auto-calculation is unavailable. Switch to Manual mode or set up a subscription first.'
                      : 'Loading subscription…'}
                  </p>
                ) : (
                  <>
                    <AutoPreviewSection
                      key={previewNonce}
                      tenantId={tenantId as Id<'tenants'>}
                      periodStart={period.start}
                      periodEnd={period.end}
                      onPreview={handlePreview}
                    />
                    <button
                      onClick={() => setPreviewNonce((n) => n + 1)}
                      className={ghostButtonClass}
                    >
                      Recalculate
                    </button>
                  </>
                )
              ) : (
                <div className="space-y-3">
                  {manualRows.map((row, index) => (
                    <div
                      key={index}
                      className="grid gap-3 sm:grid-cols-[1fr_100px_140px_120px_40px]"
                    >
                      <input
                        value={row.description}
                        onChange={(e) =>
                          updateManualRow(index, 'description', e.target.value)
                        }
                        placeholder="Description"
                        className={fieldClass}
                      />
                      <input
                        type="number"
                        min="0"
                        value={row.quantity}
                        onChange={(e) =>
                          updateManualRow(index, 'quantity', e.target.value)
                        }
                        placeholder="Qty"
                        className={fieldClass}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unitPrice}
                        onChange={(e) =>
                          updateManualRow(index, 'unitPrice', e.target.value)
                        }
                        placeholder="Unit price"
                        className={fieldClass}
                      />
                      <div className="flex items-center text-[15px] text-[#f5f7f6]">
                        {formatCurrency(
                          round2(
                            (Number(row.quantity) || 0) *
                              (Number(row.unitPrice) || 0),
                          ),
                        )}
                      </div>
                      <button
                        onClick={() =>
                          setManualRows((rows) =>
                            rows.filter((_, i) => i !== index),
                          )
                        }
                        disabled={manualRows.length === 1}
                        className="flex items-center justify-center text-[#9aa6a8] transition-colors hover:text-[#ef4444] disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setManualRows((rows) => [
                        ...rows,
                        { description: '', quantity: '1', unitPrice: '0' },
                      ])
                    }
                    className="flex items-center gap-2 text-sm font-medium text-[#22c55e] hover:underline"
                  >
                    <Plus className="h-4 w-4" />
                    Add row
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#f5f7f6]">Review</h2>
              <p className="text-sm text-[#9aa6a8]">
                {selectedTenant?.name ?? '—'} ·{' '}
                {formatDateUS(period.start)} – {formatDateUS(period.end)} · due{' '}
                {formatDateUS(period.due)}
              </p>

              <PlatformTable>
                <PlatformTableHead>
                  <PlatformTableHeader>Description</PlatformTableHeader>
                  <PlatformTableHeader>Qty</PlatformTableHeader>
                  <PlatformTableHeader>Unit price</PlatformTableHeader>
                  <PlatformTableHeader>Amount</PlatformTableHeader>
                </PlatformTableHead>
                <PlatformTableBody>
                  {reviewItems.map((item, index) => (
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
                    </PlatformTableRow>
                  ))}
                </PlatformTableBody>
              </PlatformTable>

              <div className="space-y-1 text-right">
                <p className="text-sm text-[#9aa6a8]">
                  Subtotal: {formatCurrency(reviewTotal)}
                </p>
                <p className="text-[15px] font-semibold text-[#f5f7f6]">
                  Total: {formatCurrency(reviewTotal)}
                </p>
              </div>

              <div className="max-w-xl space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#9aa6a8]">
                    Send to (comma-separated emails)
                  </label>
                  <input
                    value={sendToInput}
                    onChange={(e) => setSendToInput(e.target.value)}
                    placeholder="billing@agency.com, owner@agency.com"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#9aa6a8]">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className={fieldClass}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-[#ef4444]">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || busy}
            className={ghostButtonClass}
          >
            Back
          </button>
          {step < 4 ? (
            <button
              onClick={goNext}
              disabled={!canContinue}
              className={primaryButtonClass}
            >
              Continue
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => handleCreate(false)}
                disabled={busy}
                className={ghostButtonClass}
              >
                {busy ? 'Saving…' : 'Save as Draft'}
              </button>
              <button
                onClick={() => handleCreate(true)}
                disabled={busy}
                className={primaryButtonClass}
              >
                {busy ? 'Creating…' : 'Create & Send'}
              </button>
            </div>
          )}
        </div>
      </div>
    </PlatformGate>
  )
}
