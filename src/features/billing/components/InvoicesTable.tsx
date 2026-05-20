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
import type { Id } from '../../../../convex/_generated/dataModel'
import type { InvoiceRow } from '../model/invoiceUtils'

interface InvoicesTableProps {
  invoices: InvoiceRow[]
  downloadingId?: Id<'exportBatches'> | null
  onDownload: (invoiceId: Id<'exportBatches'>) => void
}

export function InvoicesTable({
  invoices,
  downloadingId,
  onDownload,
}: InvoicesTableProps) {
  if (invoices.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Invoice</TableHeader>
              <TableHeader>Caregiver</TableHeader>
              <TableHeader>Period</TableHeader>
              <TableHeader>Lines</TableHeader>
              <TableHeader className="text-right">Amount</TableHeader>
              <TableHeader>Issued</TableHeader>
              <TableHeader className="text-right">Download</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice._id}>
                <TableCell>
                  <div className="font-medium text-atria-ink">
                    {invoice.invoiceNumber}
                  </div>
                  <div className="text-xs text-atria-muted">{invoice.name}</div>
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
                  {new Date(invoice.exportedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    onClick={() => onDownload(invoice._id)}
                    disabled={downloadingId === invoice._id}
                  >
                    <Download className="h-4 w-4" />
                    CSV
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
