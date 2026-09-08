import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Link } from 'react-router-dom'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { formatDateUS } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { STATUS_OPTIONS, caseStatusVariant } from '../lib/caseStatus'

function DetailField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
        {label}
      </p>
      <div className="mt-1 text-base text-atria-ink">{children}</div>
    </div>
  )
}

export function CaseDetailModal({
  caseId,
  clerkOrgId,
  onClose,
  onUpdated,
}: {
  caseId: Id<'hrCases'> | null
  clerkOrgId: string | undefined
  onClose: () => void
  onUpdated?: () => void
}) {
  const hrCase = useQuery(
    api.hrCases.getHrCase,
    clerkOrgId && caseId ? { clerkOrgId, caseId } : 'skip',
  )
  const employees = useQuery(
    api.employeeProfiles.listEmployeeProfiles,
    clerkOrgId && caseId ? { clerkOrgId } : 'skip',
  )
  const updateHrCase = useMutation(api.hrCases.updateHrCase)
  const [error, setError] = useState<string | null>(null)

  const subjectMemberId =
    hrCase?.subjectType === 'employee'
      ? employees?.find((e) => e.clerkUserId === hrCase.subjectId)
          ?.tenantMemberId
      : undefined

  const handleStatusChange = async (status: string) => {
    if (!clerkOrgId || !caseId) return
    setError(null)
    try {
      await updateHrCase({ clerkOrgId, caseId, status })
      onUpdated?.()
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to update case.',
      )
    }
  }

  return (
    <Dialog open={caseId !== null} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>{hrCase?.title ?? 'Case details'}</DialogTitle>
      </DialogHeader>
      <DialogContent className="space-y-4">
        {!hrCase ? (
          <p className="text-sm text-atria-text-secondary">Loading case…</p>
        ) : (
          <>
            {error && <p className="text-sm text-atria-danger">{error}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailField label="CASE ID">
                {hrCase.caseNumber ?? '—'}
              </DetailField>
              <DetailField label="CATEGORY">{hrCase.category}</DetailField>
              <DetailField label="STATUS">
                <StatusBadge variant={caseStatusVariant(hrCase.status)}>
                  {hrCase.status}
                </StatusBadge>
              </DetailField>
              <DetailField label="SUBJECT">
                {hrCase.subjectType === 'employee' && subjectMemberId ? (
                  <Link
                    to={`/hr/employees/${subjectMemberId}`}
                    className="font-medium text-atria-accent hover:text-atria-accent-hover"
                  >
                    {hrCase.subjectName}
                  </Link>
                ) : (
                  hrCase.subjectName
                )}
              </DetailField>
              <DetailField label="ASSIGNED TO">{hrCase.ownerName}</DetailField>
              <DetailField label="OPENED">
                {formatDateUS(hrCase.createdAt)}
              </DetailField>
              {hrCase.resolvedAt && (
                <DetailField label="RESOLVED">
                  {formatDateUS(hrCase.resolvedAt)}
                </DetailField>
              )}
            </div>
            <DetailField label="DESCRIPTION">
              {hrCase.description || '—'}
            </DetailField>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
                CHANGE STATUS
              </p>
              <Select
                value={hrCase.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="mt-1 text-sm"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}
      </DialogContent>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
