/**
 * KPI aggregation for the platform Billing page. Pure functions so the
 * definitions can be unit-tested.
 *
 * Semantics (design-nov4-billing-support-fixes, Fix 3):
 * - Total billed sums NON-VOID invoices only (voids are excluded entirely).
 * - Outstanding sums every unpaid NON-VOID invoice, including un-mirrored
 *   drafts — they are real amounts owed.
 * - Paid this month and Overdue come from the same non-void set.
 */

export interface PlatformInvoiceKpiInput {
  status: string
  total: number
  paidAt?: string | undefined
}

export interface PlatformBillingKpis {
  outstanding: number
  paidThisMonth: number
  overdueCount: number
  overdueAmount: number
  totalBilled: number
}

export function currentMonthRange(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
  return { start, end }
}

export function computeBillingKpis(
  invoices: PlatformInvoiceKpiInput[],
  now: Date = new Date(),
): PlatformBillingKpis {
  const { start, end } = currentMonthRange(now)
  const kpis: PlatformBillingKpis = {
    outstanding: 0,
    paidThisMonth: 0,
    overdueCount: 0,
    overdueAmount: 0,
    totalBilled: 0,
  }
  for (const invoice of invoices) {
    // Voids never count in any KPI.
    if (invoice.status === 'void') continue
    kpis.totalBilled += invoice.total
    if (
      invoice.status === 'draft' ||
      invoice.status === 'sent' ||
      invoice.status === 'overdue'
    ) {
      kpis.outstanding += invoice.total
    }
    if (
      invoice.status === 'paid' &&
      invoice.paidAt &&
      invoice.paidAt >= start &&
      invoice.paidAt < end
    ) {
      kpis.paidThisMonth += invoice.total
    }
    if (invoice.status === 'overdue') {
      kpis.overdueCount += 1
      kpis.overdueAmount += invoice.total
    }
  }
  return kpis
}
