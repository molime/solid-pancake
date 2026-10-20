import { useTenant } from '@/app/useTenant'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { USDateInput } from '@/shared/ui/USDateInput'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { formatDateUS, formatStatusLabel, formatTime } from '@/shared/format'
import { RefreshCw, ScrollText, Trash2 } from 'lucide-react'
import { useState } from 'react'

interface PurgeResult {
  documentsPurged: number
  filesDeleted: number
  applicationsRedacted: number
  draftsRedacted: number
  legalHoldSkipped: number
}

export function DataLifecyclePage() {
  const { clerkOrgId } = useTenant()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  // Bumping this key remounts the preview/log sections, forcing a refetch.
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-atria-ink">Data Lifecycle</h1>
        <p className="text-base text-atria-text-secondary">
          Automated retention, deletion, and the visible log of every deletion.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How automated deletion works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-atria-text-secondary">
          <p>
            A daily automated sweep (06:45 UTC) deletes data for employees who
            are no longer part of your organization once their offboarding is
            older than the retention window (5 years by default, per 17 CCR
            §54326). For each offboarded employee it deletes their uploaded
            files and archived credential documents from storage and redacts
            the SSN fields in their applications and drafts — names and dates
            are kept as the legal record.
          </p>
          <p>
            It also deletes archived documents whose retention deadline
            (retention until date) has passed. Records under a legal hold are
            never deleted: they are skipped and the skip is recorded in the
            deletion log below. Every deletion and every skip is logged with
            when it happened, on what legal basis, and whether it was the
            automated sweep or an admin acting manually.
          </p>
        </CardContent>
      </Card>

      {clerkOrgId ? (
        <div className="space-y-8" key={refreshKey}>
          <RetentionSummary
            clerkOrgId={clerkOrgId}
            onRefresh={() => setRefreshKey((key) => key + 1)}
          />
          <DeletionLogSection
            clerkOrgId={clerkOrgId}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        </div>
      ) : null}
    </div>
  )
}

function RetentionSummary({
  clerkOrgId,
  onRefresh,
}: {
  clerkOrgId: string
  onRefresh: () => void
}) {
  const preview = useQuery(api.dataRetention.getPurgePreview, { clerkOrgId })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Retention summary</CardTitle>
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {preview === undefined ? (
          <p className="py-4 text-center text-sm text-atria-text-secondary">
            Loading preview…
          </p>
        ) : (
          <>
            <p className="text-sm text-atria-text-secondary">
              Retention window: {preview.retentionYears} years. Due now:{' '}
              <strong>{preview.counts.offboardedEmployees}</strong> offboarded
              employee(s), <strong>{preview.counts.expiredDocuments}</strong>{' '}
              expired document(s). Past retention but protected by legal hold:{' '}
              {preview.counts.heldPastRetention}.
            </p>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-atria-ink">
                Offboarded employees due for purge
              </h3>
              {preview.offboardedEmployees.length === 0 ? (
                <EmptyState
                  icon={<Trash2 className="h-6 w-6" />}
                  title="No employees due for purge"
                  description="Offboarded employees appear here once their retention window has passed."
                />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Name</TableHeader>
                      <TableHeader>Email</TableHeader>
                      <TableHeader>Offboarded</TableHeader>
                      <TableHeader />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.offboardedEmployees.map((employee) => (
                      <DueEmployeeRow
                        key={employee._id}
                        clerkOrgId={clerkOrgId}
                        employee={employee}
                        retentionYears={preview.retentionYears}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {preview.expiredDocuments.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-atria-ink">
                  Expired documents (deleted by the next automated sweep)
                </h3>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Category</TableHeader>
                      <TableHeader>File</TableHeader>
                      <TableHeader>Retention until</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.expiredDocuments.map((document) => (
                      <TableRow key={document._id}>
                        <TableCell>{document.category}</TableCell>
                        <TableCell>{document.fileName ?? '—'}</TableCell>
                        <TableCell>
                          {formatDateUS(document.retentionUntil)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function DueEmployeeRow({
  clerkOrgId,
  employee,
  retentionYears,
}: {
  clerkOrgId: string
  employee: {
    _id: Id<'employeeProfiles'>
    displayName: string
    email: string
    offboardedAt: string
  }
  retentionYears: number
}) {
  const requestPurge = useMutation(api.dataRetention.requestOffboardedPurge)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<PurgeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runPurge = async () => {
    setPending(true)
    setError(null)
    try {
      const purgeResult = await requestPurge({
        clerkOrgId,
        employeeProfileId: employee._id,
      })
      setResult(purgeResult)
      setConfirmOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purge failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{employee.displayName}</TableCell>
        <TableCell>{employee.email}</TableCell>
        <TableCell className="whitespace-nowrap">
          {formatDateUS(employee.offboardedAt)}
        </TableCell>
        <TableCell className="text-right">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setConfirmOpen(true)}
          >
            Purge now
          </Button>
        </TableCell>
      </TableRow>
      {error || result ? (
        <TableRow>
          <TableCell colSpan={4} className={error ? 'text-sm text-red-600' : 'text-sm text-atria-text-secondary'}>
            {error ??
              `Purged ${result?.documentsPurged ?? 0} document(s) and ${result?.filesDeleted ?? 0} file(s); redacted SSN in ${result?.applicationsRedacted ?? 0} application(s) and ${result?.draftsRedacted ?? 0} draft(s)${result?.legalHoldSkipped ? `; ${result.legalHoldSkipped} item(s) skipped under legal hold` : ''}. Written to the deletion log below.`}
          </TableCell>
        </TableRow>
      ) : null}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogHeader>
          <DialogTitle>Purge data for {employee.displayName}?</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-2 text-sm text-atria-text-secondary">
          <p>This permanently deletes, for this offboarded employee:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Archived credential documents and their stored files</li>
            <li>Any other files they uploaded</li>
          </ul>
          <p>
            It redacts (sets to blank) the SSN fields in their applications and
            saved drafts. Names and dates are kept as the legal record.
            Documents under legal hold are not deleted and the skip is
            recorded in the deletion log.
          </p>
          <p>
            Legal basis: 17 CCR §54326 — five-year retention (offboarded{' '}
            {formatDateUS(employee.offboardedAt)}, {retentionYears}-year
            window). This action is recorded in the audit trail as
            data_lifecycle.purge_executed.
          </p>
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={runPurge} disabled={pending}>
            {pending ? 'Purging…' : 'Confirm purge'}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

function DeletionLogSection({
  clerkOrgId,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: {
  clerkOrgId: string
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
}) {
  const events = useQuery(api.dataRetention.listDeletionEvents, {
    clerkOrgId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Deletion log</CardTitle>
          <div className="flex gap-4">
            <FieldGroup label="From" htmlFor="deletionStart">
              <USDateInput
                id="deletionStart"
                value={startDate}
                onChange={onStartDateChange}
              />
            </FieldGroup>
            <FieldGroup label="To" htmlFor="deletionEnd">
              <USDateInput
                id="deletionEnd"
                value={endDate}
                onChange={onEndDateChange}
              />
            </FieldGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {events === undefined ? (
          <p className="py-8 text-center text-sm text-atria-text-secondary">
            Loading deletion log…
          </p>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-6 w-6" />}
            title="No deletions recorded"
            description="Automated sweep deletions and manual purges will appear here."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>When</TableHeader>
                <TableHeader>Actor</TableHeader>
                <TableHeader>Subject</TableHeader>
                <TableHeader>Legal basis</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Detail</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <TableRow
                  key={event._id}
                  className={
                    event.status === 'skipped_legal_hold'
                      ? 'bg-amber-50 hover:bg-amber-100/60'
                      : undefined
                  }
                >
                  <TableCell className="whitespace-nowrap">
                    {formatDateUS(event.createdAt)} {formatTime(event.createdAt)}
                  </TableCell>
                  <TableCell>
                    {event.actorId === 'system'
                      ? 'System (automated sweep)'
                      : event.actorId}
                  </TableCell>
                  <TableCell>
                    {formatStatusLabel(event.subjectType)}
                    <span className="block text-xs text-atria-text-secondary">
                      {event.subjectId}
                    </span>
                  </TableCell>
                  <TableCell>{event.legalBasis}</TableCell>
                  <TableCell>{formatStatusLabel(event.status)}</TableCell>
                  <TableCell className="max-w-md text-atria-text-secondary">
                    {event.detail ?? '—'}
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
