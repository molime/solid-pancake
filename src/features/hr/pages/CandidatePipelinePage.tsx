import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
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

  const [activeTab, setActiveTab] = useState<TabValue>('all')
  const [inviteOpen, setInviteOpen] = useState(false)
  const { toast, show, hide } = useHrToast()

  const filtered = (candidates ?? []).filter((c) => matchesTab(c, activeTab))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">Candidate Pipeline</h1>
          <p className="text-base text-atria-text-secondary">
            Track applicants by stage — screening, interviews, offers, and onboarding.
          </p>
        </div>
        <Button variant="primary" onClick={() => setInviteOpen(true)}>
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
                    <TableRow key={candidate._id}>
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
                        <StatusBadge variant={pill.variant}>{pill.label}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-atria-text-secondary">
                          {completedTasks}/{totalTasks}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/hr/candidates/${candidate._id}`}
                          className="flex items-center gap-1 text-sm font-medium text-atria-accent hover:text-atria-accent-hover"
                        >
                          Review <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
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
