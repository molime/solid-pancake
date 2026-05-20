import type { Id } from '../../../../convex/_generated/dataModel'

export interface BillingLineRow {
  _id: Id<'billingLines'>
  shiftId: Id<'shifts'>
  hours: number
  rate: number
  amount: number
  createdAt: string
  exportBatchId?: Id<'exportBatches'>
  clientName: string
  serviceType: 'SLS' | 'ILS'
  scheduledStart: string
  scheduledEnd: string
  caregiverId: string
  caregiverName: string
  caregiverEmail: string
}

export interface InvoiceRow {
  _id: Id<'exportBatches'>
  name: string
  exportedAt: string
  exportedBy: string
  invoiceNumber: string
  periodStart?: string
  periodEnd?: string
  caregiverName?: string
  caregiverEmail?: string
  lineCount: number
  totalAmount: number
}

export interface BillingFilters {
  caregiverId: string
  periodStart: string
  periodEnd: string
}

export interface InvoiceDetails {
  invoice: InvoiceRow
  lines: BillingLineRow[]
}

export function filterBillingLines(
  lines: BillingLineRow[],
  filters: BillingFilters,
) {
  return lines.filter((line) => {
    const serviceDate = line.scheduledStart.slice(0, 10)
    if (filters.caregiverId && line.caregiverId !== filters.caregiverId) {
      return false
    }
    if (filters.periodStart && serviceDate < filters.periodStart) {
      return false
    }
    if (filters.periodEnd && serviceDate > filters.periodEnd) {
      return false
    }
    return true
  })
}

export function summarizeLines(lines: BillingLineRow[]) {
  return {
    hours:
      Math.round(lines.reduce((sum, line) => sum + line.hours, 0) * 100) / 100,
    amount:
      Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100,
  }
}

export function defaultInvoiceName(
  selectedLines: BillingLineRow[],
  filters: BillingFilters,
) {
  const caregiverNames = Array.from(
    new Set(selectedLines.map((line) => line.caregiverName).filter(Boolean)),
  )
  const caregiverLabel =
    caregiverNames.length === 1 ? caregiverNames[0] : 'Multiple caregivers'
  const periodLabel =
    filters.periodStart || filters.periodEnd
      ? `${filters.periodStart || 'Start'} to ${filters.periodEnd || 'Today'}`
      : new Date().toISOString().slice(0, 10)

  return `${caregiverLabel} invoice ${periodLabel}`
}

export function buildInvoiceCsv(details: InvoiceDetails) {
  const rows = [
    ['Invoice', details.invoice.invoiceNumber],
    ['Name', details.invoice.name],
    [
      'Caregiver',
      details.invoice.caregiverEmail ||
        details.invoice.caregiverName ||
        'Mixed',
    ],
    ['Issued', details.invoice.exportedAt],
    ['Total', details.invoice.totalAmount.toFixed(2)],
    [],
    [
      'Service Date',
      'Caregiver',
      'Client',
      'Service',
      'Hours',
      'Rate',
      'Amount',
      'Shift ID',
    ],
    ...details.lines.map((line) => [
      line.scheduledStart.slice(0, 10),
      line.caregiverEmail || line.caregiverName,
      line.clientName,
      line.serviceType,
      line.hours.toFixed(2),
      line.rate.toFixed(2),
      line.amount.toFixed(2),
      line.shiftId,
    ]),
  ]

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

function escapeCsvCell(value: string | number | undefined) {
  const cell = String(value ?? '')
  if (!/[",\n]/.test(cell)) return cell
  return `"${cell.replace(/"/g, '""')}"`
}
