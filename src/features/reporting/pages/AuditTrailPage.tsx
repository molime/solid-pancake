import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Input } from '@/shared/ui/Input'
import { USDateInput } from '@/shared/ui/USDateInput'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { ScrollText } from 'lucide-react'
import { Component, useState } from 'react'
import type { ErrorInfo, PropsWithChildren } from 'react'
import { formatDateUS, formatStatusLabel, formatTime } from '@/shared/format'

export function AuditTrailPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [action, setAction] = useState('')
  const [actorId, setActorId] = useState('')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-atria-ink">Audit Trail</h1>
        <p className="text-base text-atria-text-secondary">
          Every recorded action across your agency, newest first.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FieldGroup label="Start date" htmlFor="auditStart">
              <USDateInput
                id="auditStart"
                value={startDate}
                onChange={setStartDate}
              />
            </FieldGroup>
            <FieldGroup label="End date" htmlFor="auditEnd">
              <USDateInput
                id="auditEnd"
                value={endDate}
                onChange={setEndDate}
              />
            </FieldGroup>
            <FieldGroup
              label="Event type"
              htmlFor="auditAction"
              helperText="e.g. invoice_created"
            >
              <Input
                id="auditAction"
                value={action}
                onChange={(event) => setAction(event.target.value)}
                placeholder="Any action"
              />
            </FieldGroup>
            <FieldGroup
              label="Actor"
              htmlFor="auditActor"
              helperText="Employee name or ID"
            >
              <Input
                id="auditActor"
                value={actorId}
                onChange={(event) => setActorId(event.target.value)}
                placeholder="Any actor"
              />
            </FieldGroup>
          </div>
        </CardContent>
      </Card>

      <AuditEventsErrorBoundary>
        <AuditEventsCard
          clerkOrgId={clerkOrgId}
          action={action}
          startDate={startDate}
          endDate={endDate}
          actorId={actorId}
        />
      </AuditEventsErrorBoundary>
    </div>
  )
}

// A failing audit.list query (e.g. a tenant/role mismatch) throws inside
// useQuery. Without a boundary here the error bubbles to AppErrorBoundary
// and blanks the whole app; caught here it degrades to an error state.
interface AuditEventsErrorBoundaryState {
  hasError: boolean
}

class AuditEventsErrorBoundary extends Component<
  PropsWithChildren,
  AuditEventsErrorBoundaryState
> {
  state: AuditEventsErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ATRIA-X audit trail error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<ScrollText className="h-6 w-6" />}
              title="Audit events unavailable"
              description="The audit trail could not be loaded. Refresh the page or adjust your filters and try again."
            />
          </CardContent>
        </Card>
      )
    }
    return this.props.children
  }
}

interface AuditEventsCardProps {
  clerkOrgId: string | undefined
  action: string
  startDate: string
  endDate: string
  actorId: string
}

function AuditEventsCard({
  clerkOrgId,
  action,
  startDate,
  endDate,
  actorId,
}: AuditEventsCardProps) {
  const events = useQuery(
    api.audit.list,
    clerkOrgId
      ? {
          clerkOrgId,
          action: action.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          actorId: actorId.trim() || undefined,
        }
      : 'skip',
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Events</CardTitle>
      </CardHeader>
      <CardContent>
        {events === undefined ? (
          <p className="py-8 text-center text-sm text-atria-text-secondary">
            Loading audit events…
          </p>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-6 w-6" />}
            title="No audit events"
            description="Events matching these filters will appear here."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>When</TableHeader>
                <TableHeader>Action</TableHeader>
                <TableHeader>Actor</TableHeader>
                <TableHeader>Role</TableHeader>
                <TableHeader>Change</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event._id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateUS(event.createdAt)}{' '}
                    {formatTime(event.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatStatusLabel(event.action)}
                  </TableCell>
                  <TableCell>{event.actorName ?? event.actorId}</TableCell>
                  <TableCell>
                    {formatStatusLabel(
                      event.actorRole.replace(/^org:/, ''),
                    )}
                  </TableCell>
                  <TableCell>
                    {event.previousStatus || event.nextStatus
                      ? `${event.previousStatus ?? '-'} → ${
                          event.nextStatus ?? '-'
                        }`
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
