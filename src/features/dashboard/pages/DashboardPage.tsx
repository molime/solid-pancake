import { useOrganization, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import {
  Bell,
  Database,
  Plus,
  Search,
} from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'

export function DashboardPage() {
  const { organization } = useOrganization()
  const { user } = useUser()
  const clerkOrgId = organization?.id
  const seedAgency = useMutation(api.seed.seedAgency)
  const [seedMessage, setSeedMessage] = useState('')
  const [seedStatus, setSeedStatus] = useState<
    'seeded' | 'already-seeded' | ''
  >('')
  const [seeding, setSeeding] = useState(false)
  const member = useQuery(api.members.me, clerkOrgId ? { clerkOrgId } : 'skip')
  const caregivers = useQuery(
    api.members.listCaregivers,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const canViewDashboard =
    member?.role === 'org:admin' || member?.role === 'org:coordinator'
  const canSeedDemo = member?.role === 'org:admin'

  const stats = useQuery(
    api.shiftQueries.dashboardStats,
    clerkOrgId && canViewDashboard ? { clerkOrgId } : 'skip',
  )

  const handleSeedDemo = async () => {
    if (!clerkOrgId || !user || !canSeedDemo) return
    setSeeding(true)
    try {
      const result = await seedAgency({
        clerkOrgId,
        caregiverIds: [user.id, 'demo-caregiver-2'],
      })
      setSeedMessage(result.message)
      setSeedStatus(result.status)
    } catch (error) {
      setSeedMessage(
        error instanceof Error ? sanitizeConvexError(error.message) : 'Unable to seed demo data.',
      )
      setSeedStatus('')
    } finally {
      setSeeding(false)
    }
  }

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
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-atria-muted" />
            <input
              className="h-10 w-64 rounded-full border border-atria-border bg-atria-surface pl-9 pr-4 text-sm text-atria-ink placeholder:text-atria-muted focus:border-atria-accent focus:outline-none focus:ring-1 focus:ring-atria-accent"
              placeholder="Search caregivers, clients…"
              type="text"
            />
          </div>
          <Button variant="primary" size="sm">
            <Plus className="h-4 w-4" />
            Quick Actions
          </Button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-atria-border bg-atria-surface text-atria-muted transition-colors hover:text-atria-ink"
            type="button"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>

      {seedMessage && (
        <div
          className={`rounded-md border px-4 py-3 ${
            seedStatus === 'already-seeded'
              ? 'bg-atria-warning-bg border-atria-warning/20'
              : 'bg-atria-accent/10 border-atria-accent/20'
          }`}
        >
          <p className="text-sm text-atria-ink font-medium">{seedMessage}</p>
        </div>
      )}

      {stats &&
        stats.inProgress === 0 &&
        stats.submitted === 0 &&
        stats.needsCorrection === 0 &&
        stats.billingReady === 0 &&
        canSeedDemo && (
          <div className="rounded-md bg-atria-bg border border-atria-border px-4 py-6 text-center">
            <p className="text-sm text-atria-muted">
              No demo data yet. Ask an agency admin to seed demo data or create
              clients and shifts from the Clients area.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              disabled={seeding}
              onClick={handleSeedDemo}
            >
              <Database className="h-4 w-4" />
              {seeding ? 'Seeding…' : 'Seed demo data'}
            </Button>
          </div>
        )}

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
