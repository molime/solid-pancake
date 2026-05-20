import { Badge } from '@/shared/ui/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { BillingLineRow } from '../model/invoiceUtils'

interface BillingLinesTableProps {
  lines: BillingLineRow[]
  selectedIds?: Id<'billingLines'>[]
  onToggleLine?: (id: Id<'billingLines'>) => void
  onToggleAll?: (checked: boolean) => void
  selectable?: boolean
  showStatus?: boolean
}

export function BillingLinesTable({
  lines,
  selectedIds = [],
  onToggleLine,
  onToggleAll,
  selectable = false,
  showStatus = false,
}: BillingLinesTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          {selectable && (
            <TableHeader className="w-10">
              <input
                type="checkbox"
                checked={
                  lines.length > 0 && selectedIds.length === lines.length
                }
                onChange={(event) => onToggleAll?.(event.target.checked)}
                className="h-4 w-4 rounded border-atria-border text-atria-accent"
                aria-label="Select all visible billing lines"
              />
            </TableHeader>
          )}
          <TableHeader>Caregiver</TableHeader>
          <TableHeader>Client</TableHeader>
          <TableHeader>Service</TableHeader>
          <TableHeader>Date</TableHeader>
          <TableHeader>Hours</TableHeader>
          <TableHeader>Rate</TableHeader>
          <TableHeader className="text-right">Amount</TableHeader>
          {showStatus && <TableHeader>Status</TableHeader>}
        </TableRow>
      </TableHead>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line._id}>
            {selectable && (
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(line._id)}
                  onChange={() => onToggleLine?.(line._id)}
                  className="h-4 w-4 rounded border-atria-border text-atria-accent"
                  aria-label={`Select ${line.clientName} billing line`}
                />
              </TableCell>
            )}
            <TableCell>
              <div className="font-medium text-atria-ink">
                {line.caregiverEmail || line.caregiverName}
              </div>
              {line.caregiverEmail &&
                line.caregiverName !== line.caregiverEmail && (
                  <div className="text-xs text-atria-muted">
                    {line.caregiverName}
                  </div>
                )}
            </TableCell>
            <TableCell className="font-medium">{line.clientName}</TableCell>
            <TableCell>
              <Badge variant="default">{line.serviceType}</Badge>
            </TableCell>
            <TableCell>
              {line.scheduledStart
                ? new Date(line.scheduledStart).toLocaleDateString()
                : '-'}
            </TableCell>
            <TableCell>{line.hours}</TableCell>
            <TableCell>${line.rate.toFixed(2)}</TableCell>
            <TableCell className="text-right font-medium">
              ${line.amount.toFixed(2)}
            </TableCell>
            {showStatus && (
              <TableCell>
                {line.exportBatchId ? (
                  <Badge variant="success">Invoiced</Badge>
                ) : (
                  <Badge variant="warning">Ready</Badge>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
