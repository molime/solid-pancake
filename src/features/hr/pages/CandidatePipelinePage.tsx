import { useOrganization } from '@clerk/react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent } from '@/shared/ui/Card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ArrowRight, Users, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { InviteCandidateModal } from '../components/InviteCandidateModal'
import type { Id } from '../../../../convex/_generated/dataModel'
import { HrToast } from '../components/HrToast'
import { useHrToast } from '../hooks/useHrToast'
import { candidateStatusPill } from '../lib/candidateStatus'
import { formatWeekdayDate } from '@/shared/format'
import { cn } from '@/shared/lib/cn'

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'review_needed', label: 'Review needed' },
  { value: 'hired', label: 'Hired' },
] as const

type TabValue = (typeof TABS)[number]['value']

function matchesTab(candidate: { status: string }, tab: TabValue): boolean {
  if (tab === 'all') return true
  if (tab === 'hired') return candidate.status === 'hired'
  if (tab === 'review_needed') {
    return (
      candidate.status === 'applied' ||
      candidate.status === 'hr_review' ||
      candidate.status === 'application_draft'
    )
  }
  return (
    candidate.status === 'invited' ||
    candidate.status === 'application_draft' ||
    candidate.status === 'applied' ||
    candidate.status === 'hr_review' ||
    candidate.status === 'offer_sent' ||
    candidate.status === 'accepted'
  )
}

export function CandidatePipelinePage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const candidates = useQuery(
    api.candidates.listCandidates,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const regenerateTicket = useAction(api.candidates.regenerateCandidateMagicLink)

  const [activeTab, setActiveTab] = useState<TabValue>('all')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({})
  const { toast, show, hide } = useHrToast()

  const filtered = (candidates ?? []).filter((c) => matchesTab(c, activeTab))

  const handleRegenerateLink = async (candidateId: string) => {
    if (!clerkOrgId) return
    setRegenerating((prev) => ({ ...prev, [candidateId]: true }))
    try {
      const { magicLink } = await regenerateTicket({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
      })
      await navigator.clipboard.writeText(magicLink)
      show('success', 'Sign-in link copied', 'A fresh sign-in link is on the clipboard.')
    } catch (err) {
      show(
        'danger',
        'Could not regenerate link',
        err instanceof Error ? err.message : 'Unknown error',
      )
    } finally {
      setRegenerating((prev) => ({ ...prev, [candidateId]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">Candidate Pipeline</h1>
          <p className="text-base text-atria-text-secondary">
            Track applicants by stage — screening, interviews, offers, and onboarding.
          </p>
        </div>
        <Button
          variant="primary"
          data-testid="invite-candidate-button"
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus className="h-4 w-4" />
          Invite candidate
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.value
                ? 'bg-atria-accent text-atria-on-accent'
                : 'border border-atria-border bg-atria-surface text-atria-ink hover:bg-atria-surface-2',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title="No candidates"
                description="There are no candidates in this stage right now."
              />
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>NAME</TableHeader>
                  <TableHeader>EMAIL</TableHeader>
                  <TableHeader>INVITED</TableHeader>
                  <TableHeader>STATUS</TableHeader>
                  <TableHeader>TASKS</TableHeader>
                  <TableHeader className="w-32">ACTIONS</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((candidate) => {
                  const pill = candidateStatusPill(candidate.status)
                  const completedTasks = 0
                  const totalTasks = 5
                  return (
                    <TableRow
                      key={candidate._id}
                      data-testid={`candidate-row-${candidate._id}`}
                    >
                      <TableCell className="font-medium">
                        {candidate.displayName}
                      </TableCell>
                      <TableCell className="text-atria-text-secondary">
                        {candidate.email}
                      </TableCell>
                      <TableCell>
                        {formatWeekdayDate(candidate.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge variant={pill.variant}>{pill.label}</StatusBadge>
                          {candidate.invitationFailed && (
                            <span
                              title={candidate.invitationError ?? 'Invitation failed'}
                              className="inline-flex items-center rounded-[var(--radius-atria-sm)] border border-atria-danger/30 bg-atria-danger-bg px-2 py-1 text-xs font-semibold text-atria-danger"
                            >
                              Failed
                            </span>
                          )}
                          {candidate.manualSetup && (
                            <span className="inline-flex items-center rounded-[var(--radius-atria-sm)] border border-atria-info/30 bg-atria-info-bg px-2 py-1 text-xs font-semibold text-atria-info">
                              Manual setup
                            </span>
                          )}
                          {candidate.manualSetup && (
                            <Button
                              variant="secondary"
                              size="sm"
                              data-testid={`regenerate-link-${candidate._id}`}
                              disabled={regenerating[candidate._id]}
                              onClick={() => handleRegenerateLink(candidate._id)}
                            >
                              {regenerating[candidate._id]
                                ? 'Copying…'
                                : 'Copy sign-in link'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-atria-text-secondary">
                          {completedTasks}/{totalTasks}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/hr/candidates/${candidate._id}`}
                            className="flex items-center gap-1 text-sm font-medium text-atria-accent hover:text-atria-accent-hover"
                          >
                            Review <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                          {candidate.status === 'accepted' && (
                            <Link
                              to={`/hr/candidates/${candidate._id}/hire`}
                              className="flex items-center gap-1 text-sm font-medium text-atria-success hover:text-atria-success-hover"
                            >
                              Hire <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
