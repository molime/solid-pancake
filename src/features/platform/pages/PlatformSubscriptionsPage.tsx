import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../../convex/_generated/api'
import { formatCurrency, formatDateUS } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
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

export function PlatformSubscriptionsPage() {
  const isAdmin = usePlatformAdmin()
  const navigate = useNavigate()
  const stats = useQuery(api.platform.getPlatformStats, isAdmin ? {} : 'skip')
  const tenants = useQuery(
    api.platform.listTenantsWithUsage,
    isAdmin ? {} : 'skip',
  )
  const plans = useQuery(api.platform.getPricingPlans, isAdmin ? {} : 'skip')
  const seedTraining = useMutation(
    api.platform.seedGoldenAgesTrainingForAllTenants,
  )

  const [seedBusy, setSeedBusy] = useState(false)
  const [seedMessage, setSeedMessage] = useState('')

  const planLabel = (planKey?: string) =>
    plans?.find((p) => p.key === planKey)?.label ?? '—'

  const handleSeedTraining = async () => {
    if (!isAdmin) return
    setSeedBusy(true)
    setSeedMessage('')
    try {
      const result = await seedTraining({})
      const okCount = result.results.filter((r) => r.ok).length
      setSeedMessage(
        `Seeded training for ${okCount}/${result.count} agencies.`,
      )
    } catch (err) {
      setSeedMessage(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to seed training.',
      )
    } finally {
      setSeedBusy(false)
    }
  }

  return (
    <PlatformGate>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[26px] font-bold text-[#f5f7f6]">Subscriptions</h1>
          <button
            onClick={handleSeedTraining}
            disabled={seedBusy || !isAdmin}
            className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0f10] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {seedBusy ? 'Seeding…' : 'Seed training for all agencies'}
          </button>
        </div>
        {seedMessage && (
          <p className="text-sm text-[#9aa6a8]">{seedMessage}</p>
        )}

        <div className="flex flex-wrap gap-4">
          <PlatformKpiCard
            label="Active agencies"
            value={stats?.activeCount ?? '—'}
            tone="success"
          />
          <PlatformKpiCard
            label="Trialing"
            value={stats?.trialingCount ?? '—'}
            tone="warning"
          />
          <PlatformKpiCard
            label="Past due"
            value={stats?.pastDueCount ?? '—'}
            tone="danger"
          />
          <PlatformKpiCard
            label="MRR"
            value={stats ? formatCurrency(stats.mrr) : '—'}
          />
        </div>

        {!tenants ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            Loading subscriptions…
          </p>
        ) : tenants.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            No agencies yet.
          </p>
        ) : (
          <PlatformTable>
            <PlatformTableHead>
              <PlatformTableHeader>Agency</PlatformTableHeader>
              <PlatformTableHeader>Plan</PlatformTableHeader>
              <PlatformTableHeader>Seats</PlatformTableHeader>
              <PlatformTableHeader>MRR</PlatformTableHeader>
              <PlatformTableHeader>Renews</PlatformTableHeader>
              <PlatformTableHeader>Status</PlatformTableHeader>
            </PlatformTableHead>
            <PlatformTableBody>
              {tenants.map((tenant) => (
                <PlatformTableRow
                  key={tenant._id}
                  onClick={() =>
                    navigate(`/platform/subscriptions/${tenant.slug}`)
                  }
                >
                  <PlatformTableCell className="font-medium">
                    {tenant.name}
                  </PlatformTableCell>
                  <PlatformTableCell className="text-[#9aa6a8]">
                    {planLabel(tenant.subscription?.planKey)}
                  </PlatformTableCell>
                  <PlatformTableCell>{tenant.seatCount}</PlatformTableCell>
                  <PlatformTableCell>
                    {formatCurrency(tenant.mrr)}
                  </PlatformTableCell>
                  <PlatformTableCell className="text-[#9aa6a8]">
                    {formatDateUS(
                      tenant.subscription?.renewsAt ??
                        tenant.subscription?.currentPeriodEnd,
                    ) || '—'}
                  </PlatformTableCell>
                  <PlatformTableCell>
                    <PlatformStatusPill
                      status={tenant.subscription?.status ?? 'none'}
                    />
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
