import { useOrganization, useUser } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import {
  AlertTriangle,
  Banknote,
  Bell,
  XCircle,
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'

export function DashboardPage() {
  const { organization } = useOrganization()
  const { user } = useUser()
  const clerkOrgId = organization?.id
  const member = useQuery(api.members.me, clerkOrgId ? { clerkOrgId } : 'skip')
  const caregivers = useQuery(
    api.members.listCaregivers,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const canViewDashboard =
    member?.role === 'org:admin' || member?.role === 'org:coordinator'

  const stats = useQuery(
    api.shiftQueries.dashboardStats,
    clerkOrgId && canViewDashboard ? { clerkOrgId } : 'skip',
  )
  const complianceOverview = useQuery(
    api.compliance.getComplianceOverview,
    clerkOrgId && canViewDashboard ? { clerkOrgId } : 'skip',
  )
  const readyLines = useQuery(
    api.billing.unexported,
    clerkOrgId && canViewDashboard ? { clerkOrgId } : 'skip',
  )
  const readyToInvoice = readyLines?.length ?? 0

  if (member?.role === 'org:caregiver') {
    return <Navigate to="/caregiver/today" replace />
  }

  const greeting = user?.firstName ? `Good afternoon, ${user.firstName}` : 'Good afternoon'
  const caregiverCount = caregivers?.length ?? 0
  const pendingDocuments = (stats?.submitted ?? 0) + (stats?.needsCorrection ?? 0)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">{greeting}</h1>
          <p className="text-base text-atria-muted">
            Here&apos;s what needs your attention today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/notifications"
            aria-label="Open notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-atria-border bg-atria-surface text-atria-muted transition-colors hover:text-atria-ink"
          >
            <Bell className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Caregivers"
          value={String(caregiverCount)}
          trend={
            <span className="inline-flex items-center gap-1 text-sm text-atria-muted">
              Active caregivers
            </span>
          }
        />
        <KpiCard
          label="Compliance Rate"
          value="—"
          trend={
            <span className="inline-flex items-center gap-1 text-sm text-atria-muted">
              No compliance data available
            </span>
          }
        />
        <KpiCard
          label="Pending Documents"
          value={String(pendingDocuments)}
          trend={
            <span className="inline-flex items-center gap-1 text-sm text-atria-warning">
              <span className="h-2 w-2 rounded-full bg-atria-warning" />
              {stats?.submitted ?? 0} need review now
            </span>
          }
          valueClass="text-atria-warning"
        />
        <KpiCard
          label="Training Due"
          value={String(stats?.needsCorrection ?? 0)}
          trend={
            <span className="inline-flex items-center gap-1 text-sm text-atria-danger">
              <span className="h-2 w-2 rounded-full bg-atria-danger" />
              Need correction
            </span>
          }
          valueClass="text-atria-danger"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Employee Compliance Status</CardTitle>
            <button
              className="text-sm font-medium text-atria-accent transition-colors hover:text-atria-accent-hover"
              type="button"
            >
              View all →
            </button>
          </CardHeader>
          <CardContent>
            <div className="rounded-[var(--radius-atria-md)] border border-dashed border-atria-border p-6 text-center">
              <p className="text-sm text-atria-muted">
                Compliance tracking is not available yet.
              </p>
              <p className="mt-1 text-xs text-atria-muted">
                Employee credentials and certification status will appear here
                once configured.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Supervisor Alerts</CardTitle>
            <Badge variant="default">0</Badge>
          </CardHeader>
          <CardContent>
            <div className="rounded-[var(--radius-atria-md)] border border-dashed border-atria-border p-6 text-center">
              <p className="text-sm text-atria-muted">No alerts right now.</p>
              <p className="mt-1 text-xs text-atria-muted">
                Critical notifications will appear here when shifts need
                attention.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {canViewDashboard && complianceOverview && (
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            {complianceOverview.expiring === 0 &&
            complianceOverview.expired === 0 &&
            pendingDocuments === 0 &&
            readyToInvoice === 0 ? (
              <div className="rounded-[var(--radius-atria-md)] border border-dashed border-atria-border p-6 text-center">
                <p className="text-sm text-atria-muted">
                  Nothing needs attention right now.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingDocuments > 0 && (
                  <Link
                    to="/coordinator/review"
                    className="flex items-center justify-between rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-3 transition-colors hover:border-atria-accent/40"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-atria-info-bg text-atria-info">
                        <Bell className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-medium text-atria-ink">
                        Pending document reviews
                      </p>
                    </div>
                    <span className="text-lg font-semibold text-atria-ink">
                      {pendingDocuments}
                    </span>
                  </Link>
                )}
                {readyToInvoice > 0 && (
                  <Link
                    to="/billing"
                    className="flex items-center justify-between rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-3 transition-colors hover:border-atria-accent/40"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-atria-success-bg text-atria-success">
                        <Banknote className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-medium text-atria-ink">
                        Billing lines ready to invoice
                      </p>
                    </div>
                    <span className="text-lg font-semibold text-atria-ink">
                      {readyToInvoice}
                    </span>
                  </Link>
                )}
                {complianceOverview.expiring > 0 && (
                  <Link
                    to="/compliance"
                    className="flex items-center justify-between rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-3 transition-colors hover:border-atria-accent/40"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-atria-warning-bg text-atria-warning">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-medium text-atria-ink">
                        Credentials expiring within 30 days
                      </p>
                    </div>
                    <span className="text-lg font-semibold text-atria-ink">
                      {complianceOverview.expiring}
                    </span>
                  </Link>
                )}
                {complianceOverview.expired > 0 && (
                  <Link
                    to="/compliance"
                    className="flex items-center justify-between rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-3 transition-colors hover:border-atria-accent/40"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-atria-danger-bg text-atria-danger">
                        <XCircle className="h-4 w-4" />
                      </span>
                      <p className="text-sm text-atria-ink">
                        Expired credentials
                      </p>
                    </div>
                    <span className="text-lg font-semibold text-atria-ink">
                      {complianceOverview.expired}
                    </span>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  trend,
  valueClass = 'text-atria-ink',
}: {
  label: string
  value: string
  trend: React.ReactNode
  valueClass?: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-atria-muted">{label}</p>
        <p className={`mt-2 text-3xl font-bold ${valueClass}`}>{value}</p>
        <div className="mt-2">{trend}</div>
      </CardContent>
    </Card>
  )
}
