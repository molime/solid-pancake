import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Textarea } from '@/shared/ui/Textarea'
import { Separator } from '@/shared/ui/Separator'
import { ArrowLeft, MapPin, Home, Phone, Check, Star, Printer } from 'lucide-react'
import {
  formatAddress,
  formatDurationHours,
  formatTime,
  formatWeekdayDate,
} from '@/shared/format'
import type { EnrichedShift } from '../model/schedulingUtils'
import type { ShiftStatus } from '@/shared/domain/types'

type ShiftPacketPanelProps = {
  shift: EnrichedShift | null
  clerkOrgId?: string
  onClose: () => void
  onEdit: (shift: EnrichedShift) => void
  onSuccess?: (message: string) => void
}

export function ShiftPacketPanel({
  shift,
  clerkOrgId,
  onClose,
  onEdit,
  onSuccess,
}: ShiftPacketPanelProps) {
  const member = useQuery(
    api.members.me,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const details = useQuery(
    api.shiftQueries.getWithDetails,
    clerkOrgId && shift ? { clerkOrgId, shiftId: shift._id } : 'skip',
  )
  const auditEvents = useQuery(
    api.audit.list,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const caregivers = useQuery(
    api.members.listCaregivers,
    clerkOrgId && (member?.role === 'org:admin' || member?.role === 'org:coordinator')
      ? { clerkOrgId }
      : 'skip',
  )

  const deleteShift = useMutation(api.scheduling.deleteShift)
  const requestCoverage = useMutation(api.scheduling.requestCoverage)

  const [requestOpen, setRequestOpen] = useState(false)
  const [requestReason, setRequestReason] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const role = member?.role ?? 'org:caregiver'
  const isAdmin = role === 'org:admin'
  const isCoordinator = role === 'org:coordinator'
  const isStaff = isAdmin || isCoordinator

  const shiftAudit = useMemo(() => {
    if (!shift || !auditEvents) return []
    return auditEvents
      .filter((event) => event.shiftId === shift._id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  }, [auditEvents, shift])

  const caregiver = useMemo(
    () => caregivers?.find((cg) => cg.clerkUserId === shift?.caregiverId),
    [caregivers, shift],
  )

  const client = details?.client

  const handleDelete = async () => {
    if (!shift || !clerkOrgId) return
    if (!window.confirm('Delete this shift? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteShift({ clerkOrgId, shiftId: shift._id })
      onSuccess?.('Shift deleted')
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      window.alert(message)
      setDeleting(false)
    }
  }

  const handleRequestCoverage = async () => {
    if (!shift || !clerkOrgId || !requestReason.trim()) return
    setRequesting(true)
    try {
      await requestCoverage({
        clerkOrgId,
        shiftId: shift._id,
        reason: requestReason.trim(),
      })
      onSuccess?.('Coverage requested')
      setRequestOpen(false)
      setRequestReason('')
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      window.alert(message)
      setRequesting(false)
    }
  }

  if (!shift) return null

  const override = shift.serviceLocationOverride

  return (
    <Dialog open={Boolean(shift)} onClose={onClose} className="max-w-3xl">
      <DialogHeader>
        <button
          type="button"
          onClick={onClose}
          className="mb-2 flex items-center gap-1 text-base font-semibold text-atria-info"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Schedule
        </button>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <DialogTitle className="text-[28px] font-bold">
              {formatWeekdayDate(shift.scheduledStart)} visit —{' '}
              {shift.clientDisplayName}
            </DialogTitle>
            <p className="mt-1 text-base text-atria-text-secondary">
              {formatWeekdayDate(shift.scheduledStart)} · {formatTime(shift.scheduledStart)} –{' '}
              {formatTime(shift.scheduledEnd)} ·{' '}
              {formatDurationHours(shift.scheduledStart, shift.scheduledEnd)}
            </p>
          </div>
          <StatusBadge status={shift.status as ShiftStatus} className="self-start" />
        </div>
      </DialogHeader>
      <DialogContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-atria-text-muted">
                Client
              </p>
              <p className="text-[19px] font-bold text-atria-ink">
                {shift.clientDisplayName}
              </p>
              <div className="space-y-1 text-base text-atria-text-secondary">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {override?.label ??
                      formatAddress(client?.serviceAddress)}
                  </span>
                </p>
                {override?.addressLine && (
                  <p className="flex items-start gap-2">
                    <Home className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{override.addressLine}</span>
                  </p>
                )}
                {!override && client?.serviceAddress && (
                  <p className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Client contact on file</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-atria-text-muted">
                Caregiver
              </p>
              <p className="text-[19px] font-bold text-atria-ink">
                {shift.caregiverDisplayName}
              </p>
              <div className="space-y-1 text-base text-atria-text-secondary">
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>{caregiver?.email ?? 'No email on file'}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-atria-success" />
                  <span>Credentials on file</span>
                </p>
                <p className="flex items-center gap-2">
                  <Star className="h-4 w-4 shrink-0 text-atria-warning" />
                  <span>Active caregiver</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-[17px] font-bold text-atria-ink">
                Care plan for this visit
              </p>
              <p className="text-base text-atria-text-secondary">
                The caregiver confirms each item during the visit.
              </p>
            </div>
            <div className="space-y-3">
              {details?.tasks && details.tasks.length > 0 ? (
                details.tasks.map((task) => (
                  <label
                    key={task._id}
                    className="flex items-start gap-3 text-base text-atria-ink"
                  >
                    <Checkbox
                      checked={task.status === 'complete'}
                      readOnly
                      className="mt-0.5 h-5 w-5 shrink-0"
                    />
                    <span>{task.title}</span>
                  </label>
                ))
              ) : (
                <p className="text-base text-atria-text-secondary">
                  No care plan tasks assigned to this shift.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          {isStaff ? (
            <>
              <Button
                variant="primary"
                size="lg"
                className="min-w-[150px]"
                onClick={() => onEdit(shift)}
              >
                Edit shift
              </Button>
              {shift.status === 'scheduled' && (
                <Button
                  variant="secondary"
                  size="lg"
                  className="min-w-[150px] border-atria-danger text-atria-danger hover:bg-atria-danger/10"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  Cancel shift
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-atria-info"
                onClick={() => window.print()}
              >
                <Printer className="mr-1 h-4 w-4" />
                Print packet
              </Button>
            </>
          ) : (
            shift.status === 'scheduled' && (
              <Button
                variant="primary"
                size="lg"
                onClick={() => setRequestOpen(true)}
              >
                Request Coverage
              </Button>
            )
          )}
        </div>

        {requestOpen && (
          <div className="space-y-3 rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface-2 p-4">
            <p className="text-base font-semibold text-atria-ink">
              Request coverage
            </p>
            <Textarea
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="Why do you need coverage?"
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRequestOpen(false)
                  setRequestReason('')
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!requestReason.trim() || requesting}
                onClick={handleRequestCoverage}
              >
                {requesting ? 'Sending…' : 'Send request'}
              </Button>
            </div>
          </div>
        )}

        {shiftAudit.length > 0 && (
          <div className="space-y-3">
            <Separator />
            <p className="text-lg font-semibold text-atria-ink">Audit history</p>
            <ul className="space-y-2">
              {shiftAudit.map((event) => (
                <li
                  key={event._id}
                  className="flex items-center justify-between rounded-md bg-atria-surface-2 px-3 py-2 text-base"
                >
                  <span className="text-atria-text-secondary">
                    <span className="font-medium text-atria-ink">
                      {event.actorRole?.replace('org:', '')}
                    </span>{' '}
                    {event.action}
                  </span>
                  <span className="text-sm text-atria-text-muted">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
