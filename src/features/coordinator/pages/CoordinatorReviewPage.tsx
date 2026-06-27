import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ReviewDetail } from '../components/ReviewDetail'
import { ClipboardCheck, ArrowRight, Clock } from 'lucide-react'

type ReviewFilter = 'pending' | 'approved' | 'returned'

interface QueueRow {
  shift: Doc<'shifts'>
  caregiverName: string
  clientName: string
  statusLabel: string
  statusVariant: 'info' | 'danger' | 'success'
}

export function CoordinatorReviewPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const reviewShifts = useQuery(
    api.shiftQueries.listForReview,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const approvedShifts = useQuery(
    api.shiftQueries.listBillingReady,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const clients = useQuery(
    api.clients.list,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const caregivers = useQuery(
    api.members.listCaregivers,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const [selectedShiftId, setSelectedShiftId] = useState<Id<'shifts'> | null>(
    null,
  )
  const [filter, setFilter] = useState<ReviewFilter>('pending')

  const isLoading =
    reviewShifts === undefined ||
    approvedShifts === undefined ||
    clients === undefined ||
    caregivers === undefined

  const { pendingRows, returnedRows, approvedRows } = useMemo(() => {
    const clientMap = new Map(clients?.map((c) => [c._id, c.displayName]) ?? [])
    const caregiverMap = new Map(
      caregivers?.map((c) => [c.clerkUserId, c.displayName]) ?? [],
    )

    const buildRow = (
      shift: Doc<'shifts'>,
      statusLabel: string,
      statusVariant: 'info' | 'danger' | 'success',
    ): QueueRow => ({
      shift,
      caregiverName:
        caregiverMap.get(shift.caregiverId) ?? 'Unknown caregiver',
      clientName: clientMap.get(shift.clientId) ?? 'Unknown client',
      statusLabel,
      statusVariant,
    })

    const pending =
      reviewShifts
        ?.filter((shift) => shift.status === 'submitted')
        .map((shift) => buildRow(shift, 'Submitted', 'info')) ?? []

    const returned =
      reviewShifts
        ?.filter((shift) => shift.status === 'needs_correction')
        .map((shift) => buildRow(shift, 'Needs correction', 'danger')) ?? []

    const approved =
      approvedShifts?.map((shift) =>
        buildRow(shift, 'Approved', 'success'),
      ) ?? []

    return { pendingRows: pending, returnedRows: returned, approvedRows: approved }
  }, [reviewShifts, approvedShifts, clients, caregivers])

  const visibleRows =
    filter === 'pending'
      ? pendingRows
      : filter === 'approved'
        ? approvedRows
        : returnedRows

  const selectedRow = useMemo(
    () =>
      visibleRows.find((row) => row.shift._id === selectedShiftId) ??
      pendingRows.find((row) => row.shift._id === selectedShiftId) ??
      returnedRows.find((row) => row.shift._id === selectedShiftId) ??
      approvedRows.find((row) => row.shift._id === selectedShiftId),
    [selectedShiftId, visibleRows, pendingRows, returnedRows, approvedRows],
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-atria-muted">
          <Clock className="h-4 w-4 animate-spin" />
          Loading review queue…
        </div>
      </div>
    )
  }

  if (selectedShiftId && selectedRow && clerkOrgId) {
    return (
      <ReviewDetail
        clerkOrgId={clerkOrgId}
        caregiverName={selectedRow.caregiverName}
        clientName={selectedRow.clientName}
        onBack={() => setSelectedShiftId(null)}
        shiftId={selectedShiftId}
      />
    )
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-atria-ink">
          Documentation to review
        </h1>
        <p className="text-base text-atria-muted">
          {pendingRows.length} shift note{pendingRows.length !== 1 ? 's' : ''}{' '}
          {pendingRows.length === 1 ? 'is' : 'are'} waiting for your review.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterTab
          active={filter === 'pending'}
          count={pendingRows.length}
          label="Pending"
          onClick={() => setFilter('pending')}
          data-testid="filter-pending"
        />
        <FilterTab
          active={filter === 'approved'}
          count={approvedRows.length}
          label="Approved"
          onClick={() => setFilter('approved')}
          data-testid="filter-approved"
        />
        <FilterTab
          active={filter === 'returned'}
          count={returnedRows.length}
          label="Returned"
          onClick={() => setFilter('returned')}
          data-testid="filter-returned"
        />
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-4 border-b border-atria-border px-6 py-3 text-xs font-semibold uppercase tracking-wider text-atria-muted">
            <div className="col-span-5">Caregiver & Client</div>
            <div className="col-span-4">Shift</div>
            <div className="col-span-3 text-right">Status</div>
          </div>

          <div className="divide-y divide-atria-border">
            {visibleRows.length === 0 && (
              <div className="p-6">
                <EmptyState
                  icon={<ClipboardCheck className="h-6 w-6" />}
                  title={`No ${filter} shifts`}
                  description={`There are no ${filter} documentation notes to display right now.`}
                />
              </div>
            )}

            {visibleRows.map((row) => (
              <div
                key={row.shift._id}
                className="grid grid-cols-12 items-center gap-4 px-6 py-4 transition-colors hover:bg-atria-surface-2/50"
                data-testid={`review-row-${row.shift._id}`}
                data-shift-status={row.shift.status}
              >
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-atria-accent/20 text-atria-accent">
                    <span className="text-sm font-semibold">
                      {getInitials(row.caregiverName)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-atria-ink">
                      {row.caregiverName}{' '}
                      <span className="text-atria-muted">→</span>{' '}
                      {row.clientName}
                    </p>
                    <p className="text-xs text-atria-muted">
                      {row.statusLabel} {formatShiftDate(row.shift.scheduledStart)}
                    </p>
                  </div>
                </div>

                <div className="col-span-4 text-sm text-atria-ink">
                  {formatTimeRange(row.shift.scheduledStart, row.shift.scheduledEnd)}
                </div>

                <div className="col-span-3 flex items-center justify-end gap-3">
                  <Badge variant={row.statusVariant} data-testid="review-status-badge">{row.statusLabel}</Badge>
                  <button
                    className="inline-flex items-center gap-1 text-sm font-medium text-atria-accent transition-colors hover:text-atria-accent-hover"
                    onClick={() => setSelectedShiftId(row.shift._id)}
                    type="button"
                    data-testid={`review-button-${row.shift._id}`}
                  >
                    Review <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FilterTab({
  active,
  count,
  label,
  onClick,
  'data-testid': testId,
}: {
  active: boolean
  count: number
  label: string
  onClick: () => void
  'data-testid'?: string
}) {
  return (
    <button
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-atria-warning-bg text-atria-warning'
          : 'bg-atria-surface text-atria-text-secondary hover:bg-atria-surface-2'
      }`}
      onClick={onClick}
      type="button"
      data-testid={testId}
    >
      {label} · {count}
    </button>
  )
}

function formatShiftDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  if (isToday) return `today · ${time}`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  return `${fmt(start)} – ${fmt(end)}`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
