import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { ReceiptText } from 'lucide-react'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { BillingFilters, BillingLineRow } from '../model/invoiceUtils'
import { BillingLinesTable } from './BillingLinesTable'
import { EmptyBillingState } from './EmptyBillingState'

interface BillingInvoicePanelProps {
  caregivers: Array<[string, string]>
  filters: BillingFilters
  invoiceName: string
  lines: BillingLineRow[]
  selectedLineIds: Id<'billingLines'>[]
  isCreating: boolean
  error: string | null
  message: string | null
  onFiltersChange: (filters: BillingFilters) => void
  onInvoiceNameChange: (value: string) => void
  onToggleLine: (id: Id<'billingLines'>) => void
  onToggleAll: (checked: boolean) => void
  onCreateInvoice: () => void
}

export function BillingInvoicePanel({
  caregivers,
  filters,
  invoiceName,
  lines,
  selectedLineIds,
  isCreating,
  error,
  message,
  onFiltersChange,
  onInvoiceNameChange,
  onToggleLine,
  onToggleAll,
  onCreateInvoice,
}: BillingInvoicePanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Ready to Invoice</CardTitle>
            <p className="mt-1 text-xs text-atria-muted">
              Filter by caregiver and service date, select billing lines, then
              create a downloadable invoice.
            </p>
          </div>
          <ReceiptText className="h-5 w-5 text-atria-accent" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr_auto]">
          <Select
            value={filters.caregiverId}
            onChange={(event) =>
              onFiltersChange({ ...filters, caregiverId: event.target.value })
            }
          >
            <option value="">All caregivers</option>
            {caregivers.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={filters.periodStart}
            onChange={(event) =>
              onFiltersChange({ ...filters, periodStart: event.target.value })
            }
            aria-label="Invoice period start"
          />
          <Input
            type="date"
            value={filters.periodEnd}
            onChange={(event) =>
              onFiltersChange({ ...filters, periodEnd: event.target.value })
            }
            aria-label="Invoice period end"
          />
          <Input
            value={invoiceName}
            onChange={(event) => onInvoiceNameChange(event.target.value)}
            placeholder="Invoice name"
          />
          <Button
            variant="primary"
            disabled={selectedLineIds.length === 0 || isCreating}
            onClick={onCreateInvoice}
          >
            <ReceiptText className="h-4 w-4" />
            {isCreating ? 'Creating...' : `Create (${selectedLineIds.length})`}
          </Button>
        </div>

        {error && (
          <div className="rounded-md bg-atria-danger-bg px-3 py-2 text-sm text-atria-danger">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-md bg-atria-success-bg px-3 py-2 text-sm text-atria-success">
            {message}
          </div>
        )}

        {lines.length === 0 ? (
          <EmptyBillingState
            title="No billing lines match"
            detail="Approved shifts appear here after coordinator review."
          />
        ) : (
          <BillingLinesTable
            lines={lines}
            selectedIds={selectedLineIds}
            onToggleLine={onToggleLine}
            onToggleAll={onToggleAll}
            selectable
          />
        )}
      </CardContent>
    </Card>
  )
}
