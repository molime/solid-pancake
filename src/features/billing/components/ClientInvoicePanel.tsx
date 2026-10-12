import { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Select } from '@/shared/ui/Select'
import { USDateInput } from '@/shared/ui/USDateInput'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { monthRange, type BillingLineRow } from '../model/invoiceUtils'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

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
  onDownloadCalendar,
}: {
  clerkOrgId: string | undefined
  onDownloadCalendar: (clientId: Id<'clients'>, month: string) => Promise<void>
}) {
  const createPerPatientInvoices = useMutation(
    api.billing.createPerPatientInvoices,
  )
  const [mode, setMode] = useState<'monthly' | 'custom'>('monthly')
  // Month/year selects instead of <input type="month"> — that input renders
  // as plain text in several browsers (Safari), which made the monthly view
  // silently depend on typing 'yyyy-mm' correctly (review feedback).
  const now = new Date()
  const [monthIndex, setMonthIndex] = useState(now.getUTCMonth())
  const [year, setYear] = useState(now.getUTCFullYear())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`

  const range =
    mode === 'monthly'
      ? monthRange(month)
      : { startDate: customStart, endDate: customEnd }
  const rangeReady = !!range.startDate && !!range.endDate
  // The query applies the period bounds server-side, so the 200-line cap in
  // `unexported` can never hide current work behind a backlog of old lines.
  const lines = useQuery(
    api.billing.unexported,
    clerkOrgId && rangeReady
      ? { clerkOrgId, startDate: range.startDate, endDate: range.endDate }
      : 'skip',
  ) as BillingLineRow[] | undefined

  const clients = useMemo(() => {
    const map = new Map<string, ClientGroup>()
    for (const line of lines ?? []) {
      if (!line.clientId) continue
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
  }, [lines])

  const allSelected =
    clients.length > 0 && clients.every((c) => selected.has(c.clientId))

  // Only selections that still exist in the chosen period count — switching
  // period can leave a selected client with no work in it.
  const effectiveSelected = clients.filter((c) => selected.has(c.clientId))

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
    if (
      !clerkOrgId ||
      effectiveSelected.length === 0 ||
      !range.startDate ||
      !range.endDate
    )
      return
    setIsCreating(true)
    setError(null)
    setMessage(null)
    try {
      const result = await createPerPatientInvoices({
        clerkOrgId,
        startDate: range.startDate,
        endDate: range.endDate,
        clientIds: effectiveSelected.map((c) => c.clientId),
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
          <>
            <FieldGroup label="Month" htmlFor="clientInvoiceMonthMonth">
              <Select
                id="clientInvoiceMonthMonth"
                value={String(monthIndex)}
                onChange={(e) => setMonthIndex(Number(e.target.value))}
                className="w-36"
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup label="Year" htmlFor="clientInvoiceMonthYear">
              <Select
                id="clientInvoiceMonthYear"
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-28"
              >
                {[now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1].map(
                  (optionYear) => (
                    <option key={optionYear} value={optionYear}>
                      {optionYear}
                    </option>
                  ),
                )}
              </Select>
            </FieldGroup>
          </>
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

      {lines === undefined ? (
        <p className="py-4 text-center text-sm text-atria-muted">
          Loading unbilled work…
        </p>
      ) : clients.length === 0 ? (
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
          effectiveSelected.length === 0 ||
          !range.startDate ||
          !range.endDate
        }
        onClick={handleCreate}
        data-testid="create-client-invoices-button"
      >
        {isCreating
          ? 'Creating…'
          : `Create invoice${effectiveSelected.length > 1 ? 's' : ''} for ${effectiveSelected.length} client${effectiveSelected.length === 1 ? '' : 's'}`}
      </Button>
    </div>
  )
}
