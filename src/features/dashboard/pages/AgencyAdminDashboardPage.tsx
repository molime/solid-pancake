import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { KpiCard } from '@/shared/ui/KpiCard'
import {
  Banknote,
  FileClock,
  ShieldCheck,
  Users,
  AlertTriangle,
  XCircle,
  Hourglass,
} from 'lucide-react'
import { formatCurrency, formatDateUS } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'

export function AgencyAdminDashboardPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const summary = useQuery(
    api.reporting.getAdminDashboardSummary,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const escalations = useQuery(
    api.escalations.listEscalations,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const resolveEscalation = useMutation(api.escalations.resolveEscalation)
  const [escalationError, setEscalationError] = useState<string | null>(null)

  const handleResolve = async (escalationId: Id<'escalations'>) => {
    if (!clerkOrgId) return
    setEscalationError(null)
    try {
      await resolveEscalation({ clerkOrgId, escalationId })
    } catch (err) {
      setEscalationError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to resolve escalation.',
      )
    }
  }

  const exceptionRows = summary
    ? [
        {
          key: 'billing',
          label: 'Billing blocked',
          count: summary.exceptions.billingBlocked,
          icon: <XCircle className="h-4 w-4" />,
          tone: 'danger' as const,
        },
        {
          key: 'compliance',
          label: 'Compliance expired',
          count: summary.exceptions.complianceExpired,
          icon: <AlertTriangle className="h-4 w-4" />,
          tone: 'warning' as const,
        },
        {
          key: 'onboarding',
          label: 'Onboarding waiting',
          count: summary.exceptions.onboardingWaiting,
          icon: <Hourglass className="h-4 w-4" />,
          tone: 'info' as const,
        },
      ]
    : []
  const exceptionTotal = exceptionRows.reduce((sum, row) => sum + row.count, 0)

  const toneClasses: Record<'danger' | 'warning' | 'info', string> = {
    danger: 'bg-atria-danger-bg text-atria-danger',
    warning: 'bg-atria-warning-bg text-atria-warning',
    info: 'bg-atria-info-bg text-atria-info',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-atria-ink">Admin Dashboard</h1>
        <p className="text-base text-atria-text-secondary">
          {organization?.name
            ? `Agency overview for ${organization.name}.`
            : 'Agency overview.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ready to bill"
          value={formatCurrency(summary?.readyToBillAmount ?? 0)}
          icon={<Banknote className="h-5 w-5" />}
          valueClassName="text-atria-success"
          trend={
            <span className="text-sm text-atria-text-secondary">
              {summary?.readyToBill ?? 0} unbilled lines
            </span>
          }
        />
        <KpiCard
          label="Docs awaiting review"
          value={String(summary?.docsAwaitingReview ?? 0)}
          icon={<FileClock className="h-5 w-5" />}
          valueClassName="text-atria-warning"
          trend={
            <span className="text-sm text-atria-text-secondary">
              Uploaded documents pending HR review
            </span>
          }
        />
        <KpiCard
          label="Compliance rate"
          value={`${summary?.complianceRate ?? 0}%`}
          icon={<ShieldCheck className="h-5 w-5" />}
          valueClassName="text-atria-info"
          trend={
            <span className="text-sm text-atria-text-secondary">
              Verified credentials
            </span>
          }
        />
        <KpiCard
          label="Active caregivers"
          value={String(summary?.activeCaregivers ?? 0)}
          icon={<Users className="h-5 w-5" />}
          trend={
            <span className="text-sm text-atria-text-secondary">
              Caregivers on roster
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Exceptions</CardTitle>
          </CardHeader>
          <CardContent>
            {summary === undefined ? (
              <p className="py-8 text-center text-sm text-atria-text-secondary">
                Loading exceptions…
              </p>
            ) : exceptionTotal === 0 ? (
              <div className="rounded-[var(--radius-atria-md)] border border-dashed border-atria-border p-6 text-center">
                <p className="text-sm text-atria-text-secondary">
                  No exceptions
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {exceptionRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${toneClasses[row.tone]}`}
                      >
                        {row.icon}
                      </span>
                      <p className="text-sm font-medium text-atria-ink">
                        {row.label}
                      </p>
                    </div>
                    <span className="text-lg font-semibold text-atria-ink">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-atria-text-secondary">
                  Revenue billed
                </p>
                <p className="mt-1 text-2xl font-bold text-atria-ink">
                  {formatCurrency(summary?.monthly.revenueBilled ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-atria-text-secondary">
                  Visits completed
                </p>
                <p className="mt-1 text-2xl font-bold text-atria-ink">
                  {summary?.monthly.visitsCompleted ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Active Escalations</CardTitle>
          <span className="text-lg font-semibold text-atria-ink">
            {escalations?.length ?? 0}
          </span>
        </CardHeader>
        <CardContent>
          {escalations === undefined ? (
            <p className="py-8 text-center text-sm text-atria-text-secondary">
              Loading escalations…
            </p>
          ) : escalations.length === 0 ? (
            <div className="rounded-[var(--radius-atria-md)] border border-dashed border-atria-border p-6 text-center">
              <p className="text-sm text-atria-text-secondary">
                No active escalations
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {escalationError && (
                <p className="text-sm text-atria-danger">{escalationError}</p>
              )}
              {escalations.map((escalation) => (
                <div
                  key={escalation._id}
                  className="flex items-center justify-between rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-atria-warning-bg text-atria-warning">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-atria-ink">
                        {escalation.reason}
                      </p>
                      <p className="text-xs text-atria-text-secondary">
                        Level {escalation.escalationLevel} ·{' '}
                        {escalation.subjectType} ·{' '}
                        {formatDateUS(escalation.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleResolve(escalation._id)}
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
