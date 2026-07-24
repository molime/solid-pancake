import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { KpiCard } from '@/shared/ui/KpiCard'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Users, Building2, ClipboardCheck, AlertTriangle, ArrowRight, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { InviteCandidateModal } from '../components/InviteCandidateModal'
import { HrToast } from '../components/HrToast'
import { useHrToast } from '../hooks/useHrToast'
import { candidateStatusPill, candidateStatusAccentClass } from '../lib/candidateStatus'
import { formatDateUS } from '@/shared/format'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function HRDashboardPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const stats = useQuery(
    api.hrCases.hrDashboardStats,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const candidates = useQuery(
    api.candidates.listCandidates,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const [inviteOpen, setInviteOpen] = useState(false)
  const { toast, show, hide } = useHrToast()

  const pendingCandidates = (candidates ?? [])
    .filter(
      (c) =>
        c.status === 'invited' ||
        c.status === 'application_draft' ||
        c.status === 'applied' ||
        c.status === 'hr_review',
    )
    .slice(0, 3)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">People & hiring</h1>
          <p className="text-base text-atria-text-secondary">
            What needs your attention across hiring and the workforce today.
          </p>
        </div>
        <Button variant="primary" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Invite candidate
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="In pipeline"
          value={String(stats?.inPipeline ?? 0)}
          icon={<Users className="h-5 w-5" />}
          valueClassName="text-atria-info"
          trend={
            <span className="text-sm text-atria-text-secondary">
              Active candidates
            </span>
          }
        />
        <KpiCard
          label="Active employees"
          value={String(stats?.activeEmployees ?? 0)}
          icon={<Building2 className="h-5 w-5" />}
          valueClassName="text-atria-success"
          trend={
            <span className="text-sm text-atria-text-secondary">
              Hired caregivers
            </span>
          }
        />
        <KpiCard
          label="Expiring credentials"
          value={String(stats?.expiringCredentials ?? 0)}
          icon={<AlertTriangle className="h-5 w-5" />}
          valueClassName="text-atria-warning"
          trend={
            <span className="text-sm text-atria-text-secondary">
              Requires renewal
            </span>
          }
        />
        <KpiCard
          label="Open cases"
          value={String(stats?.openCases ?? 0)}
          icon={<ClipboardCheck className="h-5 w-5" />}
          valueClassName="text-atria-danger"
          trend={
            <span className="text-sm text-atria-text-secondary">
              HR issues to resolve
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Candidate pipeline</CardTitle>
            <Link
              to="/hr/candidates"
              className="text-sm font-medium text-atria-accent transition-colors hover:text-atria-accent-hover"
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {pendingCandidates.length === 0 ? (
              <div className="rounded-[var(--radius-atria-md)] border border-dashed border-atria-border p-6 text-center">
                <p className="text-sm text-atria-text-secondary">
                  No pending candidates. Invite someone to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCandidates.map((candidate) => {
                  const pill = candidateStatusPill(candidate.status)
                  return (
                    <div
                      key={candidate._id}
                      className="flex items-center justify-between rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${candidateStatusAccentClass(candidate.status)}`}
                        >
                          {initials(candidate.displayName)}
                        </div>
                        <div>
                          <p className="font-semibold text-atria-ink">
                            {candidate.displayName}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <StatusBadge variant={pill.variant}>
                              {pill.label}
                            </StatusBadge>
                            <span className="text-xs text-atria-text-muted">
                              Invited{' '}
                              {formatDateUS(candidate.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Link
                        to={`/hr/candidates/${candidate._id}`}
                        className="flex items-center gap-1 text-sm font-medium text-atria-accent hover:text-atria-accent-hover"
                      >
                        Review <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <InviteCandidateModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() =>
          show('success', 'Invitation sent', 'The candidate will receive an email invitation.')
        }
      />
      <HrToast toast={toast} onClose={hide} />
    </div>
  )
}
