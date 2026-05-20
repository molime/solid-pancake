import { useOrganization } from '@clerk/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Separator } from '@/shared/ui/Separator'
import { AppLoader } from '@/shared/ui/AppLoader'
import { BillingInvoicePanel } from '../components/BillingInvoicePanel'
import { BillingLinesTable } from '../components/BillingLinesTable'
import { EmptyBillingState } from '../components/EmptyBillingState'
import { InvoicesTable } from '../components/InvoicesTable'
import {
  buildInvoiceCsv,
  defaultInvoiceName,
  filterBillingLines,
  summarizeLines,
  type BillingFilters,
  type BillingLineRow,
  type InvoiceDetails,
  type InvoiceRow,
} from '../model/invoiceUtils'

export function BillingPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
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
  const createInvoice = useMutation(api.billing.createInvoice)

  const [invoiceName, setInvoiceName] = useState('')
  const [selectedLineIds, setSelectedLineIds] = useState<Id<'billingLines'>[]>(
    [],
  )
  const [filters, setFilters] = useState<BillingFilters>({
    caregiverId: '',
    periodStart: '',
    periodEnd: '',
  })
  const [downloadInvoiceId, setDownloadInvoiceId] =
    useState<Id<'exportBatches'> | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const downloadedInvoiceIdRef = useRef<string | null>(null)

  const invoiceDetails = useQuery(
    api.billing.invoiceDetails,
    clerkOrgId && downloadInvoiceId
      ? { clerkOrgId, invoiceId: downloadInvoiceId }
      : 'skip',
  ) as InvoiceDetails | undefined

  const filteredLines = useMemo(
    () => filterBillingLines(readyLines ?? [], filters),
    [readyLines, filters],
  )
  const visibleIds = useMemo(
    () => new Set(filteredLines.map((line) => line._id)),
    [filteredLines],
  )
  const visibleSelectedLineIds = useMemo(
    () => selectedLineIds.filter((id) => visibleIds.has(id)),
    [selectedLineIds, visibleIds],
  )
  const selectedLines = useMemo(
    () =>
      filteredLines.filter((line) => visibleSelectedLineIds.includes(line._id)),
    [filteredLines, visibleSelectedLineIds],
  )
  const selectedSummary = summarizeLines(selectedLines)
  const readySummary = summarizeLines(readyLines ?? [])

  useEffect(() => {
    if (!invoiceDetails || !downloadInvoiceId) return
    if (downloadedInvoiceIdRef.current === downloadInvoiceId) return
    downloadCsv(
      `${invoiceDetails.invoice.invoiceNumber}.csv`,
      buildInvoiceCsv(invoiceDetails),
    )
    downloadedInvoiceIdRef.current = downloadInvoiceId
  }, [downloadInvoiceId, invoiceDetails])

  if (!readyLines || !ledger || !invoices) {
    return <AppLoader label="Loading billing workspace" />
  }

  const caregivers = Array.from(
    new Map(
      readyLines
        .filter((line) => line.caregiverId)
        .map((line) => [
          line.caregiverId,
          line.caregiverEmail || line.caregiverName,
        ]),
    ).entries(),
  )

  const toggleLine = (id: Id<'billingLines'>) => {
    setSelectedLineIds((current) =>
      current.includes(id)
        ? current.filter((lineId) => lineId !== id)
        : [...current, id],
    )
  }

  const handleCreateInvoice = async () => {
    if (!clerkOrgId || visibleSelectedLineIds.length === 0) return
    setIsCreating(true)
    setError(null)
    setMessage(null)
    try {
      const id = (await createInvoice({
        clerkOrgId,
        name: invoiceName.trim() || defaultInvoiceName(selectedLines, filters),
        lineIds: visibleSelectedLineIds,
        periodStart: filters.periodStart || undefined,
        periodEnd: filters.periodEnd || undefined,
        caregiverId: filters.caregiverId || undefined,
      })) as Id<'exportBatches'>

      setSelectedLineIds([])
      setInvoiceName('')
      setDownloadInvoiceId(id)
      setMessage(
        `Created invoice for ${visibleSelectedLineIds.length} billing line(s).`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invoice creation failed.')
    } finally {
      setIsCreating(false)
    }
  }

  const requestInvoiceDownload = (id: Id<'exportBatches'>) => {
    downloadedInvoiceIdRef.current = null
    if (invoiceDetails?.invoice._id === id) {
      downloadCsv(
        `${invoiceDetails.invoice.invoiceNumber}.csv`,
        buildInvoiceCsv(invoiceDetails),
      )
      downloadedInvoiceIdRef.current = id
      return
    }
    setDownloadInvoiceId(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-atria-ink">Billing</h1>
          <p className="text-sm text-atria-muted">
            Create invoices only from approved, documented shifts.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm lg:min-w-[360px]">
          <SummaryTile
            label="Ready"
            value={`$${readySummary.amount.toFixed(2)}`}
          />
          <SummaryTile
            label="Selected"
            value={`$${selectedSummary.amount.toFixed(2)}`}
          />
        </div>
      </div>

      <BillingInvoicePanel
        caregivers={caregivers}
        filters={filters}
        invoiceName={invoiceName}
        lines={filteredLines}
        selectedLineIds={visibleSelectedLineIds}
        isCreating={isCreating}
        error={error}
        message={message}
        onFiltersChange={setFilters}
        onInvoiceNameChange={setInvoiceName}
        onToggleLine={toggleLine}
        onToggleAll={(checked) =>
          setSelectedLineIds(
            checked ? filteredLines.map((line) => line._id) : [],
          )
        }
        onCreateInvoice={handleCreateInvoice}
      />

      <InvoicesTable invoices={invoices} onDownload={requestInvoiceDownload} />

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Billing Line Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <EmptyBillingState
              title="No billing history"
              detail="Approved shifts and created invoices will appear here."
            />
          ) : (
            <BillingLinesTable lines={ledger} showStatus />
          )}
        </CardContent>
      </Card>
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

function downloadCsv(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
