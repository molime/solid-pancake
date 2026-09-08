import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { formatCurrency, formatDateUS } from '@/shared/format'
import { Dialog } from '@/shared/ui/Dialog'
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

const limitAlertKindLabel: Record<string, string> = {
  seats: 'Active seats',
  candidates: 'Candidates',
  shifts: 'Shifts this month',
}

export function PlatformHealthPage() {
  const isAdmin = usePlatformAdmin()
  const health = useQuery(api.platform.getTenantHealth, isAdmin ? {} : 'skip')
  const tenants = useQuery(
    api.platform.listTenantsWithUsage,
    isAdmin ? {} : 'skip',
  )
  const [selectedTenantId, setSelectedTenantId] = useState<Id<'tenants'> | null>(
    null,
  )
  const detail = useQuery(
    api.platform.getTenantHealthDetail,
    isAdmin && selectedTenantId ? { tenantId: selectedTenantId } : 'skip',
  )

  const healthyCount = health?.filter((t) => t.status === 'healthy').length
  const limitAlerts = health?.reduce(
    (sum, t) => sum + t.limitAlerts.length,
    0,
  )
  const syncErrors = health?.reduce((sum, t) => sum + t.syncErrors, 0)
  const issuesCount = health?.filter((t) => t.status !== 'healthy').length

  const activeTenants = (tenants ?? []).filter((t) => !t.churnedAt)
  const topBySeats = [...activeTenants]
    .sort((a, b) => b.seatCount - a.seatCount)
    .slice(0, 6)
  const maxSeats = Math.max(1, ...topBySeats.map((t) => t.seatCount))
  const topAgencies = [...activeTenants]
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 6)

  const noIssues =
    detail &&
    detail.limitAlerts.length === 0 &&
    detail.integrationErrors.length === 0 &&
    detail.syncErrors.length === 0

  return (
    <PlatformGate>
      <div className="space-y-6">
        <h1 className="text-[26px] font-bold text-[#f5f7f6]">Tenant Health</h1>

        <div className="flex flex-wrap gap-4">
          <PlatformKpiCard
            label="Healthy tenants"
            value={healthyCount ?? '—'}
            tone="success"
          />
          <PlatformKpiCard
            label="Limit alerts"
            value={limitAlerts ?? '—'}
            tone="warning"
          />
          <PlatformKpiCard
            label="Sync errors"
            value={syncErrors ?? '—'}
            tone="danger"
          />
          <PlatformKpiCard
            label="Tenants with issues"
            value={issuesCount ?? '—'}
            tone={issuesCount ? 'danger' : 'default'}
          />
        </div>

        {!health ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            Loading tenant health…
          </p>
        ) : health.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            No tenants yet.
          </p>
        ) : (
          <PlatformTable>
            <PlatformTableHead>
              <PlatformTableHeader>Tenant</PlatformTableHeader>
              <PlatformTableHeader>Limit alerts</PlatformTableHeader>
              <PlatformTableHeader>Sync errors</PlatformTableHeader>
              <PlatformTableHeader>Billing status</PlatformTableHeader>
              <PlatformTableHeader>Last active</PlatformTableHeader>
              <PlatformTableHeader>Health</PlatformTableHeader>
            </PlatformTableHead>
            <PlatformTableBody>
              {health.map((tenant) => (
                <PlatformTableRow
                  key={tenant.tenantId}
                  onClick={() => setSelectedTenantId(tenant.tenantId)}
                >
                  <PlatformTableCell className="font-medium">
                    {tenant.tenantName}
                  </PlatformTableCell>
                  <PlatformTableCell>
                    {tenant.limitAlerts.length > 0 ? (
                      <span className="inline-flex items-center rounded-[15px] bg-[rgba(245,158,11,0.16)] px-3 py-1 text-[13px] font-semibold text-[#f59e0b]">
                        {tenant.limitAlerts.length} over limit
                      </span>
                    ) : (
                      <span className="text-[#9aa6a8]">—</span>
                    )}
                  </PlatformTableCell>
                  <PlatformTableCell>{tenant.syncErrors}</PlatformTableCell>
                  <PlatformTableCell>
                    <PlatformStatusPill status={tenant.billingStatus} />
                  </PlatformTableCell>
                  <PlatformTableCell className="text-[#9aa6a8]">
                    {formatDateUS(tenant.lastActive)}
                  </PlatformTableCell>
                  <PlatformTableCell>
                    <PlatformStatusPill status={tenant.status} />
                  </PlatformTableCell>
                </PlatformTableRow>
              ))}
            </PlatformTableBody>
          </PlatformTable>
        )}

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

        <Dialog
          open={selectedTenantId !== null}
          onClose={() => setSelectedTenantId(null)}
          className="max-w-3xl border-[#2a3437] bg-[#151b1d]"
        >
          <div className="border-b border-[#2a3437] px-6 py-5">
            <h3 className="text-lg font-bold text-[#f5f7f6]">
              {detail?.tenant.name ?? 'Tenant issues'}
            </h3>
          </div>
          <div className="space-y-6 overflow-y-auto p-6">
            {!detail ? (
              <p className="py-8 text-center text-sm text-[#9aa6a8]">
                Loading issues…
              </p>
            ) : noIssues ? (
              <p className="py-8 text-center text-sm text-[#9aa6a8]">
                No active issues for this tenant.
              </p>
            ) : (
              <>
                <section>
                  <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#687173]">
                    Limit Alerts
                  </h4>
                  {detail.limitAlerts.length === 0 ? (
                    <p className="text-sm text-[#9aa6a8]">None.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.limitAlerts.map((alert) => (
                        <div
                          key={alert.kind}
                          className="flex items-center justify-between rounded-lg border border-[#2a3437] bg-[#1e2629] px-4 py-3"
                        >
                          <span className="text-[15px] text-[#f5f7f6]">
                            {limitAlertKindLabel[alert.kind] ?? alert.kind}
                          </span>
                          <span className="flex items-center gap-2 text-sm text-[#9aa6a8]">
                            {alert.usage} / {alert.limit}
                            <span className="inline-flex items-center rounded-[15px] bg-[rgba(245,158,11,0.16)] px-2 py-0.5 text-[12px] font-semibold text-[#f59e0b]">
                              Over limit
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#687173]">
                    Integration Errors
                  </h4>
                  {detail.integrationErrors.length === 0 ? (
                    <p className="text-sm text-[#9aa6a8]">None.</p>
                  ) : (
                    <PlatformTable>
                      <PlatformTableHead>
                        <PlatformTableHeader>Provider</PlatformTableHeader>
                        <PlatformTableHeader>Error</PlatformTableHeader>
                        <PlatformTableHeader>Last Attempt</PlatformTableHeader>
                      </PlatformTableHead>
                      <PlatformTableBody>
                        {detail.integrationErrors.map((c) => (
                          <PlatformTableRow key={c._id}>
                            <PlatformTableCell>{c.provider}</PlatformTableCell>
                            <PlatformTableCell className="text-[#9aa6a8]">
                              {c.error ?? '—'}
                            </PlatformTableCell>
                            <PlatformTableCell className="text-[#9aa6a8]">
                              {c.lastCheckedAt
                                ? formatDateUS(c.lastCheckedAt)
                                : '—'}
                            </PlatformTableCell>
                          </PlatformTableRow>
                        ))}
                      </PlatformTableBody>
                    </PlatformTable>
                  )}
                </section>

                <section>
                  <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#687173]">
                    Sync Errors
                  </h4>
                  {detail.syncErrors.length === 0 ? (
                    <p className="text-sm text-[#9aa6a8]">None.</p>
                  ) : (
                    <PlatformTable>
                      <PlatformTableHead>
                        <PlatformTableHeader>Employee</PlatformTableHeader>
                        <PlatformTableHeader>Date</PlatformTableHeader>
                        <PlatformTableHeader>Error</PlatformTableHeader>
                      </PlatformTableHead>
                      <PlatformTableBody>
                        {detail.syncErrors.map((p) => (
                          <PlatformTableRow key={p._id}>
                            <PlatformTableCell>{p.employeeName}</PlatformTableCell>
                            <PlatformTableCell className="text-[#9aa6a8]">
                              {formatDateUS(p.at)}
                            </PlatformTableCell>
                            <PlatformTableCell className="text-[#9aa6a8]">
                              {p.error ?? '—'}
                            </PlatformTableCell>
                          </PlatformTableRow>
                        ))}
                      </PlatformTableBody>
                    </PlatformTable>
                  )}
                </section>
              </>
            )}
          </div>
        </Dialog>
      </div>
    </PlatformGate>
  )
}
