import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { formatCurrency } from '@/shared/format'
import { usePlatformAdmin } from '../usePlatformAdmin'
import { PlatformGate } from '../components/PlatformGate'
import { PlatformKpiCard } from '../components/PlatformKpiCard'

export function PlatformReportsPage() {
  const isAdmin = usePlatformAdmin()
  const stats = useQuery(api.platform.getPlatformStats, isAdmin ? {} : 'skip')
  const tenants = useQuery(
    api.platform.listTenantsWithUsage,
    isAdmin ? {} : 'skip',
  )

  const totalSeats = tenants?.reduce((sum, t) => sum + t.seatCount, 0)
  const topBySeats = [...(tenants ?? [])]
    .sort((a, b) => b.seatCount - a.seatCount)
    .slice(0, 6)
  const maxSeats = Math.max(1, ...topBySeats.map((t) => t.seatCount))
  const topAgencies = [...(tenants ?? [])]
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 6)

  return (
    <PlatformGate>
      <div className="space-y-6">
        <h1 className="text-[26px] font-bold text-[#f5f7f6]">Reports</h1>

        <div className="flex flex-wrap gap-4">
          <PlatformKpiCard
            label="Total agencies"
            value={stats?.totalAgencies ?? '—'}
          />
          <PlatformKpiCard label="Total seats" value={totalSeats ?? '—'} />
          <PlatformKpiCard
            label="Platform MRR"
            value={stats ? formatCurrency(stats.mrr) : '—'}
            tone="success"
          />
          <PlatformKpiCard
            label="Past due"
            value={stats?.pastDueCount ?? '—'}
            tone="danger"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
            <h2 className="text-lg font-bold text-[#f5f7f6]">
              Agencies by seats
            </h2>
            {!tenants ? (
              <p className="py-12 text-center text-sm text-[#9aa6a8]">
                Loading report…
              </p>
            ) : topBySeats.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#9aa6a8]">
                No data yet.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {topBySeats.map((tenant) => (
                  <div key={tenant._id}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="truncate text-sm text-[#9aa6a8]">
                        {tenant.name}
                      </span>
                      <span className="text-sm font-semibold text-[#f5f7f6]">
                        {tenant.seatCount}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-[#1e2629]">
                      <div
                        className="h-3 rounded-full bg-[#22c55e]"
                        style={{
                          width: `${Math.max(
                            4,
                            Math.round((tenant.seatCount / maxSeats) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
            <h2 className="text-lg font-bold text-[#f5f7f6]">Top agencies</h2>
            {!tenants ? (
              <p className="py-12 text-center text-sm text-[#9aa6a8]">
                Loading…
              </p>
            ) : topAgencies.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#9aa6a8]">
                No data yet.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[#2a3437]">
                {topAgencies.map((tenant, index) => (
                  <li
                    key={tenant._id}
                    className="flex items-center justify-between py-3"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(34,197,94,0.16)] text-[13px] font-semibold text-[#22c55e]">
                        {index + 1}
                      </span>
                      <span className="truncate text-[15px] text-[#f5f7f6]">
                        {tenant.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-[#9aa6a8]">
                      {formatCurrency(tenant.mrr)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PlatformGate>
  )
}
