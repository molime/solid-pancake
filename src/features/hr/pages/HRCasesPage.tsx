import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
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
import { ClipboardCheck, Plus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { NewCaseModal } from '../components/NewCaseModal'
import { CaseDetailModal } from '../components/CaseDetailModal'
import { caseStatusVariant } from '../lib/caseStatus'
import { HrToast } from '../components/HrToast'
import { useHrToast } from '../hooks/useHrToast'
import { formatDateUS } from '@/shared/format'
import { AgencyBranding } from '@/shared/ui/AgencyBranding'
import type { Id } from '../../../../convex/_generated/dataModel'

export function HRCasesPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const cases = useQuery(
    api.hrCases.listHrCases,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const employees = useQuery(
    api.employeeProfiles.listEmployeeProfiles,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<Id<'hrCases'> | null>(
    null,
  )
  const { toast, show, hide } = useHrToast()
  const triggerFlagCheck = useMutation(api.hrCases.triggerFlagCheck)

  const handleCheckForIssues = async () => {
    if (!clerkOrgId || checking) return
    setChecking(true)
    try {
      const result = await triggerFlagCheck({ clerkOrgId })
      show(
        'success',
        result.created === 0
          ? 'No new issues found'
          : `Flagged ${result.created} new ${result.created === 1 ? 'issue' : 'issues'}`,
      )
    } catch {
      show('danger', 'Could not check for issues')
    } finally {
      setChecking(false)
    }
  }

  const memberIdByClerkUserId = new Map(
    (employees ?? [])
      .filter((e) => e.clerkUserId && e.tenantMemberId)
      .map((e) => [e.clerkUserId as string, e.tenantMemberId as string]),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">HR Cases</h1>
          <p className="text-base text-atria-text-secondary">
            Track discrepancies, disputes, and open issues requiring HR resolution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleCheckForIssues}
            disabled={!clerkOrgId || checking}
          >
            <RefreshCw className="h-4 w-4" />
            {checking ? 'Checking…' : 'Check for issues'}
          </Button>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New case
          </Button>
        </div>
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
                  <TableHeader>CASE ID</TableHeader>
                  <TableHeader>SUBJECT</TableHeader>
                  <TableHeader>TITLE</TableHeader>
                  <TableHeader>KIND</TableHeader>
                  <TableHeader>STATUS</TableHeader>
                  <TableHeader>ASSIGNED</TableHeader>
                  <TableHeader>CREATED</TableHeader>
                  <TableHeader className="w-56">ACTIONS</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {cases.map((c) => {
                  const memberId =
                    c.subjectType === 'employee'
                      ? memberIdByClerkUserId.get(c.subjectId)
                      : undefined
                  return (
                    <TableRow
                      key={c._id}
                      className="cursor-pointer"
                      onClick={() => setSelectedCaseId(c._id)}
                    >
                      <TableCell className="font-medium">
                        {c.caseNumber ?? '—'}
                      </TableCell>
                      <TableCell>
                        {memberId ? (
                          <Link
                            to={`/hr/employees/${memberId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-atria-accent hover:text-atria-accent-hover"
                          >
                            {c.subjectName}
                          </Link>
                        ) : (
                          <span className="font-medium">{c.subjectName}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-atria-text-secondary">
                        {c.title}
                      </TableCell>
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedCaseId(c._id)}
                          className="whitespace-nowrap text-sm font-medium text-atria-accent hover:text-atria-accent-hover"
                        >
                          View →
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AgencyBranding />

      <NewCaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => show('success', 'Case created')}
      />
      <CaseDetailModal
        caseId={selectedCaseId}
        clerkOrgId={clerkOrgId}
        onClose={() => setSelectedCaseId(null)}
        onUpdated={() => show('success', 'Case updated')}
      />
      <HrToast toast={toast} onClose={hide} />
    </div>
  )
}
