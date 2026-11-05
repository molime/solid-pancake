import { describe, expect, it } from 'vitest'
import { computeBillingKpis, currentMonthRange } from './platformBillingKpis'

const NOW = new Date('2026-11-05T12:00:00')

function invoice(
  status: string,
  total: number,
  paidAt?: string,
): { status: string; total: number; paidAt?: string } {
  return paidAt === undefined ? { status, total } : { status, total, paidAt }
}

describe('currentMonthRange', () => {
  it('spans local month start to the first day of the next month', () => {
    const { start, end } = currentMonthRange(NOW)
    const startDate = new Date(start)
    const endDate = new Date(end)
    expect(startDate.getFullYear()).toBe(2026)
    expect(startDate.getMonth()).toBe(10)
    expect(startDate.getDate()).toBe(1)
    expect(endDate.getTime() - startDate.getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    ) // November has 30 days.
  })
})

describe('computeBillingKpis', () => {
  it('excludes void invoices from every KPI', () => {
    const kpis = computeBillingKpis(
      [invoice('void', 500), invoice('paid', 199, '2026-11-02T00:00:00.000Z')],
      NOW,
    )
    expect(kpis.totalBilled).toBe(199)
    expect(kpis.paidThisMonth).toBe(199)
    expect(kpis.outstanding).toBe(0)
    expect(kpis.overdueAmount).toBe(0)
    expect(kpis.overdueCount).toBe(0)
  })

  it('counts un-mirrored drafts as outstanding', () => {
    const kpis = computeBillingKpis([invoice('draft', 249)], NOW)
    expect(kpis.outstanding).toBe(249)
    expect(kpis.totalBilled).toBe(249)
    expect(kpis.paidThisMonth).toBe(0)
  })

  it('sums sent and overdue invoices into outstanding', () => {
    const kpis = computeBillingKpis(
      [invoice('sent', 100), invoice('overdue', 150), invoice('paid', 75)],
      NOW,
    )
    expect(kpis.outstanding).toBe(250)
    expect(kpis.overdueAmount).toBe(150)
    expect(kpis.overdueCount).toBe(1)
  })

  it('only counts payments made this month as paid this month', () => {
    const { start, end } = currentMonthRange(NOW)
    const inside = new Date(new Date(start).getTime() + 1000).toISOString()
    const before = new Date(new Date(start).getTime() - 1000).toISOString()
    const atEnd = new Date(new Date(end).getTime() - 1000).toISOString()
    const kpis = computeBillingKpis(
      [
        invoice('paid', 100, inside),
        invoice('paid', 50, before),
        invoice('paid', 25, atEnd),
      ],
      NOW,
    )
    expect(kpis.paidThisMonth).toBe(125)
    expect(kpis.totalBilled).toBe(175)
  })
})
