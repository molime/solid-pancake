import { useOrganization } from '@clerk/react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { useState } from 'react'
import { Badge } from '@/shared/ui/Badge'
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
import { AppLoader } from '@/shared/ui/AppLoader'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { CalendarDays } from 'lucide-react'
import { formatDateUS, formatStatusLabel } from '@/shared/format'
import { downloadCsv } from '@/shared/lib/downloadCsv'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'

const statusVariant: Record<string, 'warning' | 'success' | 'neutral'> = {
  open: 'warning',
  exported: 'success',
}

export function PayrollPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const payPeriods = useQuery(
    api.billing.listPayPeriods,
    clerkOrgId ? { clerkOrgId } : 'skip',
  ) as Doc<'payPeriods'>[] | undefined
  const createPayPeriod = useMutation(api.billing.createPayPeriod)
  const exportPayroll = useAction(api.billing.exportPayroll)

  const [createOpen, setCreateOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<Id<'payPeriods'> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!payPeriods) {
    return <AppLoader label="Loading payroll" />
  }

  const handleCreatePayPeriod = async () => {
    if (!clerkOrgId || !startDate || !endDate) return
    setIsCreating(true)
    setCreateError(null)
    try {
      await createPayPeriod({ clerkOrgId, startDate, endDate })
      setCreateOpen(false)
      setStartDate('')
      setEndDate('')
      setError(null)
      setMessage(`Created pay period ${startDate} - ${endDate}.`)
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Pay period creation failed.',
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handleExport = async (payPeriodId: Id<'payPeriods'>) => {
    if (!clerkOrgId) return
    setExportingId(payPeriodId)
    setError(null)
    setMessage(null)
    try {
      const result = await exportPayroll({ clerkOrgId, payPeriodId })
      if (result.path === 'csv') {
        if (result.csv) {
          const period = payPeriods.find((p) => p._id === payPeriodId)
          const range = period
            ? `${period.startDate}-to-${period.endDate}`
            : payPeriodId
          downloadCsv(`payroll-${range}.csv`, result.csv)
        }
        setMessage(
          `CSV export (ADP not configured) — payroll exported for ${result.caregiverCount} caregiver(s).`,
        )
      } else {
        setMessage(
          `Payroll exported to ADP for ${result.caregiverCount} caregiver(s).`,
        )
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Payroll export failed.',
      )
    } finally {
      setExportingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-atria-ink">Payroll</h1>
          <p className="text-sm text-atria-muted">
            Create pay periods and export caregiver hours. Exports go to ADP
            when configured, otherwise they fall back to CSV.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          Create Pay Period
        </Button>
      </div>

      {message && <p className="text-sm text-atria-success">{message}</p>}
      {error && <p className="text-sm text-atria-danger">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Pay Periods</CardTitle>
        </CardHeader>
        <CardContent>
          {payPeriods.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" />}
              title="No pay periods"
              description="Create a pay period to start exporting payroll."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Start</TableHeader>
                  <TableHeader>End</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Exported</TableHeader>
                  <TableHeader className="text-right">Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {payPeriods.map((period) => (
                  <TableRow key={period._id}>
                    <TableCell className="font-medium">
                      {formatDateUS(period.startDate)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatDateUS(period.endDate)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant[period.status] ?? 'neutral'}
                      >
                        {formatStatusLabel(period.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {period.exportedAt
                        ? formatDateUS(period.exportedAt)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={exportingId === period._id}
                        onClick={() => handleExport(period._id)}
                      >
                        {exportingId === period._id
                          ? 'Exporting…'
                          : period.status === 'exported'
                            ? 'Re-export'
                            : 'Export Payroll'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)}>
        <DialogHeader>
          <DialogTitle>Create pay period</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldGroup label="Start date" htmlFor="payPeriodStart" required>
              <USDateInput
                id="payPeriodStart"
                value={startDate}
                onChange={setStartDate}
              />
            </FieldGroup>
            <FieldGroup label="End date" htmlFor="payPeriodEnd" required>
              <USDateInput
                id="payPeriodEnd"
                value={endDate}
                onChange={setEndDate}
              />
            </FieldGroup>
          </div>
          {createError && (
            <p className="text-sm text-atria-danger">{createError}</p>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreatePayPeriod}
            disabled={isCreating || !startDate || !endDate}
          >
            {isCreating ? 'Creating…' : 'Create pay period'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
