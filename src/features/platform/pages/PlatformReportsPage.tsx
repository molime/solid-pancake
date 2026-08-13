import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { formatCurrency, formatDateUS } from '@/shared/format'
import { usePlatformAdmin } from '../usePlatformAdmin'
import { PlatformGate } from '../components/PlatformGate'
import { PlatformKpiCard } from '../components/PlatformKpiCard'
import {
  PlatformTable,
  PlatformTableBody,
  PlatformTableCell,
  PlatformTableHead,
  PlatformTableHeader,
  PlatformTableRow,
} from '../components/PlatformTable'

export function PlatformReportsPage() {
  const isAdmin = usePlatformAdmin()
  const stats = useQuery(api.platform.getPlatformStats, isAdmin ? {} : 'skip')
  const churned = useQuery(
    api.platform.listChurnedTenants,
    isAdmin ? {} : 'skip',
  )

  const churnedSorted = [...(churned ?? [])].sort(
    (a, b) => (b.churnedAt ?? 0) - (a.churnedAt ?? 0),
  )
  const reasonBreakdown = new Map<string, number>()
  for (const tenant of churned ?? []) {
    if (!tenant.churnReason) continue
    reasonBreakdown.set(
      tenant.churnReason,
      (reasonBreakdown.get(tenant.churnReason) ?? 0) + 1,
    )
  }

  return (
    <PlatformGate>
      <div className="space-y-6">
        <h1 className="text-[26px] font-bold text-[#f5f7f6]">Reports</h1>

        <div className="flex flex-wrap gap-4">
          <PlatformKpiCard
            label="Total agencies"
            value={stats?.totalAgencies ?? '—'}
          />
          <PlatformKpiCard
            label="New this month"
            value={stats?.newThisMonth ?? '—'}
            tone="info"
          />
          <PlatformKpiCard
            label="Platform MRR"
            value={stats ? formatCurrency(stats.mrr) : '—'}
            tone="success"
          />
          <PlatformKpiCard
            label="Lost agencies"
            value={stats?.churnedCount ?? '—'}
            tone="danger"
          />
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold text-[#f5f7f6]">
            Lost agencies
          </h2>
          {!churned ? (
            <p className="py-12 text-center text-sm text-[#9aa6a8]">
              Loading churn report…
            </p>
          ) : churnedSorted.length === 0 ? (
            <p className="rounded-2xl border border-[#2a3437] bg-[#151b1d] py-12 text-center text-sm text-[#9aa6a8]">
              No lost agencies yet.
            </p>
          ) : (
            <>
              {reasonBreakdown.size > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {[...reasonBreakdown.entries()].map(([reason, count]) => (
                    <span
                      key={reason}
                      className="inline-flex items-center gap-2 rounded-[15px] bg-[#151b1d] px-3 py-1 text-[13px] text-[#9aa6a8]"
                    >
                      {reason}
                      <span className="font-semibold text-[#f5f7f6]">
                        {count}
                      </span>
                    </span>
                  ))}
                </div>
              )}
              <PlatformTable>
              <PlatformTableHead>
                <PlatformTableHeader>Agency</PlatformTableHeader>
                <PlatformTableHeader>Churned</PlatformTableHeader>
                <PlatformTableHeader>Reason</PlatformTableHeader>
              </PlatformTableHead>
              <PlatformTableBody>
                {churnedSorted.map((tenant) => (
                  <PlatformTableRow key={tenant.tenantId}>
                    <PlatformTableCell className="font-medium">
                      {tenant.name}
                    </PlatformTableCell>
                    <PlatformTableCell className="text-[#9aa6a8]">
                      {tenant.churnedAt
                        ? formatDateUS(new Date(tenant.churnedAt))
                        : '—'}
                    </PlatformTableCell>
                    <PlatformTableCell className="text-[#9aa6a8]">
                      {tenant.churnReason ?? '—'}
                    </PlatformTableCell>
                  </PlatformTableRow>
                ))}
              </PlatformTableBody>
              </PlatformTable>
            </>
          )}
        </div>
      </div>
    </PlatformGate>
  )
}
