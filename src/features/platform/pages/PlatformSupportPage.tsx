import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { formatDateUS, formatTime } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { usePlatformAdmin } from '../usePlatformAdmin'
import { PlatformGate } from '../components/PlatformGate'
import {
  PlatformTable,
  PlatformTableBody,
  PlatformTableCell,
  PlatformTableHead,
  PlatformTableHeader,
  PlatformTableRow,
} from '../components/PlatformTable'

const DURATIONS = [30, 60, 120]

const fieldClass =
  'w-full rounded-lg border border-[#2a3437] bg-[#1e2629] px-3 py-2 text-[15px] text-[#f5f7f6] outline-none focus:border-[#22c55e]'

export function PlatformSupportPage() {
  const isAdmin = usePlatformAdmin()
  const tenants = useQuery(
    api.platform.listTenantsWithUsage,
    isAdmin ? {} : 'skip',
  )
  const events = useQuery(api.platform.listAuditEvents, isAdmin ? {} : 'skip')
  const requestSupportAccess = useMutation(api.platform.requestSupportAccess)

  const [tenantId, setTenantId] = useState('')
  const [reason, setReason] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const accessLog = (events ?? []).filter(
    (event) =>
      event.kind === 'platform' && event.action.startsWith('support_access'),
  )

  const handleSubmit = async () => {
    if (!tenantId || !reason.trim()) return
    setBusy(true)
    setError('')
    setSubmitted(false)
    try {
      await requestSupportAccess({
        tenantId: tenantId as Id<'tenants'>,
        reason: reason.trim(),
        durationMinutes,
      })
      setReason('')
      setSubmitted(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to request access.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <PlatformGate>
      <div className="space-y-6">
        <h1 className="text-[26px] font-bold text-[#f5f7f6]">
          Support Access
        </h1>

        <div className="max-w-xl rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5">
          <h2 className="text-lg font-bold text-[#f5f7f6]">
            Request support access
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#9aa6a8]">
                Agency
              </label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className={fieldClass}
              >
                <option value="">Select an agency…</option>
                {(tenants ?? []).map((tenant) => (
                  <option key={tenant._id} value={tenant._id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#9aa6a8]">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Why is support access needed?"
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#9aa6a8]">
                Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className={fieldClass}
              >
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-[#ef4444]">{error}</p>}
            {submitted && (
              <p className="text-sm text-[#22c55e]">
                Support access request recorded.
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={busy || !tenantId || !reason.trim()}
              className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0f10] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Submitting…' : 'Request access'}
            </button>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold text-[#f5f7f6]">Access log</h2>
          {!events ? (
            <p className="py-12 text-center text-sm text-[#9aa6a8]">
              Loading access log…
            </p>
          ) : accessLog.length === 0 ? (
            <p className="rounded-2xl border border-[#2a3437] bg-[#151b1d] py-12 text-center text-sm text-[#9aa6a8]">
              No support access requests yet.
            </p>
          ) : (
            <PlatformTable>
              <PlatformTableHead>
                <PlatformTableHeader>Tenant</PlatformTableHeader>
                <PlatformTableHeader>Action</PlatformTableHeader>
                <PlatformTableHeader>Reason</PlatformTableHeader>
                <PlatformTableHeader>Requested</PlatformTableHeader>
                <PlatformTableHeader>Duration</PlatformTableHeader>
                <PlatformTableHeader>By</PlatformTableHeader>
              </PlatformTableHead>
              <PlatformTableBody>
                {accessLog.map((event) => (
                  <PlatformTableRow key={event._id}>
                    <PlatformTableCell className="font-medium">
                      {event.tenantName}
                    </PlatformTableCell>
                    <PlatformTableCell className="text-[#9aa6a8]">
                      {event.action === 'support_access_ended'
                        ? 'Ended'
                        : 'Requested'}
                    </PlatformTableCell>
                    <PlatformTableCell className="max-w-[240px] truncate text-[#9aa6a8]">
                      {typeof event.metadata?.reason === 'string'
                        ? event.metadata.reason
                        : '—'}
                    </PlatformTableCell>
                    <PlatformTableCell className="whitespace-nowrap text-[#9aa6a8]">
                      {formatDateUS(event.createdAt)}{' '}
                      {formatTime(event.createdAt)}
                    </PlatformTableCell>
                    <PlatformTableCell className="text-[#9aa6a8]">
                      {typeof event.metadata?.durationMinutes === 'number'
                        ? `${event.metadata.durationMinutes} min`
                        : '—'}
                    </PlatformTableCell>
                    <PlatformTableCell className="max-w-[180px] truncate text-[#9aa6a8]">
                      {event.actorId}
                    </PlatformTableCell>
                  </PlatformTableRow>
                ))}
              </PlatformTableBody>
            </PlatformTable>
          )}
        </div>
      </div>
    </PlatformGate>
  )
}
