import { useOrganization, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import {
  AlertTriangle,
  Clock,
  Database,
  DollarSign,
  FileCheck,
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
  const canViewDashboard =
    member?.role === 'org:admin' || member?.role === 'org:coordinator'
  const canSeedDemo = member?.role === 'org:admin'

  const stats = useQuery(
    api.shiftQueries.dashboardStats,
    clerkOrgId && canViewDashboard ? { clerkOrgId } : 'skip',
  )

  const lanes = [
    {
      label: 'Needs documentation',
      count: stats?.inProgress ?? 0,
      icon: <Clock className="h-4 w-4 text-atria-warning" />,
      badge: 'warning' as const,
    },
    {
      label: 'Submitted for review',
      count: stats?.submitted ?? 0,
      icon: <FileCheck className="h-4 w-4 text-atria-info" />,
      badge: 'info' as const,
    },
    {
      label: 'Billing blocked',
      count: stats?.needsCorrection ?? 0,
      icon: <AlertTriangle className="h-4 w-4 text-atria-danger" />,
      badge: 'danger' as const,
    },
    {
      label: 'Ready to invoice',
      count: stats?.billingReady ?? 0,
      icon: <DollarSign className="h-4 w-4 text-atria-success" />,
      badge: 'success' as const,
    },
  ]

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
        error instanceof Error ? error.message : 'Unable to seed demo data.',
      )
      setSeedStatus('')
    } finally {
      setSeeding(false)
    }
  }

  if (member?.role === 'org:caregiver') {
    return <Navigate to="/caregiver/today" replace />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-atria-ink">
            Operations Cockpit
          </h1>
          <p className="text-sm text-atria-muted">
            {organization?.name ?? 'Agency'} — Real-time shift and billing
            status
          </p>
        </div>
        {canSeedDemo && (
          <Button
            variant="secondary"
            size="sm"
            disabled={seeding}
            onClick={handleSeedDemo}
          >
            <Database className="h-4 w-4" />
            {seeding ? 'Seeding…' : 'Seed demo data'}
          </Button>
        )}
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
        stats.billingReady === 0 && (
          <div className="rounded-md bg-atria-bg border border-atria-border px-4 py-6 text-center">
            <p className="text-sm text-atria-muted">
              No demo data yet. Ask an agency admin to seed demo data or create
              clients and shifts from the Clients area.
            </p>
          </div>
        )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {lanes.map((lane) => (
          <Card key={lane.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {lane.icon}
                  <span className="text-sm text-atria-muted">{lane.label}</span>
                </div>
                <Badge variant={lane.badge}>{lane.count}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue at Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-atria-ink">
                ${stats?.dollarsAtRisk?.toFixed(2) ?? '0.00'}
              </span>
              <span className="text-sm text-atria-muted">
                in billing-ready shifts awaiting invoice creation
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Oldest Item</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-atria-ink">
                {stats?.oldestSubmittedAge ?? 0}d
              </span>
              <span className="text-sm text-atria-muted">
                oldest submitted shift
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
