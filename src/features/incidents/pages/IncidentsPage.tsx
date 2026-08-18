import { useOrganization } from '@clerk/react'
import { useConvex, useQuery } from 'convex/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/ui/StatusBadge'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { USDateInput } from '@/shared/ui/USDateInput'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { AlertTriangle, Download, Plus } from 'lucide-react'
import {
  formatDateUS,
  formatIncidentCategoryLabel,
  formatIncidentStatusLabel,
} from '@/shared/format'
import { downloadCsv } from '@/shared/lib/downloadCsv'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { incidentSlaBadges } from '../lib/incidentSlaBadges'

const INCIDENT_STATUSES = [
  'draft',
  'verbal_reported',
  'written_submitted',
  'closed',
] as const

type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

const statusVariant: Record<IncidentStatus, StatusBadgeVariant> = {
  draft: 'warning',
  verbal_reported: 'info',
  written_submitted: 'info',
  closed: 'success',
}

export function IncidentsPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const convex = useConvex()
  const navigate = useNavigate()

  const [statusFilter, setStatusFilter] = useState<'' | IncidentStatus>('')
  const [clientFilter, setClientFilter] = useState('')
  const [exportStart, setExportStart] = useState('')
  const [exportEnd, setExportEnd] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const incidents = useQuery(
    api.incidents.listIncidents,
    clerkOrgId
      ? {
          clerkOrgId,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(clientFilter
            ? { clientId: clientFilter as Id<'clients'> }
            : {}),
        }
      : 'skip',
  )
  const clientOptions = useQuery(
    api.incidents.listIncidentClientOptions,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const handleExport = async () => {
    if (!clerkOrgId) return
    setError(null)
    setIsExporting(true)
    try {
      const csv = await convex.query(api.incidents.exportIncidentsCsv, {
        clerkOrgId,
        ...(exportStart
          ? { startDate: `${exportStart}T00:00:00.000Z` }
          : {}),
        ...(exportEnd ? { endDate: `${exportEnd}T23:59:59.999Z` } : {}),
      })
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(`sir-log-${date}.csv`, csv)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Export failed.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">
            Special Incident Reports
          </h1>
          <p className="text-base text-atria-text-secondary">
            17 CCR §54327 incident log — verbal report within 24 hours, written
            within 48.
          </p>
        </div>
        <Link to="/incidents/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New incident
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-atria-danger/20 bg-atria-danger-bg px-4 py-3 text-sm text-atria-danger">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Incident log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="w-full lg:w-48">
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Status
              </label>
              <Select
                className="mt-1.5"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as '' | IncidentStatus)
                }
              >
                <option value="">All statuses</option>
                {INCIDENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatIncidentStatusLabel(status)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full lg:w-56">
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Client
              </label>
              <Select
                className="mt-1.5"
                value={clientFilter}
                onChange={(event) => setClientFilter(event.target.value)}
              >
                <option value="">All clients</option>
                {(clientOptions ?? []).map((client) => (
                  <option key={client.clientId} value={client.clientId}>
                    {client.displayName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-3 sm:flex-row lg:items-end lg:justify-end">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                  Export from
                </label>
                <USDateInput
                  className="mt-1.5"
                  value={exportStart}
                  onChange={setExportStart}
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                  Export to
                </label>
                <USDateInput
                  className="mt-1.5"
                  value={exportEnd}
                  onChange={setExportEnd}
                />
              </div>
              <Button
                variant="secondary"
                disabled={!clerkOrgId || isExporting}
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
                {isExporting ? 'Exporting…' : 'Download SIR log (CSV)'}
              </Button>
            </div>
          </div>

          {incidents === undefined ? (
            <p className="py-8 text-center text-sm text-atria-text-secondary">
              Loading incidents…
            </p>
          ) : incidents.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-6 w-6" />}
              title="No incidents"
              description="Special incident reports will appear here once they are filed."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Category</TableHeader>
                  <TableHeader>Occurred</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Reporting deadlines</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow
                    key={incident._id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/incidents/${incident._id}`)}
                  >
                    <TableCell className="font-medium">
                      {incident.clientName}
                    </TableCell>
                    <TableCell>
                      {formatIncidentCategoryLabel(incident.category)}
                    </TableCell>
                    <TableCell>{formatDateUS(incident.occurredAt)}</TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={
                          statusVariant[incident.status as IncidentStatus] ??
                          'neutral'
                        }
                      >
                        {formatIncidentStatusLabel(incident.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1.5">
                        {incidentSlaBadges(incident).map((badge) => (
                          <StatusBadge key={badge.key} variant={badge.variant}>
                            {badge.label}
                          </StatusBadge>
                        ))}
                        {incidentSlaBadges(incident).length === 0 && '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
