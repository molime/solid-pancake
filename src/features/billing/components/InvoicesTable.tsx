import { useState } from 'react'
import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { Download } from 'lucide-react'
import { formatDateUS, formatStatusLabel } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { InvoiceRow } from '../model/invoiceUtils'

const statusVariant: Record<
  string,
  'neutral' | 'info' | 'success' | 'danger'
> = {
  draft: 'neutral',
  sent: 'info',
  paid: 'success',
  void: 'danger',
}

interface InvoicesTableProps {
  invoices: InvoiceRow[]
  downloadingId?: Id<'exportBatches'> | null
  onDownload: (invoiceId: Id<'exportBatches'>) => void
  onDownloadPdf: (invoiceId: Id<'exportBatches'>) => void
}

export function InvoicesTable({
  invoices,
  downloadingId,
  onDownload,
  onDownloadPdf,
}: InvoicesTableProps) {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const member = useQuery(
    api.members.me,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const markInvoiceSent = useMutation(api.billing.markInvoiceSent)
  const markInvoicePaid = useMutation(api.billing.markInvoicePaid)
  const voidInvoice = useMutation(api.billing.voidInvoice)

  const canManage =
    member?.role === 'org:admin' || member?.role === 'org:coordinator'

  const [pendingId, setPendingId] = useState<Id<'exportBatches'> | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const runTransition = async (
    invoiceId: Id<'exportBatches'>,
    transition: (args: {
      clerkOrgId: string
      invoiceId: Id<'exportBatches'>
    }) => Promise<unknown>,
  ) => {
    if (!clerkOrgId) return
    setPendingId(invoiceId)
    setActionError(null)
    try {
      await transition({ clerkOrgId, invoiceId })
    } catch (err) {
      setActionError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Invoice update failed.',
      )
    } finally {
      setPendingId(null)
    }
  }

  if (invoices.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        {actionError && (
          <p className="mb-3 text-sm text-atria-danger">{actionError}</p>
        )}
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Invoice</TableHeader>
              <TableHeader>Caregiver</TableHeader>
              <TableHeader>Period</TableHeader>
              <TableHeader>Lines</TableHeader>
              <TableHeader className="text-right">Amount</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Issued</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((invoice) => {
              const status = invoice.status ?? 'draft'
              const isPending = pendingId === invoice._id
              return (
                <TableRow key={invoice._id}>
                  <TableCell>
                    <div className="font-medium text-atria-ink">
                      {invoice.invoiceNumber}
                    </div>
                    <div className="text-xs text-atria-muted">
                      {invoice.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {invoice.caregiverEmail ||
                      invoice.caregiverName ||
                      'Multiple caregivers'}
                  </TableCell>
                  <TableCell>
                    {invoice.periodStart || invoice.periodEnd
                      ? `${invoice.periodStart || 'Start'} - ${
                          invoice.periodEnd || 'Today'
                        }`
                      : 'Selected shifts'}
                  </TableCell>
                  <TableCell>{invoice.lineCount}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${invoice.totalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[status] ?? 'neutral'}>
                      {formatStatusLabel(status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateUS(invoice.exportedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canManage && status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() =>
                            runTransition(invoice._id, markInvoiceSent)
                          }
                        >
                          Mark Sent
                        </Button>
                      )}
                      {canManage && status === 'sent' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() =>
                            runTransition(invoice._id, markInvoicePaid)
                          }
                        >
                          Mark Paid
                        </Button>
                      )}
                      {canManage && (status === 'draft' || status === 'sent') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() =>
                            runTransition(invoice._id, voidInvoice)
                          }
                        >
                          Void
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownload(invoice._id)}
                        disabled={downloadingId === invoice._id}
                      >
                        <Download className="h-4 w-4" />
                        CSV
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownloadPdf(invoice._id)}
                      >
                        <Download className="h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
