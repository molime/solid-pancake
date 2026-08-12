import { useQuery } from 'convex/react'
import { Link } from 'react-router-dom'
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

export function PlatformAgenciesPage() {
  const isAdmin = usePlatformAdmin()
  const stats = useQuery(api.platform.getPlatformStats, isAdmin ? {} : 'skip')
  const tenants = useQuery(
    api.platform.listTenantsWithUsage,
    isAdmin ? {} : 'skip',
  )
  const plans = useQuery(api.platform.getPricingPlans, isAdmin ? {} : 'skip')

  const planLabel = (planKey?: string) =>
    plans?.find((p) => p.key === planKey)?.label ?? '—'

  return (
    <PlatformGate>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[26px] font-bold text-[#f5f7f6]">Agencies</h1>
          <Link
            to="/platform/agencies/create"
            className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0f10] transition-opacity hover:opacity-90"
          >
            Create Agency
          </Link>
        </div>

        <div className="flex flex-wrap gap-4">
          <PlatformKpiCard
            label="Active agencies"
            value={stats?.activeCount ?? '—'}
            tone="success"
          />
          <PlatformKpiCard
            label="New this month"
            value={stats?.newThisMonth ?? '—'}
            tone="info"
          />
          <PlatformKpiCard
            label="Suspended"
            value={stats?.suspendedCount ?? '—'}
            tone="danger"
          />
          <PlatformKpiCard
            label="Total MRR"
            value={stats ? formatCurrency(stats.mrr) : '—'}
          />
        </div>

        {!tenants ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            Loading agencies…
          </p>
        ) : tenants.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            No agencies yet.
          </p>
        ) : (
          <PlatformTable>
            <PlatformTableHead>
              <PlatformTableHeader>Name</PlatformTableHeader>
              <PlatformTableHeader>Plan</PlatformTableHeader>
              <PlatformTableHeader>MRR</PlatformTableHeader>
              <PlatformTableHeader>City</PlatformTableHeader>
              <PlatformTableHeader>Status</PlatformTableHeader>
              <PlatformTableHeader>Renews</PlatformTableHeader>
              <PlatformTableHeader />
            </PlatformTableHead>
            <PlatformTableBody>
              {tenants.map((tenant) => (
                <PlatformTableRow key={tenant._id}>
                  <PlatformTableCell className="font-medium">
                    {tenant.name}
                  </PlatformTableCell>
                  <PlatformTableCell className="text-[#9aa6a8]">
                    {planLabel(tenant.subscription?.planKey)}
                  </PlatformTableCell>
                  <PlatformTableCell>
                    {formatCurrency(tenant.mrr)}
                  </PlatformTableCell>
                  <PlatformTableCell className="text-[#9aa6a8]">
                    {tenant.address ?? '—'}
                  </PlatformTableCell>
                  <PlatformTableCell>
                    <PlatformStatusPill
                      status={tenant.subscription?.status ?? 'none'}
                    />
                  </PlatformTableCell>
                  <PlatformTableCell className="text-[#9aa6a8]">
                    {formatDateUS(
                      tenant.subscription?.renewsAt ??
                        tenant.subscription?.currentPeriodEnd,
                    ) || '—'}
                  </PlatformTableCell>
                  <PlatformTableCell>
                    <Link
                      to={`/platform/agencies/${tenant._id}`}
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
