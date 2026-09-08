import { useQuery } from 'convex/react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import { formatCurrency, formatDateUS } from '@/shared/format'
import { usePlatformAdmin } from '../usePlatformAdmin'
import { PlatformGate } from '../components/PlatformGate'
import { PlatformKpiCard } from '../components/PlatformKpiCard'
import { PlatformStatusPill } from '../components/PlatformStatusPill'
import {
  PlatformTable,
  PlatformTableBody,
  PlatformTableCell,
  PlatformTableHead,
  PlatformTableHeader,
  PlatformTableRow,
} from '../components/PlatformTable'

function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
  return { start, end }
}

export function PlatformBillingPage() {
  const isAdmin = usePlatformAdmin()
  const navigate = useNavigate()
  const invoices = useQuery(
    api.platform.listPlatformInvoices,
    isAdmin ? {} : 'skip',
  )

  let outstanding = 0
  let paidThisMonth = 0
  let overdueCount = 0
  let overdueAmount = 0
  let totalBilled = 0

  if (invoices) {
    const { start, end } = currentMonthRange()
    for (const invoice of invoices) {
      if (invoice.status === 'sent' || invoice.status === 'overdue') {
        outstanding += invoice.total
      }
      if (
        invoice.status === 'paid' &&
        invoice.paidAt &&
        invoice.paidAt >= start &&
        invoice.paidAt < end
      ) {
        paidThisMonth += invoice.total
      }
      if (invoice.status === 'overdue') {
        overdueCount += 1
        overdueAmount += invoice.total
      }
      if (invoice.status !== 'void') {
        totalBilled += invoice.total
      }
    }
  }

  return (
    <PlatformGate>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[26px] font-bold text-[#f5f7f6]">Billing</h1>
          <button
            onClick={() => navigate('/platform/billing/create')}
            className="flex items-center gap-2 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0f10] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </button>
        </div>

        <div className="flex flex-wrap gap-4">
          <PlatformKpiCard
            label="Outstanding"
            value={invoices ? formatCurrency(outstanding) : '—'}
            tone="warning"
          />
          <PlatformKpiCard
            label="Paid this month"
            value={invoices ? formatCurrency(paidThisMonth) : '—'}
            tone="success"
          />
          <PlatformKpiCard
            label="Overdue"
            value={invoices ? formatCurrency(overdueAmount) : '—'}
            hint={invoices ? `${overdueCount} invoice(s)` : undefined}
            tone="danger"
          />
          <PlatformKpiCard
            label="Total billed"
            value={invoices ? formatCurrency(totalBilled) : '—'}
          />
        </div>

        {!invoices ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            Loading invoices…
          </p>
        ) : invoices.length === 0 ? (
          <p className="rounded-2xl border border-[#2a3437] bg-[#151b1d] py-12 text-center text-sm text-[#9aa6a8]">
            No invoices yet.
          </p>
        ) : (
          <PlatformTable>
            <PlatformTableHead>
              <PlatformTableHeader>Agency</PlatformTableHeader>
              <PlatformTableHeader>Invoice #</PlatformTableHeader>
              <PlatformTableHeader>Period</PlatformTableHeader>
              <PlatformTableHeader>Total</PlatformTableHeader>
              <PlatformTableHeader>Status</PlatformTableHeader>
              <PlatformTableHeader>Stripe</PlatformTableHeader>
              <PlatformTableHeader />
            </PlatformTableHead>
            <PlatformTableBody>
              {invoices.map((invoice) => (
                <PlatformTableRow key={invoice._id}>
                  <PlatformTableCell className="font-medium">
                    {invoice.tenantName}
                  </PlatformTableCell>
                  <PlatformTableCell className="text-[#9aa6a8]">
                    {invoice.invoiceNumber}
                  </PlatformTableCell>
                  <PlatformTableCell className="whitespace-nowrap text-[#9aa6a8]">
                    {formatDateUS(invoice.periodStart)} –{' '}
                    {formatDateUS(invoice.periodEnd)}
                  </PlatformTableCell>
                  <PlatformTableCell>
                    {formatCurrency(invoice.total)}
                  </PlatformTableCell>
                  <PlatformTableCell>
                    <PlatformStatusPill status={invoice.status} />
                  </PlatformTableCell>
                  <PlatformTableCell>
                    {invoice.stripeInvoiceId ? (
                      <span
                        className={
                          invoice.status === 'paid'
                            ? 'text-[13px] font-semibold text-[#22c55e]'
                            : 'text-[13px] font-semibold text-[#9aa6a8]'
                        }
                      >
                        {invoice.status === 'paid'
                          ? 'Paid via Stripe'
                          : 'Stripe sent'}
                      </span>
                    ) : (
                      <span className="text-[13px] text-[#687173]">—</span>
                    )}
                  </PlatformTableCell>
                  <PlatformTableCell>
                    <Link
                      to={`/platform/billing/${invoice._id}`}
                      className="text-sm font-medium text-[#22c55e] hover:underline"
                    >
                      View
                    </Link>
                  </PlatformTableCell>
                </PlatformTableRow>
              ))}
            </PlatformTableBody>
          </PlatformTable>
        )}
      </div>
    </PlatformGate>
  )
}
