import { useOrganization } from '@clerk/react'
import { useConvex, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
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
import { generateEvvExportPdf } from '../pdf/evvExportPdf'
import { saveAndDownload } from '@/features/onboarding/pdf/generatePrefilledPdf'
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
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const handleDownloadPdf = async () => {
    if (!data || !organization?.name) return
    setDownloadingPdf(true)
    try {
      const bytes = await generateEvvExportPdf({
        agencyName: organization.name,
        startDate,
        endDate,
        visits: data.visits,
      })
      saveAndDownload(bytes, `evv-export-${startDate}-to-${endDate}.pdf`)
    } finally {
      setDownloadingPdf(false)
    }
  }

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
            <Button
              variant="secondary"
              size="sm"
              disabled={downloadingPdf || !data || data.visits.length === 0}
              onClick={handleDownloadPdf}
            >
              <Download className="h-4 w-4" />
              {downloadingPdf ? 'Preparing…' : 'Download PDF'}
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

    </div>
  )
}
