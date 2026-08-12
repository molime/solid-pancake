import { useState } from 'react'
import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Textarea } from '@/shared/ui/Textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { formatDateUS } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
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
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const member = useQuery(
    api.members.me,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const releaseBillingBlock = useMutation(api.billing.releaseBillingBlock)

  const canRelease =
    member?.role === 'org:admin' || member?.role === 'org:coordinator'

  const [releaseLine, setReleaseLine] = useState<BillingLineRow | null>(null)
  const [releaseReason, setReleaseReason] = useState('')
  const [releaseError, setReleaseError] = useState<string | null>(null)
  const [isReleasing, setIsReleasing] = useState(false)

  const openRelease = (line: BillingLineRow) => {
    setReleaseLine(line)
    setReleaseReason('')
    setReleaseError(null)
  }

  const handleRelease = async () => {
    if (!clerkOrgId || !releaseLine || !releaseReason.trim()) return
    setIsReleasing(true)
    setReleaseError(null)
    try {
      await releaseBillingBlock({
        clerkOrgId,
        billingLineId: releaseLine._id,
        reason: releaseReason.trim(),
      })
      setReleaseLine(null)
      setReleaseReason('')
    } catch (err) {
      setReleaseError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to release the billing block.',
      )
    } finally {
      setIsReleasing(false)
    }
  }

  return (
    <>
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
                  ? formatDateUS(line.scheduledStart)
                  : '-'}
              </TableCell>
              <TableCell>{line.hours}</TableCell>
              <TableCell>${line.rate.toFixed(2)}</TableCell>
              <TableCell className="text-right font-medium">
                ${line.amount.toFixed(2)}
              </TableCell>
              {showStatus && (
                <TableCell>
                  {line.blockedReason ? (
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant="danger">Blocked</Badge>
                      <span className="text-xs text-atria-danger">
                        {line.blockedReason}
                      </span>
                      {canRelease && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openRelease(line)}
                        >
                          Release
                        </Button>
                      )}
                    </div>
                  ) : line.exportBatchId ? (
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

      <Dialog open={releaseLine !== null} onClose={() => setReleaseLine(null)}>
        <DialogHeader>
          <DialogTitle>Release billing block</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          {releaseLine && (
            <p className="text-sm text-atria-muted">
              {releaseLine.clientName} ·{' '}
              {formatDateUS(releaseLine.scheduledStart)} · $
              {releaseLine.amount.toFixed(2)} — blocked:{' '}
              {releaseLine.blockedReason}
            </p>
          )}
          <FieldGroup label="Release reason" htmlFor="releaseReason" required>
            <Textarea
              id="releaseReason"
              value={releaseReason}
              onChange={(event) => setReleaseReason(event.target.value)}
              placeholder="Why is this line being released?"
            />
          </FieldGroup>
          {releaseError && (
            <p className="text-sm text-atria-danger">{releaseError}</p>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setReleaseLine(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleRelease}
            disabled={isReleasing || !releaseReason.trim()}
          >
            {isReleasing ? 'Releasing…' : 'Release block'}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
