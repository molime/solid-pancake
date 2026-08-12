import type { Id } from '../../../../convex/_generated/dataModel'

export interface BillingLineRow {
  _id: Id<'billingLines'>
  shiftId: Id<'shifts'>
  hours: number
  rate: number
  amount: number
  createdAt: string
  exportBatchId?: Id<'exportBatches'>
  blockedReason?: string
  blockedAt?: string
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
  status?: string
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

import { jsPDF } from 'jspdf'
import { formatDateUS } from '@/shared/format'

/**
 * Build a professional PDF invoice as a Blob using jsPDF.
 * Agency invoices the government/payer for services rendered (approved shift billing lines).
 */
export function buildInvoicePdf(details: InvoiceDetails, agencyName = 'Agency'): Blob {
  const { invoice, lines } = details
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageWidth = 612
  const margin = 56
  const contentWidth = pageWidth - margin * 2

  // ---- Header ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(15, 15, 15)
  doc.text(agencyName, margin, 60)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(100, 100, 100)
  doc.text('Invoice for Services Rendered', margin, 78)

  // Invoice meta (right side)
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  let metaY = 60
  const metaX = pageWidth - margin - 200
  doc.setFont('helvetica', 'bold')
  doc.text(`Invoice #${invoice.invoiceNumber}`, metaX, metaY)
  doc.setFont('helvetica', 'normal')
  metaY += 14
  doc.text(`Status: ${(invoice.status || 'draft').toUpperCase()}`, metaX, metaY)
  metaY += 14
  doc.text(`Issued: ${formatDateUS(invoice.exportedAt)}`, metaX, metaY)
  if (invoice.periodStart || invoice.periodEnd) {
    metaY += 14
    doc.text(`Period: ${formatDateUS(invoice.periodStart || 'Start')} \u2013 ${formatDateUS(invoice.periodEnd || 'Today')}`, metaX, metaY)
  }

  // Divider
  let y = 100
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(1)
  doc.line(margin, y, pageWidth - margin, y)
  y += 20

  // ---- Invoice details ----
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Invoice Name: ${invoice.name}`, margin, y)
  y += 14
  const caregiverLabel = invoice.caregiverEmail || invoice.caregiverName || 'Multiple caregivers'
  doc.text(`Caregiver: ${caregiverLabel}`, margin, y)
  y += 24

  // ---- Table header ----
  const colDate = margin
  const colClient = margin + 110
  const colService = margin + 260
  const colHours = margin + 340
  const colRate = margin + 400
  const colAmount = margin + 460

  doc.setFillColor(245, 245, 245)
  doc.rect(margin, y - 12, contentWidth, 22, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(50, 50, 50)
  doc.text('Date', colDate, y)
  doc.text('Client', colClient, y)
  doc.text('Service', colService, y)
  doc.text('Hours', colHours, y)
  doc.text('Rate', colRate, y)
  doc.text('Amount', colAmount, y)
  y += 18

  // ---- Line items ----
  doc.setFont('helvetica', 'normal')
  let totalHours = 0
  for (const line of lines) {
    if (y > 680) {
      doc.addPage()
      y = 60
    }
    doc.setTextColor(80, 80, 80)
    doc.text(formatDateUS(line.scheduledStart), colDate, y)
    doc.text(line.clientName, colClient, y)
    doc.text(line.serviceType, colService, y)
    doc.text(line.hours.toFixed(2), colHours, y)
    doc.text(`$${line.rate.toFixed(2)}`, colRate, y)
    doc.text(`$${line.amount.toFixed(2)}`, colAmount, y)
    totalHours += line.hours
    y += 16
  }

  // ---- Totals ----
  y += 8
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, y, pageWidth - margin, y)
  y += 20

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Total Hours: ${totalHours.toFixed(2)}`, margin, y)
  y += 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 15, 15)
  doc.text(`Total: $${invoice.totalAmount.toFixed(2)}`, colAmount, y)

  // ---- Footer ----
  y = 730
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('This invoice is for services rendered to clients by agency caregivers.', margin, y)
  doc.text('Payment terms per service agreement.', margin, y + 12)

  return doc.output('blob')
}

function escapeCsvCell(value: string | number | undefined) {
  const cell = String(value ?? '')
  if (!/[",\n]/.test(cell)) return cell
  return `"${cell.replace(/"/g, '""')}"`
}
