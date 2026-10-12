import { useOrganization } from '@clerk/react'
import { useConvex, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { USDateInput } from '@/shared/ui/USDateInput'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { AppLoader } from '@/shared/ui/AppLoader'
import { generatePaymentCalendarPdf } from '../pdf/paymentCalendarPdf'
import { saveAndDownload } from '@/features/onboarding/pdf/generatePrefilledPdf'
import { downloadCsv } from '@/shared/lib/downloadCsv'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { ClientInvoicePanel } from '../components/ClientInvoicePanel'
import { CollapsibleCard } from '../components/CollapsibleCard'
import { BillingLinesTable } from '../components/BillingLinesTable'
import { EmptyBillingState } from '../components/EmptyBillingState'
import { EvidenceLineageDialog } from '../components/EvidenceLineageDialog'
import { InvoicesTable } from '../components/InvoicesTable'
import {
  buildInvoiceCsv,
  buildInvoicePdf,
  summarizeLines,
  type BillingLineRow,
  type InvoiceDetails,
  type InvoiceRow,
} from '../model/invoiceUtils'

export function BillingPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const convex = useConvex()
  const readyLines = useQuery(
    api.billing.unexported,
    clerkOrgId ? { clerkOrgId } : 'skip',
  ) as BillingLineRow[] | undefined
  const ledger = useQuery(
    api.billing.ledger,
    clerkOrgId ? { clerkOrgId } : 'skip',
  ) as BillingLineRow[] | undefined
  const invoices = useQuery(
    api.billing.invoices,
    clerkOrgId ? { clerkOrgId } : 'skip',
  ) as InvoiceRow[] | undefined

  const [downloadInvoiceId, setDownloadInvoiceId] =
    useState<Id<'exportBatches'> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [evidenceLineId, setEvidenceLineId] = useState<Id<'billingLines'> | null>(
    null,
  )
  const [ledgerFrom, setLedgerFrom] = useState('')
  const [ledgerTo, setLedgerTo] = useState('')
  // Billing archive filter: view the ledger by scheduled-date range.
  const visibleLedgerLines = useMemo(
    () =>
      (ledger ?? []).filter((line) => {
        const date = line.scheduledStart.slice(0, 10)
        if (ledgerFrom && date < ledgerFrom) return false
        if (ledgerTo && date > ledgerTo) return false
        return true
      }),
    [ledger, ledgerFrom, ledgerTo],
  )
  const [evidenceStart, setEvidenceStart] = useState('')
  const [evidenceEnd, setEvidenceEnd] = useState('')
  const [isExportingEvidence, setIsExportingEvidence] = useState(false)
  const downloadedInvoiceIdRef = useRef<string | null>(null)
  const pdfDownloadRef = useRef<Id<'exportBatches'> | null>(null)
  const csvDownloadRef = useRef<Id<'exportBatches'> | null>(null)

  const invoiceDetails = useQuery(
    api.billing.invoiceDetails,
    clerkOrgId && downloadInvoiceId
      ? { clerkOrgId, invoiceId: downloadInvoiceId }
      : 'skip',
  ) as InvoiceDetails | undefined

  const readySummary = summarizeLines(readyLines ?? [])

  useEffect(() => {
    if (!invoiceDetails || !downloadInvoiceId) return
    // CSV download path (explicitly requested via CSV button)
    if (csvDownloadRef.current === downloadInvoiceId) {
      downloadCsv(
        `${invoiceDetails.invoice.invoiceNumber}.csv`,
        buildInvoiceCsv(invoiceDetails),
      )
      csvDownloadRef.current = null
      downloadedInvoiceIdRef.current = downloadInvoiceId
      return
    }
    // PDF download path (explicitly requested via PDF button)
    if (pdfDownloadRef.current === downloadInvoiceId) {
      const blob = buildInvoicePdf(invoiceDetails, organization?.name ?? 'Agency')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoiceDetails.invoice.invoiceNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      pdfDownloadRef.current = null
      downloadedInvoiceIdRef.current = downloadInvoiceId
      return
    }
    // Default: PDF download for newly created invoices
    if (downloadedInvoiceIdRef.current === downloadInvoiceId) return
    const blob = buildInvoicePdf(invoiceDetails, organization?.name ?? 'Agency')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoiceDetails.invoice.invoiceNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    downloadedInvoiceIdRef.current = downloadInvoiceId
  }, [downloadInvoiceId, invoiceDetails, organization?.name])

  if (!readyLines || !ledger || !invoices) {
    return <AppLoader label="Loading billing workspace" />
  }

  /** Downloads the consolidated per-client payment calendar PDF for a month. */
  const downloadClientCalendar = async (
    clientId: Id<'clients'>,
    month: string,
  ) => {
    if (!clerkOrgId) return
    const data = await convex.query(api.billing.paymentCalendarData, {
      clerkOrgId,
      clientId,
      month,
    })
    const bytes = await generatePaymentCalendarPdf({
      clientName: data.clientName,
      caregiverNames: data.caregiverNames,
      month,
      days: data.days,
    })
    saveAndDownload(bytes, `payment-calendar-${data.clientName}-${month}.pdf`)
  }

  const handleInvoiceCalendarDownload = async (invoice: InvoiceRow) => {
    if (!invoice.clientId || !invoice.periodStart) return
    setError(null)
    try {
      await downloadClientCalendar(
        invoice.clientId,
        invoice.periodStart.slice(0, 7),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Could not generate the calendar.',
      )
    }
  }

  const handleEvidenceExport = async () => {
    if (!clerkOrgId) return
    setIsExportingEvidence(true)
    setError(null)
    try {
      const csv = await convex.query(api.evidence.exportEvidenceCsv, {
        clerkOrgId,
        ...(evidenceStart ? { startDate: evidenceStart } : {}),
        ...(evidenceEnd ? { endDate: evidenceEnd } : {}),
      })
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(`evidence-lineage-${date}.csv`, csv)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Evidence export failed.',
      )
    } finally {
      setIsExportingEvidence(false)
    }
  }

  const requestInvoiceDownload = (id: Id<'exportBatches'>) => {    downloadedInvoiceIdRef.current = null
    if (invoiceDetails?.invoice._id === id) {
      downloadCsv(
        `${invoiceDetails.invoice.invoiceNumber}.csv`,
        buildInvoiceCsv(invoiceDetails),
      )
      downloadedInvoiceIdRef.current = id
      return
    }
    csvDownloadRef.current = id  // mark as CSV download request
    setDownloadInvoiceId(id)
  }

  const requestInvoicePdfDownload = (id: Id<'exportBatches'>) => {
    if (invoiceDetails?.invoice._id === id) {
      const blob = buildInvoicePdf(invoiceDetails, organization?.name ?? 'Agency')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoiceDetails.invoice.invoiceNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return
    }
    // Need to load invoice details first — set downloadInvoiceId,
    // then the useEffect will fire for CSV. For PDF, we need a separate
    // ref to track PDF download intent.
    setDownloadInvoiceId(id)
    pdfDownloadRef.current = id
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-atria-ink">Billing</h1>
          <p className="text-sm text-atria-muted">
            Invoices are created per client — pick the client(s) and every
            unbilled line in the period is included automatically.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 text-sm lg:min-w-[180px]">
          <SummaryTile
            label="Ready"
            value={`$${readySummary.amount.toFixed(2)}`}
          />
        </div>
      </div>

      <CollapsibleCard
        title="Ready to bill"
        defaultOpen
        badge={
          <span className="text-xs text-atria-muted">
            {readyLines.length} unbilled line(s)
          </span>
        }
      >
        <ClientInvoicePanel
          clerkOrgId={clerkOrgId}
          lines={readyLines}
          onDownloadCalendar={downloadClientCalendar}
        />
      </CollapsibleCard>

      <CollapsibleCard
        title="Invoices"
        defaultOpen
        badge={
          <span className="text-xs text-atria-muted">
            {(invoices ?? []).length} invoice(s)
          </span>
        }
      >
        {error && <p className="mb-2 text-sm text-atria-danger">{error}</p>}
        <InvoicesTable invoices={invoices} onDownload={requestInvoiceDownload} onDownloadPdf={requestInvoicePdfDownload} onDownloadCalendar={handleInvoiceCalendarDownload} />
      </CollapsibleCard>

      <CollapsibleCard title="Payment calendars">
        <PaymentCalendarCard clerkOrgId={clerkOrgId} bare />
      </CollapsibleCard>

      <CollapsibleCard
        title="Billing Line Ledger"
        badge={
          <span className="text-xs text-atria-muted">
            {visibleLedgerLines.length} of {(ledger ?? []).length} lines
          </span>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <FieldGroup label="Archive from" htmlFor="ledgerFrom">
              <USDateInput
                id="ledgerFrom"
                value={ledgerFrom}
                onChange={setLedgerFrom}
              />
            </FieldGroup>
            <FieldGroup label="Archive to" htmlFor="ledgerTo">
              <USDateInput
                id="ledgerTo"
                value={ledgerTo}
                onChange={setLedgerTo}
              />
            </FieldGroup>
            {(ledgerFrom || ledgerTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLedgerFrom('')
                  setLedgerTo('')
                }}
              >
                Clear
              </Button>
            )}
            <FieldGroup label="Evidence from" htmlFor="evidenceStart">
              <USDateInput
                id="evidenceStart"
                value={evidenceStart}
                onChange={setEvidenceStart}
              />
            </FieldGroup>
            <FieldGroup label="Evidence to" htmlFor="evidenceEnd">
              <USDateInput
                id="evidenceEnd"
                value={evidenceEnd}
                onChange={setEvidenceEnd}
              />
            </FieldGroup>
            <Button
              variant="secondary"
              size="sm"
              disabled={isExportingEvidence}
              onClick={handleEvidenceExport}
            >
              {isExportingEvidence ? 'Preparing…' : 'Download evidence CSV'}
            </Button>
          </div>
          {ledger.length === 0 ? (
            <EmptyBillingState
              title="No billing history"
              detail="Approved shifts and created invoices will appear here."
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-xs text-atria-text-secondary">
                {(['SLS', 'ILS'] as const).map((type) => {
                  const typeLines = visibleLedgerLines.filter(
                    (line) => line.serviceType === type,
                  )
                  if (typeLines.length === 0) return null
                  const hours = typeLines.reduce((sum, line) => sum + line.hours, 0)
                  const amount = typeLines.reduce((sum, line) => sum + line.amount, 0)
                  return (
                    <span
                      key={type}
                      className="rounded-full border border-atria-border bg-atria-surface px-2.5 py-1"
                    >
                      {type}: {hours}h · ${amount.toFixed(2)} ({typeLines.length}{' '}
                      lines)
                    </span>
                  )
                })}
              </div>
              <BillingLinesTable
                lines={visibleLedgerLines}
                showStatus
                onViewEvidence={(line) => setEvidenceLineId(line._id)}
              />
            </>
          )}
        </div>
      </CollapsibleCard>

      <EvidenceLineageDialog
        billingLineId={evidenceLineId}
        onClose={() => setEvidenceLineId(null)}
      />

    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-atria-border bg-atria-surface px-3 py-2">
      <div className="text-xs text-atria-muted">{label}</div>
      <div className="text-base font-semibold text-atria-ink">{value}</div>
    </div>
  )
}

/** Per client-month printable payment calendar with ALL caregivers (billing support doc). */
function PaymentCalendarCard({ clerkOrgId, bare }: { clerkOrgId?: string; bare?: boolean }) {
  const convex = useConvex()
  const clients = useQuery(
    api.clients.list,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const [clientId, setClientId] = useState('')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleDownload = async () => {
    if (!clerkOrgId || !clientId || !month) return
    setBusy(true)
    setError('')
    try {
      const data = await convex.query(api.billing.paymentCalendarData, {
        clerkOrgId,
        clientId: clientId as Id<'clients'>,
        month,
      })
      const bytes = await generatePaymentCalendarPdf({
        clientName: data.clientName,
        caregiverNames: data.caregiverNames,
        month,
        days: data.days,
      })
      saveAndDownload(bytes, `payment-calendar-${data.clientName}-${month}.pdf`)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Could not generate the calendar.',
      )
    } finally {
      setBusy(false)
    }
  }

  const Wrapper = bare ? 'div' : Card
  return (
    <Wrapper>
      {!bare && (
        <CardHeader>
          <CardTitle>Payment calendars</CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        <p className="text-sm text-atria-text-secondary">
          One printable month calendar per client with every caregiver's worked
          days (initials per day cell), hours and total — ready to attach to
          billing.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <FieldGroup label="Client" htmlFor="calClient">
            <Select
              id="calClient"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-52"
            >
              <option value="">Select client…</option>
              {(clients ?? []).map((client: { _id: string; displayName: string }) => (
                <option key={client._id} value={client._id}>
                  {client.displayName}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="Month" htmlFor="calMonth">
            <Input
              id="calMonth"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </FieldGroup>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            disabled={busy || !clientId || !month}
          >
            {busy ? 'Generating…' : 'Download calendar PDF'}
          </Button>
          {error && <p className="text-sm text-atria-danger">{error}</p>}
        </div>
      </CardContent>
    </Wrapper>
  )
}
