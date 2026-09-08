import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { formatDateUS, formatTime } from '@/shared/format'
import { cn } from '@/shared/lib/cn'
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

const KIND_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'platform', label: 'Platform' },
  { key: 'tenant', label: 'Tenant' },
]

function summarizeMetadata(metadata?: Record<string, unknown>): string {
  if (!metadata) return '—'
  const text = JSON.stringify(metadata)
  return text.length > 80 ? `${text.slice(0, 80)}…` : text
}

export function PlatformAuditPage() {
  const isAdmin = usePlatformAdmin()
  const events = useQuery(api.platform.listAuditEvents, isAdmin ? {} : 'skip')
  const [kindFilter, setKindFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('')

  const filtered = (events ?? []).filter((event) => {
    if (kindFilter !== 'all' && (event.kind ?? 'tenant') !== kindFilter) {
      return false
    }
    if (
      actorFilter &&
      !event.actorId.toLowerCase().includes(actorFilter.toLowerCase())
    ) {
      return false
    }
    return true
  })

  return (
    <PlatformGate>
      <div className="space-y-6">
        <h1 className="text-[26px] font-bold text-[#f5f7f6]">Audit Log</h1>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {KIND_FILTERS.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setKindFilter(filter.key)}
                className={cn(
                  'rounded-[15px] px-3 py-1 text-[13px] font-semibold transition-colors',
                  kindFilter === filter.key
                    ? 'bg-[rgba(34,197,94,0.16)] text-[#22c55e]'
                    : 'bg-[#1e2629] text-[#9aa6a8] hover:text-[#f5f7f6]',
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <input
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="Filter by actor…"
            className="w-64 rounded-lg border border-[#2a3437] bg-[#1e2629] px-3 py-2 text-sm text-[#f5f7f6] outline-none placeholder:text-[#687173] focus:border-[#22c55e]"
          />
        </div>

        {!events ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            Loading audit events…
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            No audit events match the filters.
          </p>
        ) : (
          <PlatformTable>
            <PlatformTableHead>
              <PlatformTableHeader>Actor</PlatformTableHeader>
              <PlatformTableHeader>Action</PlatformTableHeader>
              <PlatformTableHeader>Tenant</PlatformTableHeader>
              <PlatformTableHeader>Kind</PlatformTableHeader>
              <PlatformTableHeader>Timestamp</PlatformTableHeader>
              <PlatformTableHeader>Metadata</PlatformTableHeader>
            </PlatformTableHead>
            <PlatformTableBody>
              {filtered.map((event) => (
                <PlatformTableRow key={event._id}>
                  <PlatformTableCell className="max-w-[180px] truncate text-[#9aa6a8]">
                    {event.actorName ?? event.actorId}
                  </PlatformTableCell>
                  <PlatformTableCell className="font-medium">
                    {event.action}
                  </PlatformTableCell>
                  <PlatformTableCell className="text-[#9aa6a8]">
                    {event.tenantName}
                  </PlatformTableCell>
                  <PlatformTableCell className="text-[#9aa6a8]">
                    {event.kind ?? 'tenant'}
                  </PlatformTableCell>
                  <PlatformTableCell className="whitespace-nowrap text-[#9aa6a8]">
                    {formatDateUS(event.createdAt)}{' '}
                    {formatTime(event.createdAt)}
                  </PlatformTableCell>
                  <PlatformTableCell className="max-w-[260px] truncate text-[13px] text-[#687173]">
                    {summarizeMetadata(event.metadata)}
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
