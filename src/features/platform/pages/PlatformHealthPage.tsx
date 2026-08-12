import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { formatDateUS } from '@/shared/format'
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

export function PlatformHealthPage() {
  const isAdmin = usePlatformAdmin()
  const health = useQuery(api.platform.getTenantHealth, isAdmin ? {} : 'skip')
  const [selectedTenantId, setSelectedTenantId] = useState<Id<'tenants'> | null>(
    null,
  )
  const detail = useQuery(
    api.platform.getTenantHealthDetail,
    isAdmin && selectedTenantId ? { tenantId: selectedTenantId } : 'skip',
  )

  const healthyCount = health?.filter((t) => t.status === 'healthy').length
  const complianceAlerts = health?.reduce(
    (sum, t) => sum + t.complianceAlerts,
    0,
  )
  const syncErrors = health?.reduce((sum, t) => sum + t.syncErrors, 0)
  const issuesCount = health?.filter((t) => t.status !== 'healthy').length

  const noIssues =
    detail &&
    detail.openCases.length === 0 &&
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
            label="Compliance alerts"
            value={complianceAlerts ?? '—'}
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
              <PlatformTableHeader>Compliance alerts</PlatformTableHeader>
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
                  <PlatformTableCell>{tenant.complianceAlerts}</PlatformTableCell>
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
                    Open HR Cases
                  </h4>
                  {detail.openCases.length === 0 ? (
                    <p className="text-sm text-[#9aa6a8]">None.</p>
                  ) : (
                    <PlatformTable>
                      <PlatformTableHead>
                        <PlatformTableHeader>Category</PlatformTableHeader>
                        <PlatformTableHeader>Flag Type</PlatformTableHeader>
                        <PlatformTableHeader>Subject</PlatformTableHeader>
                        <PlatformTableHeader>Status</PlatformTableHeader>
                        <PlatformTableHeader>Created</PlatformTableHeader>
                      </PlatformTableHead>
                      <PlatformTableBody>
                        {detail.openCases.map((c) => (
                          <PlatformTableRow key={c._id}>
                            <PlatformTableCell>{c.category}</PlatformTableCell>
                            <PlatformTableCell className="text-[#9aa6a8]">
                              {c.flagType ?? '—'}
                            </PlatformTableCell>
                            <PlatformTableCell>{c.title}</PlatformTableCell>
                            <PlatformTableCell>
                              <PlatformStatusPill status={c.status} />
                            </PlatformTableCell>
                            <PlatformTableCell className="text-[#9aa6a8]">
                              {formatDateUS(c.createdAt)}
                            </PlatformTableCell>
                          </PlatformTableRow>
                        ))}
                      </PlatformTableBody>
                    </PlatformTable>
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
