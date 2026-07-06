import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Checkbox } from '@/shared/ui/Checkbox'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  addDays,
  formatDateInput,
  formatWeekRangeLabel,
  getWeekStart,
} from '../model/schedulingUtils'

const DAY_LABELS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const DAY_TO_JS_DAY = [1, 2, 3, 4, 5, 6, 0]

function formatWindowTime(startTime: string, endTime: string): string {
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d
  }
  const start = parse(startTime)
  const end = parse(endTime)
  return `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
}

export function AvailabilityPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const windows = useQuery(
    api.scheduling.listMyAvailability,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const addWindow = useMutation(api.scheduling.addAvailabilityWindow)
  const deleteWindow = useMutation(api.scheduling.deleteAvailabilityWindow)

  const [expandedDay, setExpandedDay] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [form, setForm] = useState({
    kind: 'recurring' as 'recurring' | 'override',
    date: formatDateInput(new Date()),
    startTime: '09:00',
    endTime: '17:00',
    available: true,
  })

  const weekStart = useMemo(() => getWeekStart(new Date()), [])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  if (!windows) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-base text-atria-text-muted">
          Loading availability…
        </div>
      </div>
    )
  }

  const windowsForDay = (index: number) => {
    const jsDay = DAY_TO_JS_DAY[index]
    const dateStr = formatDateInput(weekDays[index])
    return windows.filter(
      (w) =>
        (w.kind === 'recurring' && w.dayOfWeek === jsDay) ||
        (w.kind === 'one-off' && w.date === dateStr),
    )
  }

  const openAdd = (index: number) => {
    setExpandedDay(index)
    setForm({
      kind: 'recurring',
      date: formatDateInput(weekDays[index]),
      startTime: '09:00',
      endTime: '17:00',
      available: true,
    })
  }

  const handleAdd = async (index: number) => {
    if (!clerkOrgId) return
    if (form.endTime <= form.startTime) {
      window.alert('End time must be after start time.')
      return
    }
    const jsDay = DAY_TO_JS_DAY[index]
    try {
      await addWindow({
        clerkOrgId,
        kind: form.kind === 'override' ? 'one-off' : 'recurring',
        dayOfWeek: form.kind === 'recurring' ? jsDay : undefined,
        date: form.kind === 'override' ? form.date : undefined,
        startTime: form.startTime,
        endTime: form.endTime,
        available: form.available,
      })
      setExpandedDay(null)
      setToast('Availability updated')
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (windowId: Id<'availabilityWindows'>) => {
    if (!clerkOrgId) return
    if (!window.confirm('Delete this availability window?')) return
    try {
      await deleteWindow({ clerkOrgId, windowId })
      setToast('Availability updated')
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        to="/caregiver/schedule"
        className="flex items-center gap-1 text-base font-semibold text-atria-accent"
      >
        <ChevronLeft className="h-4 w-4" />
        My Schedule
      </Link>

      <div className="space-y-1">
        <h1 className="text-[28px] font-bold text-atria-ink">My Availability</h1>
        <p className="text-base text-atria-text-secondary">
          Set the days and times you&apos;re available to work this week.
        </p>
        <p className="text-[13px] text-atria-text-muted">
          Week of {formatWeekRangeLabel(weekStart, addDays(weekStart, 6))}
        </p>
      </div>

      <div className="space-y-3">
        {DAY_LABELS.map((label, index) => {
          const dayWindows = windowsForDay(index)
          const isExpanded = expandedDay === index
          return (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex min-h-[56px] items-center justify-between">
                  <p className="text-base font-semibold text-atria-ink">
                    {label}
                  </p>
                  {dayWindows.length > 0 ? (
                    <div className="flex flex-col items-end gap-1">
                      {dayWindows.map((w) => (
                        <div
                          key={w._id}
                          className="flex items-center gap-2 text-base text-atria-success"
                        >
                          <span>
                            {w.available
                              ? formatWindowTime(w.startTime, w.endTime)
                              : 'Unavailable'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDelete(w._id)}
                            className="rounded p-1 text-atria-danger hover:bg-atria-danger/10"
                            aria-label="Delete window"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-base text-atria-text-muted">Off</span>
                  )}
                </div>

                {!isExpanded && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full text-atria-accent"
                    onClick={() => openAdd(index)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add window
                  </Button>
                )}

                {isExpanded && (
                  <div className="mt-4 space-y-3 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-3">
                    <FieldGroup label="Kind">
                      <Select
                        value={form.kind}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            kind: e.target.value as 'recurring' | 'override',
                          }))
                        }
                      >
                        <option value="recurring">Recurring</option>
                        <option value="override">Override</option>
                      </Select>
                    </FieldGroup>

                    {form.kind === 'override' && (
                      <FieldGroup label="Date">
                        <Input
                          type="date"
                          value={form.date}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, date: e.target.value }))
                          }
                        />
                      </FieldGroup>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <FieldGroup label="Start" htmlFor="window-start">
                        <Input
                          id="window-start"
                          type="time"
                          value={form.startTime}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              startTime: e.target.value,
                            }))
                          }
                        />
                      </FieldGroup>
                      <FieldGroup label="End" htmlFor="window-end">
                        <Input
                          id="window-end"
                          type="time"
                          value={form.endTime}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              endTime: e.target.value,
                            }))
                          }
                        />
                      </FieldGroup>
                    </div>

                    <label className="flex items-center gap-2 text-base text-atria-ink">
                      <Checkbox
                        checked={form.available}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            available: (e.target as HTMLInputElement).checked,
                          }))
                        }
                      />
                      Available
                    </label>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setExpandedDay(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAdd(index)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Button
        variant="primary"
        size="lg"
        className="h-[52px] w-full rounded-full"
        onClick={() => {
          setToast('Availability saved')
          setTimeout(() => setToast(null), 3000)
        }}
      >
        Save changes
      </Button>
      <p className="text-center text-[13px] text-atria-text-muted">
        Changes apply to this week only. Update again next week.
      </p>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-[var(--radius-atria-lg)] border border-atria-success/30 bg-atria-success-bg px-4 py-3 text-base font-semibold text-atria-success shadow-[var(--shadow-atria-pop)]">
          {toast}
        </div>
      )}
    </div>
  )
}
