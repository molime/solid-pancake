import { useUser } from '@clerk/react'
import { useTenant } from '@/app/useTenant'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useState } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { CalendarDays, Clock } from 'lucide-react'
import { ShiftPacketPanel } from '../components/ShiftPacketPanel'
import { formatTime, formatWeekdayDate } from '@/shared/format'
import type { EnrichedShift } from '../model/schedulingUtils'

export function CaregiverSchedulePage() {
  const { clerkOrgId } = useTenant()
  const { user } = useUser()
  const firstName = user?.firstName ?? ''

  const shifts = useQuery(
    api.scheduling.listCaregiverShifts,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const [selectedShift, setSelectedShift] = useState<EnrichedShift | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  if (!shifts) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-base text-atria-text-muted">Loading shifts…</div>
      </div>
    )
  }

  if (shifts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-atria-surface-2">
            <CalendarDays className="h-7 w-7 text-atria-text-muted" />
          </div>
          <p className="text-base font-semibold text-atria-ink">
            No upcoming shifts
          </p>
          <p className="mt-1 text-base text-atria-text-secondary">
            You have no scheduled visits. Contact your coordinator if you
            expect assignments.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-[28px] font-bold text-atria-ink">
          {firstName ? `Hi, ${firstName}` : 'My Schedule'}
        </h1>
        <p className="text-base text-atria-text-secondary">
          Upcoming visits assigned to you.
        </p>
      </div>

      <div className="space-y-3">
        {shifts.map((shift) => {
          const start = formatTime(shift.scheduledStart)
          const end = formatTime(shift.scheduledEnd)
          return (
            <button
              key={shift._id}
              type="button"
              onClick={() => setSelectedShift(shift)}
              className="w-full text-left"
            >
              <Card className="transition-colors hover:border-atria-border-strong">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-base font-semibold text-atria-ink">
                      {formatWeekdayDate(shift.scheduledStart)}
                    </p>
                    <p className="text-base text-atria-text-secondary">
                      {shift.clientDisplayName}
                    </p>
                    <p className="flex items-center gap-1 text-base text-atria-text-secondary">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {start} – {end}
                      </span>
                    </p>
                  </div>
                  <StatusBadge status={shift.status as never} />
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      <ShiftPacketPanel
        shift={selectedShift}
        onClose={() => setSelectedShift(null)}
        clerkOrgId={clerkOrgId}
        onEdit={() => {}}
        onSuccess={(message) => {
          setSelectedShift(null)
          setToast(message)
          setTimeout(() => setToast(null), 4000)
        }}
      />

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-[var(--radius-atria-lg)] border border-atria-success/30 bg-atria-success-bg px-4 py-3 text-base font-semibold text-atria-success shadow-[var(--shadow-atria-pop)]">
          {toast}
        </div>
      )}
    </div>
  )
}
