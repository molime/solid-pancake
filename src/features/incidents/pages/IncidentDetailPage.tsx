import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Textarea'
import { ChevronLeft, Printer } from 'lucide-react'
import {
  formatAgencyNotifiedLabel,
  formatDateUS,
  formatIncidentCategoryLabel,
  formatIncidentStatusLabel,
  formatTime,
} from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { incidentSlaBadges } from '../lib/incidentSlaBadges'

function ReportField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-atria-muted">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-atria-ink">
        {value?.trim() ? value : '—'}
      </p>
    </div>
  )
}

export function IncidentDetailPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const { incidentId } = useParams<{ incidentId: string }>()

  const incident = useQuery(
    api.incidents.getIncident,
    clerkOrgId && incidentId
      ? { clerkOrgId, incidentId: incidentId as Id<'specialIncidents'> }
      : 'skip',
  )
  const markVerbalReported = useMutation(api.incidents.markVerbalReported)
  const markWrittenSubmitted = useMutation(api.incidents.markWrittenSubmitted)
  const closeIncident = useMutation(api.incidents.closeIncident)
  const addIncidentUpdate = useMutation(api.incidents.addIncidentUpdate)

  const [note, setNote] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (incident === undefined) {
    return (
      <p className="py-8 text-center text-sm text-atria-text-secondary">
        Loading incident…
      </p>
    )
  }

  const isClosed = incident.status === 'closed'
  const slaBadges = incidentSlaBadges(incident)

  const runTransition = async (
    transition: (args: {
      clerkOrgId: string
      incidentId: Id<'specialIncidents'>
    }) => Promise<unknown>,
  ) => {
    if (!clerkOrgId || !incidentId) return
    setError(null)
    setIsBusy(true)
    try {
      await transition({
        clerkOrgId,
        incidentId: incidentId as Id<'specialIncidents'>,
      })
    } catch (err) {
      setError(
        err instanceof Error ? sanitizeConvexError(err.message) : 'Failed.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleAddUpdate = async () => {
    if (!clerkOrgId || !incidentId || !note.trim()) return
    setError(null)
    setIsBusy(true)
    try {
      await addIncidentUpdate({
        clerkOrgId,
        incidentId: incidentId as Id<'specialIncidents'>,
        note: note.trim(),
      })
      setNote('')
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Could not add the update.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/incidents"
            className="mb-1 inline-flex items-center gap-1 text-sm text-atria-text-secondary hover:text-atria-ink"
          >
            <ChevronLeft className="h-4 w-4" />
            Incident log
          </Link>
          <h1 className="text-2xl font-bold text-atria-ink">
            {formatIncidentCategoryLabel(incident.category)} —{' '}
            {incident.clientName}
          </h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge
              variant={incident.status === 'closed' ? 'success' : 'info'}
            >
              {formatIncidentStatusLabel(incident.status)}
            </StatusBadge>
            {slaBadges.map((badge) => (
              <StatusBadge key={badge.key} variant={badge.variant}>
                {badge.label}
              </StatusBadge>
            ))}
          </div>
        </div>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-atria-danger/20 bg-atria-danger-bg px-4 py-3 text-sm text-atria-danger">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reporting deadlines (17 CCR §54327)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReportField
              label="Verbal report due (24h)"
              value={`${formatDateUS(incident.verbalDueAt)} ${formatTime(incident.verbalDueAt)}`}
            />
            <ReportField
              label="Verbal reported"
              value={
                incident.verbalReportedAt
                  ? `${formatDateUS(incident.verbalReportedAt)} ${formatTime(incident.verbalReportedAt)}`
                  : undefined
              }
            />
            <ReportField
              label="Written report due (48h)"
              value={`${formatDateUS(incident.writtenDueAt)} ${formatTime(incident.writtenDueAt)}`}
            />
            <ReportField
              label="Written submitted"
              value={
                incident.writtenSubmittedAt
                  ? `${formatDateUS(incident.writtenSubmittedAt)} ${formatTime(incident.writtenSubmittedAt)}`
                  : undefined
              }
            />
          </div>
          {!isClosed && (
            <div className="flex flex-wrap gap-2">
              {!incident.verbalReportedAt && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => runTransition(markVerbalReported)}
                >
                  Mark verbal reported
                </Button>
              )}
              {!incident.writtenSubmittedAt && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => runTransition(markWrittenSubmitted)}
                >
                  Mark written submitted
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                disabled={isBusy}
                onClick={() => runTransition(closeIncident)}
              >
                Close incident
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Initial report (immutable)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReportField
              label="Occurred"
              value={`${formatDateUS(incident.occurredAt)} ${formatTime(incident.occurredAt)}`}
            />
            <ReportField
              label="Learned"
              value={`${formatDateUS(incident.learnedAt)} ${formatTime(incident.learnedAt)}`}
            />
            <ReportField label="Location" value={incident.location} />
            <ReportField label="Witnesses" value={incident.witnesses} />
            <ReportField
              label="Alleged perpetrator"
              value={incident.allegedPerpetrator}
            />
            <ReportField
              label="Agencies notified"
              value={
                incident.agenciesNotified.length > 0
                  ? incident.agenciesNotified
                      .map(formatAgencyNotifiedLabel)
                      .join(', ')
                  : undefined
              }
            />
            <ReportField
              label="Family / representative contacted"
              value={
                incident.familyContacted
                  ? `${incident.familyContacted.who} (${formatDateUS(incident.familyContacted.at)})`
                  : undefined
              }
            />
          </div>
          <ReportField label="Description" value={incident.description} />
          <ReportField
            label="Treatment provided"
            value={incident.treatmentProvided}
          />
          <ReportField label="Actions taken" value={incident.actionsTaken} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up updates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {incident.updates.length === 0 ? (
            <p className="text-sm text-atria-text-secondary">
              No follow-up updates yet. Updates are appended and cannot be
              edited or removed.
            </p>
          ) : (
            <ul className="space-y-3">
              {incident.updates.map((update) => (
                <li
                  key={update._id}
                  className="rounded-md border border-atria-border bg-atria-surface-2 px-4 py-3"
                >
                  <p className="whitespace-pre-wrap text-sm text-atria-ink">
                    {update.note}
                  </p>
                  <p className="mt-1 text-xs text-atria-text-muted">
                    {update.addedByName} · {formatDateUS(update.createdAt)}{' '}
                    {formatTime(update.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {!isClosed && (
            <div className="space-y-2">
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add follow-up information for the regional center…"
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!note.trim() || isBusy}
                  onClick={handleAddUpdate}
                >
                  Add update
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
