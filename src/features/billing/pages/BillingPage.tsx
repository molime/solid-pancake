import { useOrganization } from '@clerk/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { Input } from '@/shared/ui/Input'
import { Separator } from '@/shared/ui/Separator'
import { Download, FileText } from 'lucide-react'
import { ExportBatchesTable } from '../components/ExportBatchesTable'

export function BillingPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const unexported = useQuery(
    api.billing.unexported,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const ledger = useQuery(
    api.billing.ledger,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const batches = useQuery(
    api.billing.exportBatches,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const createBatch = useMutation(api.billing.createExportBatch)

  const [batchName, setBatchName] = useState('')
  const [selectedLineIds, setSelectedLineIds] = useState<Id<'billingLines'>[]>(
    [],
  )
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  if (!unexported || !ledger) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-muted">Loading billing data…</div>
      </div>
    )
  }

  const totalUnexported = unexported.reduce((sum, line) => sum + line.amount, 0)

  const toggleLine = (id: Id<'billingLines'>) => {
    setSelectedLineIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleExport = async () => {
    if (!clerkOrgId || selectedLineIds.length === 0) return
    setIsExporting(true)
    setExportError(null)
    setExportMessage(null)
    try {
      const exportedCount = selectedLineIds.length
      await createBatch({
        clerkOrgId,
        name: batchName || `Export ${new Date().toISOString().slice(0, 10)}`,
        lineIds: selectedLineIds,
      })
      setSelectedLineIds([])
      setBatchName('')
      setExportMessage(
        `Exported ${exportedCount} line${exportedCount !== 1 ? 's' : ''}.`,
      )
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-atria-ink">Billing Ledger</h1>
          <p className="text-sm text-atria-muted">
            ${totalUnexported.toFixed(2)} unexported across {unexported.length} line
            {unexported.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Unexported Lines</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Batch name"
                className="w-48"
              />
              <Button
                variant="primary"
                disabled={selectedLineIds.length === 0 || isExporting}
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
                {isExporting
                  ? 'Exporting...'
                  : `Export ${selectedLineIds.length > 0 ? `(${selectedLineIds.length})` : ''}`}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {exportError && (
            <div className="mb-3 rounded-md bg-atria-danger-bg px-3 py-2 text-sm text-atria-danger">
              {exportError}
            </div>
          )}
          {exportMessage && (
            <div className="mb-3 rounded-md bg-atria-success-bg px-3 py-2 text-sm text-atria-success">
              {exportMessage}
            </div>
          )}
          {unexported.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-atria-border/50 mb-3">
                <FileText className="h-6 w-6 text-atria-muted" />
              </div>
              <p className="text-sm font-medium text-atria-ink">No unexported lines</p>
              <p className="text-xs text-atria-muted mt-1 max-w-xs">
                Approved shifts will appear here as billing-ready lines.
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedLineIds.length === unexported.length &&
                        unexported.length > 0
                      }
                      onChange={(e) =>
                        setSelectedLineIds(
                          e.target.checked
                            ? unexported.map((l) => l._id)
                            : [],
                        )
                      }
                      className="h-4 w-4 rounded border-atria-border text-atria-accent"
                    />
                  </TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Service</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Hours</TableHeader>
                  <TableHeader>Rate</TableHeader>
                  <TableHeader className="text-right">Amount</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {unexported.map((line) => (
                  <TableRow key={line._id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedLineIds.includes(line._id)}
                        onChange={() => toggleLine(line._id)}
                        className="h-4 w-4 rounded border-atria-border text-atria-accent"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {line.clientName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{line.serviceType}</Badge>
                    </TableCell>
                    <TableCell>
                      {line.scheduledStart
                        ? new Date(line.scheduledStart).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell>{line.hours}</TableCell>
                    <TableCell>${line.rate.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${line.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Full Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-atria-border/50 mb-3">
                <FileText className="h-6 w-6 text-atria-muted" />
              </div>
              <p className="text-sm font-medium text-atria-ink">No billing history</p>
              <p className="text-xs text-atria-muted mt-1 max-w-xs">
                Approved and exported shifts will appear in the ledger.
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Client</TableHeader>
                  <TableHeader>Service</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Hours</TableHeader>
                  <TableHeader>Rate</TableHeader>
                  <TableHeader className="text-right">Amount</TableHeader>
                  <TableHeader>Status</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {ledger.map((line) => (
                  <TableRow key={line._id}>
                    <TableCell className="font-medium">
                      {line.clientName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{line.serviceType}</Badge>
                    </TableCell>
                    <TableCell>
                      {line.scheduledStart
                        ? new Date(line.scheduledStart).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell>{line.hours}</TableCell>
                    <TableCell>${line.rate.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${line.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {line.exportBatchId ? (
                        <Badge variant="success">Exported</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {batches && <ExportBatchesTable batches={batches} />}
    </div>
  )
}
