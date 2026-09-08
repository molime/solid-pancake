import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { formatDateUS, formatStatusLabel, formatTime } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { Dialog } from '@/shared/ui/Dialog'
import { usePlatformAdmin } from '../usePlatformAdmin'
import { PlatformGate } from '../components/PlatformGate'
import { PlatformStatusPill } from '../components/PlatformStatusPill'
import {
  PlatformTable,
  PlatformTableBody,
  PlatformTableCell,
  PlatformTableHead,
  PlatformTableHeader,
  PlatformTableRow,
} from '../components/PlatformTable'

const DURATIONS = [30, 60, 120]

const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const

type TicketStatus = (typeof TICKET_STATUSES)[number]

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

  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('')
  const tickets = useQuery(
    api.supportTickets.listAll,
    isAdmin ? (statusFilter ? { status: statusFilter } : {}) : 'skip',
  )
  const setTicketStatus = useMutation(api.supportTickets.setStatus)
  const addTicketNote = useMutation(api.supportTickets.addNote)
  const [selectedTicketId, setSelectedTicketId] =
    useState<Id<'supportTickets'> | null>(null)
  const [noteInput, setNoteInput] = useState('')

  // Fetch the open ticket unfiltered so the dialog stays alive when a status
  // change drops it out of the active list filter.
  const selectedTicket = useQuery(
    api.supportTickets.get,
    isAdmin && selectedTicketId ? { ticketId: selectedTicketId } : 'skip',
  )

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

  const handleSetTicketStatus = async (status: TicketStatus) => {
    if (!selectedTicketId) return
    setError('')
    try {
      await setTicketStatus({ ticketId: selectedTicketId, status })
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to update ticket status.',
      )
    }
  }

  const handleAddNote = async () => {
    if (!selectedTicketId || !noteInput.trim()) return
    setBusy(true)
    setError('')
    try {
      await addTicketNote({
        ticketId: selectedTicketId,
        note: noteInput.trim(),
      })
      setNoteInput('')
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to add note.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <PlatformGate>
      <div className="space-y-6">
        <h1 className="text-[26px] font-bold text-[#f5f7f6]">Support</h1>

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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#f5f7f6]">
              Support tickets
            </h2>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as TicketStatus | '')
              }
              className="w-[180px] rounded-lg border border-[#2a3437] bg-[#1e2629] px-3 py-2 text-sm text-[#f5f7f6] outline-none focus:border-[#22c55e]"
            >
              <option value="">All statuses</option>
              {TICKET_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>
          {!tickets ? (
            <p className="py-12 text-center text-sm text-[#9aa6a8]">
              Loading tickets…
            </p>
          ) : tickets.length === 0 ? (
            <p className="rounded-2xl border border-[#2a3437] bg-[#151b1d] py-12 text-center text-sm text-[#9aa6a8]">
              No support tickets yet.
            </p>
          ) : (
            <PlatformTable>
              <PlatformTableHead>
                <PlatformTableHeader>Agency</PlatformTableHeader>
                <PlatformTableHeader>Subject</PlatformTableHeader>
                <PlatformTableHeader>Category</PlatformTableHeader>
                <PlatformTableHeader>Priority</PlatformTableHeader>
                <PlatformTableHeader>Status</PlatformTableHeader>
                <PlatformTableHeader>Created</PlatformTableHeader>
              </PlatformTableHead>
              <PlatformTableBody>
                {tickets.map((ticket) => (
                  <PlatformTableRow
                    key={ticket._id}
                    onClick={() => {
                      setSelectedTicketId(ticket._id)
                      setNoteInput('')
                      setError('')
                    }}
                  >
                    <PlatformTableCell className="font-medium">
                      {ticket.tenantName}
                    </PlatformTableCell>
                    <PlatformTableCell className="max-w-[240px] truncate">
                      {ticket.subject}
                    </PlatformTableCell>
                    <PlatformTableCell className="text-[#9aa6a8]">
                      {formatStatusLabel(ticket.category)}
                    </PlatformTableCell>
                    <PlatformTableCell className="text-[#9aa6a8]">
                      {formatStatusLabel(ticket.priority)}
                    </PlatformTableCell>
                    <PlatformTableCell>
                      <PlatformStatusPill status={ticket.status} />
                    </PlatformTableCell>
                    <PlatformTableCell className="whitespace-nowrap text-[#9aa6a8]">
                      {formatDateUS(ticket.createdAt)}
                    </PlatformTableCell>
                  </PlatformTableRow>
                ))}
              </PlatformTableBody>
            </PlatformTable>
          )}
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

        <Dialog
          open={selectedTicketId !== null}
          onClose={() => setSelectedTicketId(null)}
          className="border-[#2a3437] bg-[#151b1d]"
        >
          <div className="border-b border-[#2a3437] px-6 py-5">
            <h3 className="text-lg font-bold text-[#f5f7f6]">
              {selectedTicket?.subject ?? 'Support ticket'}
            </h3>
            {selectedTicket && (
              <p className="mt-1 text-sm text-[#687173]">
                {selectedTicket.tenantName} ·{' '}
                {formatStatusLabel(selectedTicket.category)} ·{' '}
                {formatStatusLabel(selectedTicket.priority)} priority · opened{' '}
                {formatDateUS(selectedTicket.createdAt)} by{' '}
                {selectedTicket.createdByName}
              </p>
            )}
          </div>
          <div className="space-y-4 overflow-y-auto p-6">
            {!selectedTicket ? (
              <p className="py-8 text-center text-sm text-[#9aa6a8]">
                Loading ticket…
              </p>
            ) : (
              <>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-[#9aa6a8]">
                    Description
                  </p>
                  <p className="whitespace-pre-line text-[15px] text-[#f5f7f6]">
                    {selectedTicket.description}
                  </p>
                </div>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-[#9aa6a8]">
                    Platform notes
                  </p>
                  {selectedTicket.platformNotes ? (
                    <p className="whitespace-pre-line text-[15px] text-[#f5f7f6]">
                      {selectedTicket.platformNotes}
                    </p>
                  ) : (
                    <p className="text-sm text-[#687173]">No notes yet.</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#9aa6a8]">
                    Status
                  </label>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) =>
                      handleSetTicketStatus(e.target.value as TicketStatus)
                    }
                    className={fieldClass}
                  >
                    {TICKET_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#9aa6a8]">
                    Add note
                  </label>
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    rows={3}
                    placeholder="Internal note for the platform team"
                    className={fieldClass}
                  />
                </div>
                {error && <p className="text-sm text-[#ef4444]">{error}</p>}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#2a3437] px-6 py-5">
            <button
              onClick={() => setSelectedTicketId(null)}
              className="rounded-lg border border-[#2a3437] px-4 py-2 text-sm font-medium text-[#9aa6a8] transition-colors hover:text-[#f5f7f6]"
            >
              Close
            </button>
            <button
              onClick={handleAddNote}
              disabled={busy || !noteInput.trim()}
              className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0f10] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Add note'}
            </button>
          </div>
        </Dialog>
      </div>
    </PlatformGate>
  )
}
