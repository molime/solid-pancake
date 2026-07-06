import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { EmptyState } from '@/shared/ui/EmptyState'
import { CalendarPlus, CalendarDays } from 'lucide-react'
import {
  addDays,
  formatDateInput,
  formatWeekRangeLabel,
  getWeekStart,
} from '../model/schedulingUtils'
import type { EnrichedShift } from '../model/schedulingUtils'
import { ShiftEditorModal } from '../components/ShiftEditorModal'
import { ShiftPacketPanel } from '../components/ShiftPacketPanel'
import { CoverageRequestsPanel } from '../components/CoverageRequestsPanel'
import { cn } from '@/shared/lib/cn'

const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatCardName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/)
  if (parts.length === 0) return displayName
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  const last = parts[parts.length - 1]
  const firstInitial = parts[0][0]?.toUpperCase() ?? ''
  return `${firstInitial}. ${last}`
}

function formatCardTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const sh = start.getHours()
  const eh = end.getHours()
  return `${sh}–${eh}`
}

function lastName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : displayName
}

export function SchedulingPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const [weekAnchor, setWeekAnchor] = useState(() => getWeekStart(new Date()))
  const [caregiverFilter, setCaregiverFilter] = useState<string>('all')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editShift, setEditShift] = useState<EnrichedShift | undefined>(
    undefined,
  )
  const [packetShift, setPacketShift] = useState<EnrichedShift | null>(null)
  const [toast, setToast] = useState<{
    variant: 'success' | 'danger'
    message: string
  } | null>(null)

  const weekStart = weekAnchor
  const weekEnd = addDays(weekStart, 6)
  const startDate = formatDateInput(weekStart)
  const endDate = formatDateInput(weekEnd)

  const shiftsResult = useQuery(
    api.scheduling.listShifts,
    clerkOrgId
      ? {
          clerkOrgId,
          startDate,
          endDate,
          caregiverId:
            caregiverFilter && caregiverFilter !== 'all'
              ? caregiverFilter
              : undefined,
        }
      : 'skip',
  )
  const caregivers = useQuery(
    api.members.listCaregivers,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const coverageRequests = useQuery(
    api.scheduling.listCoverageRequests,
    clerkOrgId ? { clerkOrgId, status: 'open' } : 'skip',
  )

  const openCoverageShiftIds = useMemo(() => {
    const ids = new Set<string>()
    for (const request of coverageRequests ?? []) {
      if (request.shiftId) ids.add(request.shiftId)
    }
    return ids
  }, [coverageRequests])

  const shifts = shiftsResult?.items ?? []
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [weekStart])

  const today = new Date()

  const handlePrevWeek = () => setWeekAnchor((d) => addDays(d, -7))
  const handleNextWeek = () => setWeekAnchor((d) => addDays(d, 7))
  const handleThisWeek = () => setWeekAnchor(getWeekStart(new Date()))

  const openNewShift = () => {
    setEditShift(undefined)
    setEditorOpen(true)
  }

  const openEditShift = (shift: EnrichedShift) => {
    setEditShift(shift)
    setEditorOpen(true)
  }

  if (!shiftsResult || !caregivers) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-base text-atria-text-muted">Loading schedule…</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-[28px] font-bold text-atria-ink">Schedule</h1>
          <p className="text-base text-atria-text-secondary">
            Week of {formatWeekRangeLabel(weekStart, weekEnd)} · client visits
            and caregiver coverage
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            value={caregiverFilter}
            onChange={(e) => setCaregiverFilter(e.target.value)}
            className="min-w-[220px]"
            aria-label="Filter by caregiver"
          >
            <option value="all">All caregivers</option>
            {caregivers.map((cg) => (
              <option key={cg.clerkUserId} value={cg.clerkUserId}>
                {cg.displayName || cg.email}
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            size="lg"
            className="min-h-[52px] px-6"
            onClick={openNewShift}
          >
            <CalendarPlus className="h-5 w-5" />
            Add shift
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={handlePrevWeek}>
          ←
        </Button>
        <Button variant="secondary" size="sm" onClick={handleThisWeek}>
          This week
        </Button>
        <Button variant="secondary" size="sm" onClick={handleNextWeek}>
          →
        </Button>
      </div>

      {shifts.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="No shifts this week"
          description="Add a shift to start scheduling caregivers."
          action={
            <Button variant="primary" size="lg" onClick={openNewShift}>
              Add shift
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b border-atria-border">
              {days.map((day, index) => {
                const isToday = isSameLocalDay(day, today)
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'border-r border-atria-border py-3 text-center last:border-r-0',
                      isToday && 'bg-atria-success/5',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[13px] font-bold uppercase tracking-wide',
                        isToday
                          ? 'text-atria-text-secondary'
                          : 'text-atria-text-muted',
                      )}
                    >
                      {WEEK_DAYS[index]} {day.getDate()}
                      {isToday && ' · TODAY'}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-7 min-h-[420px]">
              {days.map((day) => {
                const isToday = isSameLocalDay(day, today)
                const dayShifts = shifts.filter((shift) =>
                  isSameLocalDay(new Date(shift.scheduledStart), day),
                )
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'border-r border-atria-border p-2 last:border-r-0',
                      isToday && 'bg-atria-success/5',
                    )}
                  >
                    <div className="flex flex-col gap-2">
                      {dayShifts.map((shift) => {
                        const hasOpenCoverage = openCoverageShiftIds.has(
                          shift._id,
                        )
                        return (
                          <button
                            key={shift._id}
                            type="button"
                            onClick={() => setPacketShift(shift)}
                            className={cn(
                              'min-h-[70px] w-full rounded-[10px] p-3 text-left transition-opacity hover:opacity-90',
                              hasOpenCoverage
                                ? 'bg-atria-danger/18'
                                : isToday
                                  ? 'bg-atria-success/18'
                                  : 'bg-atria-info/18',
                            )}
                          >
                            <p className="text-sm font-semibold text-atria-ink">
                              {hasOpenCoverage
                                ? '⚠ Open shift'
                                : formatCardName(shift.caregiverDisplayName)}
                            </p>
                            <p className="mt-1 text-[13px] text-atria-text-secondary">
                              {formatCardTimeRange(
                                shift.scheduledStart,
                                shift.scheduledEnd,
                              )}
                              {' · '}
                              {hasOpenCoverage
                                ? 'needs cover'
                                : lastName(shift.clientDisplayName)}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <CoverageRequestsPanel clerkOrgId={clerkOrgId} />

      <ShiftEditorModal
        key={editShift?._id ?? 'new'}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        clerkOrgId={clerkOrgId}
        shiftToEdit={editShift}
        onSuccess={(message) => {
          setEditorOpen(false)
          setEditShift(undefined)
          setToast({ variant: 'success', message })
          setTimeout(() => setToast(null), 4000)
        }}
      />

      <ShiftPacketPanel
        shift={packetShift}
        onClose={() => setPacketShift(null)}
        clerkOrgId={clerkOrgId}
        onEdit={openEditShift}
        onSuccess={(message) => {
          setPacketShift(null)
          setToast({ variant: 'success', message })
          setTimeout(() => setToast(null), 4000)
        }}
      />

      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={cn(
              'rounded-[var(--radius-atria-lg)] border px-4 py-3 shadow-[var(--shadow-atria-pop)]',
              toast.variant === 'success'
                ? 'border-atria-success/30 bg-atria-success-bg text-atria-success'
                : 'border-atria-danger/30 bg-atria-danger-bg text-atria-danger',
            )}
          >
            <p className="text-base font-semibold">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  )
}
