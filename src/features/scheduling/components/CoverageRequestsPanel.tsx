import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { Badge } from '@/shared/ui/Badge'
import { formatTime, formatWeekdayDate } from '@/shared/format'

type CoverageStatus = 'open' | 'filled' | 'cancelled'

type CoverageRequest = {
  _id: Id<'coverageRequests'>
  shiftId: Id<'shifts'>
  requesterId: string
  reason: string
  status: CoverageStatus
  shift?: {
    scheduledStart: string
    scheduledEnd: string
  } | null
  clientName?: string
}

const statusBadgeVariant: Record<
  CoverageStatus,
  'warning' | 'success' | 'neutral'
> = {
  open: 'warning',
  filled: 'success',
  cancelled: 'neutral',
}

export function CoverageRequestsPanel({
  clerkOrgId: propClerkOrgId,
}: {
  clerkOrgId?: string
}) {
  const { organization } = useOrganization()
  const clerkOrgId = propClerkOrgId ?? organization?.id

  const requests = useQuery(
    api.scheduling.listCoverageRequests,
    clerkOrgId ? { clerkOrgId, status: 'open' } : 'skip',
  )
  const caregivers = useQuery(
    api.members.listCaregivers,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const resolveCoverage = useMutation(api.scheduling.resolveCoverage)

  const [selections, setSelections] = useState<Record<string, string>>({})
  const [resolving, setResolving] = useState<Record<string, boolean>>({})

  const caregiverById = useMemo(() => {
    const map = new Map<string, { displayName: string; email: string }>()
    for (const cg of caregivers ?? []) {
      map.set(cg.clerkUserId, {
        displayName: cg.displayName,
        email: cg.email,
      })
    }
    return map
  }, [caregivers])

  if (!requests || !caregivers) return null
  if (requests.length === 0) return null

  const handleAssign = async (request: CoverageRequest) => {
    const reassignedTo = selections[request._id]
    if (!clerkOrgId || !reassignedTo) return
    setResolving((prev) => ({ ...prev, [request._id]: true }))
    try {
      await resolveCoverage({
        clerkOrgId,
        coverageRequestId: request._id,
        reassignedTo,
      })
      setSelections((prev) => ({ ...prev, [request._id]: '' }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      window.alert(message)
    } finally {
      setResolving((prev) => ({ ...prev, [request._id]: false }))
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-semibold text-atria-ink">
            Coverage requests
          </h3>
          <p className="text-base text-atria-text-secondary">
            Open requests waiting for reassignment.
          </p>
        </div>

        <div className="divide-y divide-atria-border rounded-[var(--radius-atria-lg)] border border-atria-border">
          {requests.map((request) => {
            const start = request.shift?.scheduledStart
            const requester = caregiverById.get(request.requesterId)
            return (
              <div
                key={request._id}
                data-testid="coverage-request-row"
                className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-base font-semibold text-atria-ink">
                    {start
                      ? `${formatWeekdayDate(start)} · ${formatTime(start)} – ${formatTime(request.shift?.scheduledEnd ?? '')}`
                      : 'Unknown date'}
                  </p>
                  <p className="text-base text-atria-text-secondary">
                    {requester?.displayName || requester?.email || 'Unknown caregiver'}
                    {' · '}
                    {request.reason}
                  </p>
                  <Badge variant={statusBadgeVariant[request.status]}>
                    {request.status[0].toUpperCase() + request.status.slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={selections[request._id] ?? ''}
                    onChange={(e) =>
                      setSelections((prev) => ({
                        ...prev,
                        [request._id]: e.target.value,
                      }))
                    }
                    className="min-w-[180px]"
                    data-testid="coverage-assign-select"
                  >
                    <option value="" disabled>
                      Assign caregiver
                    </option>
                    {caregivers
                      .filter((cg) => cg.clerkUserId !== request.requesterId)
                      .map((cg) => (
                        <option key={cg.clerkUserId} value={cg.clerkUserId}>
                          {cg.displayName || cg.email}
                        </option>
                      ))}
                  </Select>
                  <Button
                    variant="primary"
                    size="sm"
                    data-testid="coverage-assign-button"
                    disabled={!selections[request._id] || resolving[request._id]}
                    onClick={() => handleAssign(request)}
                  >
                    {resolving[request._id] ? 'Assigning…' : 'Assign'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
