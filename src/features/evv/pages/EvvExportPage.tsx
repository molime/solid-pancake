import { useOrganization } from '@clerk/react'
import { useConvex, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { USDateInput } from '@/shared/ui/USDateInput'
import { EmptyState } from '@/shared/ui/EmptyState'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { formatDateUS, formatTime } from '@/shared/format'
import { downloadCsv } from '@/shared/lib/downloadCsv'
import { uploadFileToConvex } from '@/shared/lib/upload'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { Download, FileCheck2 } from 'lucide-react'

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_WINDOW_DAYS = 30

export function EvvExportPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const convex = useConvex()

  const [startDate, setStartDate] = useState(
    () =>
      new Date(Date.now() - DEFAULT_WINDOW_DAYS * DAY_MS)
        .toISOString()
        .slice(0, 10),
  )
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [downloading, setDownloading] = useState(false)

  const data = useQuery(
    api.evv.getEvvVisits,
    clerkOrgId && startDate && endDate
      ? { clerkOrgId, startDate, endDate }
      : 'skip',
  )

  const handleDownload = async () => {
    if (!clerkOrgId || !startDate || !endDate) return
    setDownloading(true)
    try {
      const csv = await convex.query(api.evv.exportEvvCsv, {
        clerkOrgId,
        startDate,
        endDate,
      })
      downloadCsv(`evv-export-${startDate}-to-${endDate}.csv`, csv)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-atria-ink">EVV Export</h1>
        <p className="text-base text-atria-text-secondary">
          Electronic Visit Verification for SLS (service code 896) — the six
          federal data elements per visit (21st Century Cures Act §12006)
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>EVV visit export</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <USDateInput
              id="evvStart"
              aria-label="Start date"
              value={startDate}
              onChange={setStartDate}
            />
            <USDateInput
              id="evvEnd"
              aria-label="End date"
              value={endDate}
              onChange={setEndDate}
            />
            <Button
              variant="primary"
              size="sm"
              disabled={downloading || !startDate || !endDate}
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              {downloading ? 'Preparing…' : 'Download CSV'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-atria-text-secondary">
            Alternate-EVV submission aid for an approved alternate EVV system —
            this is not a live Sandata/CalEVV integration. Each row carries the
            six required elements: service type, recipient, date, location,
            provider, and begin/end times.
          </p>
          {data && (
            <p className="text-sm text-atria-text-secondary">
              <Badge
                variant={
                  data.excludedLiveInCount > 0 ? 'warning' : 'default'
                }
              >
                {data.excludedLiveInCount} live-in exempt visit
                {data.excludedLiveInCount === 1 ? '' : 's'} excluded
              </Badge>
            </p>
          )}
          {!data ? (
            <p className="text-sm text-atria-muted">Loading visits…</p>
          ) : data.visits.length === 0 ? (
            <EmptyState
              icon={<FileCheck2 className="h-6 w-6" />}
              title="No visits in range"
              description="Submitted, approved, or billing-ready shifts in the selected range will appear here."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Service</TableHeader>
                  <TableHeader>Recipient</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Begin</TableHeader>
                  <TableHeader>End</TableHeader>
                  <TableHeader>Location</TableHeader>
                  <TableHeader>Provider</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.visits.map((visit) => (
                  <TableRow key={visit.shiftId}>
                    <TableCell>
                      <Badge variant="default">{visit.serviceType}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {visit.recipientName}
                    </TableCell>
                    <TableCell>{formatDateUS(visit.date)}</TableCell>
                    <TableCell>{formatTime(visit.beginAt)}</TableCell>
                    <TableCell>{formatTime(visit.endAt)}</TableCell>
                    <TableCell>{visit.location || '—'}</TableCell>
                    <TableCell>{visit.providerName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {clerkOrgId && <LiveInAttestationsCard clerkOrgId={clerkOrgId} />}
    </div>
  )
}

function LiveInAttestationsCard({ clerkOrgId }: { clerkOrgId: string }) {
  const attestations = useQuery(api.evv.listLiveInAttestations, { clerkOrgId })
  const employeeOptions = useQuery(api.evv.listEvvEmployeeOptions, {
    clerkOrgId,
  })
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const recordAttestation = useMutation(api.evv.recordLiveInAttestation)

  const [employeeProfileId, setEmployeeProfileId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!file || !employeeProfileId) return
    setSubmitting(true)
    setError(null)
    try {
      const storageId = await uploadFileToConvex({
        generateUploadUrl,
        clerkOrgId,
        file,
      })
      await recordAttestation({
        clerkOrgId,
        employeeProfileId: employeeProfileId as Id<'employeeProfiles'>,
        storageId,
        fileName: file.name,
        contentType: file.type || undefined,
        size: file.size,
        expiresAt: expiresAt
          ? new Date(`${expiresAt}T00:00:00.000Z`).toISOString()
          : undefined,
      })
      setEmployeeProfileId('')
      setExpiresAt('')
      setFile(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to record the attestation.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live-in caregiver attestations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-atria-text-secondary">
          Live-in caregivers are exempt from EVV. Record the signed exemption
          attestation here — visits by attested caregivers are excluded from
          the export above and counted. Attestations with an expiry date are
          flagged for renewal like any other credential.
        </p>

        {!attestations ? (
          <p className="text-sm text-atria-muted">Loading attestations…</p>
        ) : attestations.length === 0 ? (
          <EmptyState
            icon={<FileCheck2 className="h-6 w-6" />}
            title="No attestations on file"
            description="Record a live-in caregiver exemption attestation to exclude that caregiver's visits from the EVV export."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Employee</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Expires</TableHeader>
                <TableHeader>Uploaded</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {attestations.map((attestation) => (
                <TableRow key={attestation._id}>
                  <TableCell className="font-medium">
                    {attestation.employeeName}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={
                        attestation.status === 'active' ||
                        attestation.status === 'verified'
                          ? 'success'
                          : attestation.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {attestation.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {attestation.expiresAt ? (
                      <span className="inline-flex items-center gap-2">
                        {formatDateUS(attestation.expiresAt)}
                        {attestation.expired && (
                          <Badge variant="warning">Expired</Badge>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{formatDateUS(attestation.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="space-y-3 rounded-[var(--radius-atria-md)] border border-atria-border p-4">
          <p className="text-sm font-medium text-atria-ink">
            Record an attestation
          </p>
          {error && <p className="text-sm text-atria-danger">{error}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Employee
              </label>
              <Select
                aria-label="Employee"
                value={employeeProfileId}
                onChange={(e) => setEmployeeProfileId(e.target.value)}
                className="mt-1"
              >
                <option value="">Select employee…</option>
                {(employeeOptions ?? []).map((option) => (
                  <option
                    key={option.employeeProfileId}
                    value={option.employeeProfileId}
                  >
                    {option.displayName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Attestation document
              </label>
              <input
                type="file"
                aria-label="Attestation document"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-atria-text-secondary file:mr-3 file:rounded-md file:border file:border-atria-border file:bg-atria-surface file:px-3 file:py-1.5 file:text-sm file:text-atria-ink"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Expires (optional)
              </label>
              <USDateInput
                value={expiresAt}
                onChange={setExpiresAt}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Button
              variant="primary"
              size="sm"
              disabled={submitting || !file || !employeeProfileId}
              onClick={handleSubmit}
            >
              {submitting ? 'Uploading…' : 'Record attestation'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
