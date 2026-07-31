import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Badge } from '@/shared/ui/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { ArrowLeft, User, FileText, ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Id } from '../../../../convex/_generated/dataModel'
import { adpStatusPill } from '../lib/adpStatus'
import { CaseDetailModal } from '../components/CaseDetailModal'
import { caseStatusVariant } from '../lib/caseStatus'
import { cn } from '@/shared/lib/cn'
import { formatDateUS } from '@/shared/format'

const TABS = [
  { value: 'profile', label: 'Profile', icon: User },
  { value: 'documents', label: 'Documents', icon: FileText },
  { value: 'cases', label: 'Cases', icon: ClipboardCheck },
] as const

type TabValue = (typeof TABS)[number]['value']

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function ApplicationField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
        {label}
      </p>
      <p className="mt-1 text-base text-atria-ink">{value || '—'}</p>
    </div>
  )
}

function ProfileTab({
  member,
  profile,
}: {
  member: { displayName: string; email: string; role: string; createdAt?: string }
  profile: { phone?: string | null; adpSyncStatus: string } | null
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <ApplicationField label="EMAIL" value={member.email} />
      <ApplicationField label="PHONE" value={profile?.phone || ''} />
      <ApplicationField label="ROLE" value={member.role.replace('org:', '')} />
      <ApplicationField
        label="START DATE"
        value={member.createdAt ? formatDateUS(member.createdAt) : ''}
      />
      <ApplicationField label="EMPLOYMENT TYPE" value="Caregiver" />
      <ApplicationField label="PAY RATE" value="—" />
    </div>
  )
}

function DocumentsTab({
  clerkUserId,
  clerkOrgId,
}: {
  clerkUserId: string
  clerkOrgId: string
}) {
  const documents = useQuery(
    api.documentArchive.listDocumentArchive,
    clerkOrgId
      ? {
          clerkOrgId,
          linkedTo: { subjectType: 'employee', subjectId: clerkUserId },
        }
      : 'skip',
  )

  if (!documents || documents.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title="No documents"
        description="No archived documents for this employee yet."
      />
    )
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>CATEGORY</TableHeader>
          <TableHeader>STATUS</TableHeader>
          <TableHeader>EXPIRES</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc._id}>
            <TableCell className="font-medium">{doc.category}</TableCell>
            <TableCell>
              <StatusBadge
                variant={
                  doc.status === 'active' || doc.status === 'verified'
                    ? 'success'
                    : doc.status === 'rejected'
                      ? 'danger'
                      : 'warning'
                }
              >
                {doc.status}
              </StatusBadge>
            </TableCell>
            <TableCell>{doc.expiresAt ? formatDateUS(doc.expiresAt) : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function CasesTab({
  clerkUserId,
  clerkOrgId,
}: {
  clerkUserId: string
  clerkOrgId: string
}) {
  const cases = useQuery(
    api.hrCases.listHrCasesForSubject,
    clerkOrgId
      ? { clerkOrgId, subjectType: 'employee', subjectId: clerkUserId }
      : 'skip',
  )
  const [selectedCaseId, setSelectedCaseId] = useState<Id<'hrCases'> | null>(
    null,
  )

  if (!cases || cases.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="h-6 w-6" />}
        title="No cases"
        description="No HR cases have been opened for this employee."
      />
    )
  }

  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>CASE ID</TableHeader>
            <TableHeader>TITLE</TableHeader>
            <TableHeader>CATEGORY</TableHeader>
            <TableHeader>STATUS</TableHeader>
            <TableHeader>DESCRIPTION</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {cases.map((c) => (
            <TableRow
              key={c._id}
              className="cursor-pointer"
              onClick={() => setSelectedCaseId(c._id)}
            >
              <TableCell className="font-medium">
                {c.caseNumber ?? '—'}
              </TableCell>
              <TableCell className="font-medium">{c.title}</TableCell>
              <TableCell className="text-atria-text-secondary">
                {c.category}
              </TableCell>
              <TableCell>
                <StatusBadge variant={caseStatusVariant(c.status)}>
                  {c.status}
                </StatusBadge>
              </TableCell>
              <TableCell>{c.description || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CaseDetailModal
        caseId={selectedCaseId}
        clerkOrgId={clerkOrgId}
        onClose={() => setSelectedCaseId(null)}
      />
    </>
  )
}

export function EmployeeProfilePage() {
  const { memberId } = useParams<{ memberId: string }>()
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const detail = useQuery(
    api.employeeProfiles.getEmployeeProfileDetail,
    clerkOrgId && memberId
      ? { clerkOrgId, memberId: memberId as Id<'tenantMembers'> }
      : 'skip',
  )

  const [activeTab, setActiveTab] = useState<TabValue>('profile')

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-text-secondary">Loading profile…</div>
      </div>
    )
  }

  const { member, profile } = detail
  const pill = adpStatusPill(profile?.adpSyncStatus ?? 'pending_credentials')

  return (
    <div className="space-y-6">
      <Link
        to="/hr/employees"
        className="inline-flex items-center gap-1 text-sm font-medium text-atria-accent hover:text-atria-accent-hover"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Employees
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-atria-accent text-xl font-bold text-atria-on-accent">
              {initials(member.displayName)}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-atria-ink">
                  {member.displayName}
                </h1>
                <Badge variant="success">Active</Badge>
                <StatusBadge variant={pill.variant}>{pill.label}</StatusBadge>
              </div>
              <p className="mt-1 text-base text-atria-text-secondary">
                {member.role.replace('org:', '')} · Started{' '}
                {profile?.createdAt
                  ? formatDateUS(profile.createdAt)
                  : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'bg-atria-accent text-atria-on-accent'
                  : 'border border-atria-border bg-atria-surface text-atria-ink hover:bg-atria-surface-2',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {TABS.find((t) => t.value === activeTab)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {activeTab === 'profile' && (
            <ProfileTab
              member={{
                displayName: member.displayName,
                email: member.email,
                role: member.role,
                createdAt: profile?.createdAt,
              }}
              profile={profile}
            />
          )}
          {activeTab === 'documents' && profile?.clerkUserId && clerkOrgId && (
            <DocumentsTab clerkUserId={profile.clerkUserId} clerkOrgId={clerkOrgId} />
          )}
          {activeTab === 'cases' && profile?.clerkUserId && clerkOrgId && (
            <CasesTab clerkUserId={profile.clerkUserId} clerkOrgId={clerkOrgId} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
