import { describe, expect, it } from 'vitest'
import type { Id } from '../../../../convex/_generated/dataModel'
import {
  buildInvoiceCsv,
  defaultInvoiceName,
  filterBillingLines,
  summarizeLines,
  type BillingLineRow,
} from './invoiceUtils'

function line(overrides: Partial<BillingLineRow> = {}): BillingLineRow {
  return {
    _id: 'line-1' as Id<'billingLines'>,
    shiftId: 'shift-1' as Id<'shifts'>,
    hours: 2,
    rate: 50,
    amount: 100,
    createdAt: '2026-05-20T08:00:00.000Z',
    clientName: 'Maria Lopez',
    serviceType: 'SLS',
    scheduledStart: '2026-05-20T09:00:00.000Z',
    scheduledEnd: '2026-05-20T11:00:00.000Z',
    caregiverId: 'user-1',
    caregiverName: 'Juan Staff',
    caregiverEmail: 'juan@example.com',
    ...overrides,
  }
}

describe('invoice utilities', () => {
  it('filters ready billing lines by caregiver and service date', () => {
    const lines = [
      line(),
      line({
        _id: 'line-2' as Id<'billingLines'>,
        caregiverId: 'user-2',
        scheduledStart: '2026-05-21T09:00:00.000Z',
      }),
    ]

    expect(
      filterBillingLines(lines, {
        caregiverId: 'user-1',
        periodStart: '2026-05-20',
        periodEnd: '2026-05-20',
      }),
    ).toEqual([lines[0]])
  })

  it('summarizes selected invoice lines', () => {
    expect(
      summarizeLines([line(), line({ amount: 25.555, hours: 0.5 })]),
    ).toEqual({
      hours: 2.5,
      amount: 125.56,
    })
  })

  it('creates a readable default invoice name', () => {
    expect(
      defaultInvoiceName([line()], {
        caregiverId: 'user-1',
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
      }),
    ).toBe('Juan Staff invoice 2026-05-01 to 2026-05-31')
  })

  it('builds a CSV invoice document with escaped values', () => {
    const csv = buildInvoiceCsv({
      invoice: {
        _id: 'invoice-1' as Id<'exportBatches'>,
        name: 'May invoice',
        exportedAt: '2026-05-20T08:00:00.000Z',
        exportedBy: 'admin',
        invoiceNumber: 'ATRIA-20260520-ABC123',
        caregiverEmail: 'juan@example.com',
        lineCount: 1,
        totalAmount: 100,
      },
      lines: [line({ clientName: 'Lopez, Maria' })],
    })

    expect(csv).toContain('ATRIA-20260520-ABC123')
    expect(csv).toContain('"Lopez, Maria"')
    expect(csv).toContain('juan@example.com')
  })
})
