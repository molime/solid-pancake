import { useOrganization } from '@clerk/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Select } from '@/shared/ui/Select'
import { ClipboardCheck, Plus } from 'lucide-react'
import { useState } from 'react'
import { NewCaseModal } from '../components/NewCaseModal'
import { HrToast } from '../components/HrToast'
import { useHrToast } from '../hooks/useHrToast'
import { formatDateUS } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import type { Id } from '../../../../convex/_generated/dataModel'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

function caseStatusVariant(status: string) {
  switch (status) {
    case 'open':
      return 'danger'
    case 'in_review':
      return 'warning'
    case 'resolved':
      return 'success'
    default:
      return 'neutral'
  }
}

export function HRCasesPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const cases = useQuery(
    api.hrCases.listHrCases,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const updateHrCase = useMutation(api.hrCases.updateHrCase)

  const [modalOpen, setModalOpen] = useState(false)
  const { toast, show, hide } = useHrToast()

  const handleStatusChange = async (
    caseId: Id<'hrCases'>,
    status: string,
  ) => {
    if (!clerkOrgId) return
    try {
      await updateHrCase({ clerkOrgId, caseId, status })
      show('success', 'Case updated')
    } catch (err) {
      show(
        'danger',
        'Update failed',
        err instanceof Error ? sanitizeConvexError(err.message) : 'Unknown error.',
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">HR Cases</h1>
          <p className="text-base text-atria-text-secondary">
            Track discrepancies, disputes, and open issues requiring HR resolution.
          </p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New case
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {!cases || cases.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ClipboardCheck className="h-6 w-6" />}
                title="No cases yet"
                description="Open a case to track an HR issue."
              />
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>SUBJECT</TableHeader>
                  <TableHeader>KIND</TableHeader>
                  <TableHeader>STATUS</TableHeader>
                  <TableHeader>ASSIGNED</TableHeader>
                  <TableHeader>CREATED</TableHeader>
                  <TableHeader className="w-40">ACTIONS</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {cases.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell className="font-medium">{c.subjectName}</TableCell>
                    <TableCell className="text-atria-text-secondary">
                      {c.category}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={caseStatusVariant(c.status)}>
                        {c.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{c.ownerName}</TableCell>
                    <TableCell>{formatDateUS(c.createdAt)}</TableCell>
                    <TableCell>
                      <Select
                        value={c.status}
                        onChange={(e) =>
                          handleStatusChange(c._id as Id<'hrCases'>, e.target.value)
                        }
                        className="text-sm"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewCaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => show('success', 'Case created')}
      />
      <HrToast toast={toast} onClose={hide} />
    </div>
  )
}
