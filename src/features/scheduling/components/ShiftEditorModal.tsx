import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Check, AlertCircle } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import {
  coversSlot,
  formatDateInput,
  parseConflictError,
  toIsoFromLocal,
} from '../model/schedulingUtils'
import type { EnrichedShift } from '../model/schedulingUtils'

type ShiftEditorModalProps = {
  open: boolean
  onClose: () => void
  clerkOrgId?: string
  shiftToEdit?: EnrichedShift
  onSuccess?: (message: string) => void
}

function formatTimeInput(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function ShiftEditorModal({
  open,
  onClose,
  clerkOrgId,
  shiftToEdit,
  onSuccess,
}: ShiftEditorModalProps) {
  const createShift = useMutation(api.scheduling.createShift)
  const updateShift = useMutation(api.scheduling.updateShift)
  const clients = useQuery(
    api.clients.list,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const caregivers = useQuery(
    api.members.listCaregivers,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const [form, setForm] = useState(() => {
    if (shiftToEdit) {
      const start = new Date(shiftToEdit.scheduledStart)
      const end = new Date(shiftToEdit.scheduledEnd)
      return {
        clientId: shiftToEdit.clientId,
        caregiverId: shiftToEdit.caregiverId,
        date: formatDateInput(start),
        startTime: formatTimeInput(start),
        endTime: formatTimeInput(end),
        serviceType: shiftToEdit.serviceType,
        rate: shiftToEdit.rate,
        notes: '',
      }
    }
    return {
      clientId: '',
      caregiverId: caregivers?.[0]?.clerkUserId ?? '',
      date: formatDateInput(new Date()),
      startTime: '09:00',
      endTime: '13:00',
      serviceType: 'SLS' as 'SLS' | 'ILS',
      rate: 28.5,
      notes: '',
    }
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const availability = useQuery(
    api.scheduling.listAvailabilityForScheduling,
    clerkOrgId && form.caregiverId
      ? { clerkOrgId, caregiverId: form.caregiverId }
      : 'skip',
  )

  const availabilityStatus = useMemo(() => {
    if (!form.caregiverId || !form.date || !form.startTime || !form.endTime) {
      return null
    }
    if (!availability) return null
    return coversSlot(availability, form.date, form.startTime, form.endTime)
  }, [availability, form.caregiverId, form.date, form.startTime, form.endTime])

  const selectedCaregiver = useMemo(
    () => caregivers?.find((cg) => cg.clerkUserId === form.caregiverId),
    [caregivers, form.caregiverId],
  )
  const selectedClient = useMemo(
    () => clients?.find((c) => c._id === form.clientId),
    [clients, form.clientId],
  )

  const handleSubmit = async () => {
    if (!clerkOrgId) return
    setError(null)

    if (!form.clientId || !form.caregiverId || !form.date) {
      setError('Please select a client, caregiver, and date.')
      return
    }

    if (form.endTime <= form.startTime) {
      setError('End time must be after start time.')
      return
    }

    setSubmitting(true)
    try {
      const scheduledStart = toIsoFromLocal(form.date, form.startTime)
      const scheduledEnd = toIsoFromLocal(form.date, form.endTime)

      if (shiftToEdit) {
        await updateShift({
          clerkOrgId,
          shiftId: shiftToEdit._id,
          clientId: form.clientId as Id<'clients'>,
          caregiverId: form.caregiverId,
          scheduledStart,
          scheduledEnd,
          serviceType: form.serviceType,
          rate: form.rate,
        })
        onSuccess?.('Shift updated')
      } else {
        await createShift({
          clerkOrgId,
          clientId: form.clientId as Id<'clients'>,
          caregiverId: form.caregiverId,
          scheduledStart,
          scheduledEnd,
          serviceType: form.serviceType,
          rate: form.rate,
        })
        onSuccess?.('Shift created')
      }
    } catch (err) {
      const message = err instanceof Error ? sanitizeConvexError(err.message) : String(err)
      const conflict = parseConflictError(message)
      if (conflict) {
        const startHm = conflict.start.slice(11, 16)
        const endHm = conflict.end.slice(11, 16)
        setError(
          `Schedule conflict: this caregiver already has a shift from ${startHm} to ${endHm} on this date.`,
        )
      } else {
        setError(message)
      }
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>{shiftToEdit ? 'Edit shift' : 'New shift'}</DialogTitle>
      </DialogHeader>
      <DialogContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
          <div className="space-y-5 p-6">
            {error && (
              <div className="rounded-md border border-atria-danger/30 bg-atria-danger-bg px-3 py-2 text-sm text-atria-danger">
                {error}
              </div>
            )}

            <FieldGroup label="CLIENT" htmlFor="shift-client" required>
              <Select
                id="shift-client"
                data-testid="shift-client-select"
                value={form.clientId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, clientId: e.target.value }))
                }
                controlSize="lg"
              >
                <option value="" disabled>
                  Select client
                </option>
                {clients?.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.displayName}
                  </option>
                ))}
              </Select>
            </FieldGroup>

            <FieldGroup label="CAREGIVER" htmlFor="shift-caregiver" required>
              <Select
                id="shift-caregiver"
                data-testid="shift-caregiver-select"
                value={form.caregiverId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, caregiverId: e.target.value }))
                }
                controlSize="lg"
                className={cn(
                  availabilityStatus === 'available' &&
                    'border-atria-success focus:border-atria-success focus:ring-atria-success',
                )}
              >
                <option value="" disabled>
                  Select caregiver
                </option>
                {caregivers?.map((cg) => (
                  <option key={cg.clerkUserId} value={cg.clerkUserId}>
                    {cg.displayName || cg.email}
                  </option>
                ))}
              </Select>
            </FieldGroup>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldGroup label="DATE" htmlFor="shift-date" required>
                <Input
                  id="shift-date"
                  data-testid="shift-date-input"
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                  controlSize="lg"
                />
              </FieldGroup>
              <FieldGroup label="TIME" htmlFor="shift-start" required>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    id="shift-start"
                    data-testid="shift-start-input"
                    type="time"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startTime: e.target.value }))
                    }
                    controlSize="lg"
                  />
                  <Input
                    id="shift-end"
                    data-testid="shift-end-input"
                    type="time"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endTime: e.target.value }))
                    }
                    controlSize="lg"
                  />
                </div>
              </FieldGroup>
            </div>

            <FieldGroup label="SERVICE TYPE" htmlFor="shift-service-type" required>
              <Select
                id="shift-service-type"
                value={form.serviceType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    serviceType: e.target.value as 'SLS' | 'ILS',
                  }))
                }
                controlSize="lg"
              >
                <option value="SLS">Supported Living Services (SLS)</option>
                <option value="ILS">Independent Living Skills (ILS)</option>
              </Select>
            </FieldGroup>

            <FieldGroup label="RATE" htmlFor="shift-rate" required>
              <Input
                id="shift-rate"
                type="number"
                step="0.01"
                min={0.01}
                value={form.rate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rate: Number(e.target.value) }))
                }
                controlSize="lg"
              />
            </FieldGroup>

            <FieldGroup label="NOTES (OPTIONAL)" htmlFor="shift-notes">
              <Textarea
                id="shift-notes"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Add anything the caregiver should know…"
              />
            </FieldGroup>

            <DialogFooter className="px-0 pb-0">
              <Button variant="secondary" size="lg" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="lg"
                data-testid="save-shift-button"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Saving…' : shiftToEdit ? 'Save shift' : 'Save shift'}
              </Button>
            </DialogFooter>
          </div>

          <div className="border-t border-atria-border bg-atria-surface-2/50 p-6 lg:border-l lg:border-t-0">
            <h4 className="text-lg font-semibold text-atria-ink">
              Eligibility check
            </h4>
            <p className="mt-1 text-base text-atria-text-secondary">
              {selectedCaregiver
                ? `${selectedCaregiver.displayName || selectedCaregiver.email} for this visit`
                : 'Select a caregiver to review eligibility.'}
            </p>

            <div className="mt-5 space-y-3">
              <EligibilityRow
                ok={Boolean(selectedCaregiver)}
                label="Caregiver selected"
              />
              <EligibilityRow
                ok={availabilityStatus === 'available'}
                label="Availability covers this slot"
              />
              <EligibilityRow
                ok={Boolean(selectedClient)}
                label="Client selected"
              />
            </div>

            {availabilityStatus && (
              <div
                data-testid="availability-banner"
                className={cn(
                  'mt-5 rounded-[var(--radius-atria-md)] border px-3 py-2 text-center text-base font-semibold',
                  availabilityStatus === 'available'
                    ? 'border-atria-success/30 bg-atria-success-bg text-atria-success'
                    : 'border-atria-warning/30 bg-atria-warning-bg text-atria-warning',
                )}
              >
                {availabilityStatus === 'available'
                  ? 'Eligible — safe to schedule'
                  : availabilityStatus === 'no-windows'
                    ? 'No availability declared'
                    : 'Availability does not cover slot'}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EligibilityRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-base">
      {ok ? (
        <Check className="h-4 w-4 text-atria-success" />
      ) : (
        <AlertCircle className="h-4 w-4 text-atria-text-muted" />
      )}
      <span className={ok ? 'text-atria-success' : 'text-atria-text-secondary'}>
        {label}
      </span>
    </div>
  )
}
