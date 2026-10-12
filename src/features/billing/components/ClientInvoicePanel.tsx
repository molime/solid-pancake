import { useMemo, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { USDateInput } from '@/shared/ui/USDateInput'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { currentMonth, monthRange, type BillingLineRow } from '../model/invoiceUtils'

type ClientGroup = {
  clientId: Id<'clients'>
  clientName: string
  lineCount: number
  amount: number
}

/**
 * Client-first invoicing (client request, 2026-10-12): the admin picks the
 * client(s) — never individual caregiver×client lines — and every unbilled
 * line for each selected client in the period lands in that client's
 * invoice automatically, so nothing can be missed. Monthly is the default
 * period; a custom range is available when needed. Each created invoice
 * also triggers its consolidated payment-calendar download (companion
 * document, same period).
 */
export function ClientInvoicePanel({
  clerkOrgId,
  lines,
  onDownloadCalendar,
}: {
  clerkOrgId: string | undefined
  lines: BillingLineRow[]
  onDownloadCalendar: (clientId: Id<'clients'>, month: string) => Promise<void>
}) {
  const createPerPatientInvoices = useMutation(
    api.billing.createPerPatientInvoices,
  )
  const [mode, setMode] = useState<'monthly' | 'custom'>('monthly')
  const [month, setMonth] = useState(currentMonth)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const range =
    mode === 'monthly'
      ? monthRange(month)
      : { startDate: customStart, endDate: customEnd }
  // Mirrors the backend's createdAt bounds so the listed clients match what
  // the invoice will actually contain (date-only end = inclusive end of day).
  const endBound = range.endDate
    ? range.endDate.length === 10
      ? `${range.endDate}T23:59:59.999Z`
      : range.endDate
    : ''

  const clients = useMemo(() => {
    const map = new Map<string, ClientGroup>()
    for (const line of lines) {
      if (!line.clientId) continue
      if (range.startDate && line.createdAt < range.startDate) continue
      if (endBound && line.createdAt > endBound) continue
      const group = map.get(line.clientId as string) ?? {
        clientId: line.clientId,
        clientName: line.clientName,
        lineCount: 0,
        amount: 0,
      }
      group.lineCount += 1
      group.amount += line.amount
      map.set(line.clientId as string, group)
    }
    return [...map.values()].sort((a, b) =>
      a.clientName.localeCompare(b.clientName),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, range.startDate, endBound])

  const allSelected =
    clients.length > 0 && clients.every((c) => selected.has(c.clientId))

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(clients.map((c) => c.clientId)) : new Set())
  }
  const toggleOne = (clientId: Id<'clients'>, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(clientId)
      else next.delete(clientId)
      return next
    })
  }

  const handleCreate = async () => {
    if (!clerkOrgId || selected.size === 0 || !range.startDate || !range.endDate)
      return
    setIsCreating(true)
    setError(null)
    setMessage(null)
    try {
      const result = await createPerPatientInvoices({
        clerkOrgId,
        startDate: range.startDate,
        endDate: range.endDate,
        clientIds: [...selected] as Id<'clients'>[],
      })
      // Companion document: consolidated payment calendar per client, same
      // period, downloaded alongside the invoice.
      let calendars = 0
      for (const created of result.invoices ?? []) {
        try {
          await onDownloadCalendar(
            created.clientId,
            created.periodStart.slice(0, 7),
          )
          calendars++
        } catch {
          // Best-effort — the calendar stays downloadable from the invoice row.
        }
      }
      setSelected(new Set())
      setMessage(
        `Created ${result.count} invoice(s) for ${range.startDate} – ${range.endDate}.` +
          (calendars > 0 ? ` Downloaded ${calendars} payment calendar(s).` : ''),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Invoice creation failed.',
      )
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FieldGroup label="Period type" htmlFor="clientInvoiceMode">
          <Select
            id="clientInvoiceMode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'monthly' | 'custom')}
            className="w-52"
          >
            <option value="monthly">Monthly (default)</option>
            <option value="custom">Custom date range</option>
          </Select>
        </FieldGroup>
        {mode === 'monthly' ? (
          <FieldGroup label="Month" htmlFor="clientInvoiceMonth">
            <Input
              id="clientInvoiceMonth"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </FieldGroup>
        ) : (
          <>
            <FieldGroup label="Start date" htmlFor="clientInvoiceStart">
              <USDateInput
                id="clientInvoiceStart"
                value={customStart}
                onChange={setCustomStart}
              />
            </FieldGroup>
            <FieldGroup label="End date" htmlFor="clientInvoiceEnd">
              <USDateInput
                id="clientInvoiceEnd"
                value={customEnd}
                onChange={setCustomEnd}
              />
            </FieldGroup>
          </>
        )}
      </div>

      {clients.length === 0 ? (
        <p className="py-4 text-center text-sm text-atria-muted">
          No unbilled work in this period.
        </p>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-atria-ink">
            <Checkbox
              checked={allSelected}
              onChange={(e) => toggleAll(e.target.checked)}
              aria-label="Select all clients"
            />
            Select all clients
          </label>
          <ul className="divide-y divide-atria-border rounded-[var(--radius-atria-md)] border border-atria-border">
            {clients.map((client) => (
              <li key={client.clientId}>
                <label className="flex cursor-pointer items-center justify-between gap-3 p-3 hover:bg-atria-surface-2">
                  <span className="flex items-center gap-3">
                    <Checkbox
                      checked={selected.has(client.clientId)}
                      onChange={(e) =>
                        toggleOne(client.clientId, e.target.checked)
                      }
                      aria-label={`Select ${client.clientName}`}
                    />
                    <span className="text-sm font-medium text-atria-ink">
                      {client.clientName}
                    </span>
                  </span>
                  <span className="text-sm text-atria-text-secondary">
                    {client.lineCount} line(s) · ${client.amount.toFixed(2)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-atria-danger">{error}</p>}
      {message && <p className="text-sm text-atria-success">{message}</p>}

      <Button
        variant="primary"
        disabled={
          isCreating ||
          selected.size === 0 ||
          !range.startDate ||
          !range.endDate
        }
        onClick={handleCreate}
        data-testid="create-client-invoices-button"
      >
        {isCreating
          ? 'Creating…'
          : `Create invoice${selected.size > 1 ? 's' : ''} for ${selected.size} client${selected.size === 1 ? '' : 's'}`}
      </Button>
    </div>
  )
}
