import { useOrganization, useUser } from '@clerk/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Building2, Mail, RefreshCw, UserPlus, X } from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'

const roleOptions = [
  { value: 'org:admin', label: 'Admin' },
  { value: 'org:coordinator', label: 'Coordinator' },
  { value: 'org:caregiver', label: 'Caregiver' },
] as const

type RoleValue = (typeof roleOptions)[number]['value']

/** Map ATRIA-X roles to Clerk's default organization roles.
 *  Clerk only knows `org:admin` and `org:member` out of the box.
 *  The real ATRIA-X role is stored in Convex `tenantMembers`.
 */
function toClerkRole(atriaRole: RoleValue): 'org:admin' | 'org:member' {
  return atriaRole === 'org:admin' ? 'org:admin' : 'org:member'
}

type ClerkInvitation = {
  id: string
  emailAddress: string
  role: string
  roleName: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  createdAt: Date
  revoke: () => Promise<unknown>
}

type CachedInvitation = {
  id: string
  emailAddress: string
  role: string
  status: string
  createdAt: string
}

function getCacheKey(orgId: string) {
  return `atria_pending_invites_${orgId}`
}

function readCachedInvitations(orgId: string): CachedInvitation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(getCacheKey(orgId))
    return raw ? (JSON.parse(raw) as CachedInvitation[]) : []
  } catch {
    return []
  }
}

function writeCachedInvitations(orgId: string, items: CachedInvitation[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getCacheKey(orgId), JSON.stringify(items))
  } catch {
    // ignore
  }
}

function addCachedInvitation(orgId: string, item: CachedInvitation) {
  const existing = readCachedInvitations(orgId)
  const updated = existing.filter((i) => i.id !== item.id)
  updated.push(item)
  writeCachedInvitations(orgId, updated)
}

function removeCachedInvitation(orgId: string, invitationId: string) {
  const existing = readCachedInvitations(orgId)
  const updated = existing.filter((i) => i.id !== invitationId)
  writeCachedInvitations(orgId, updated)
}

function fromCache(cached: CachedInvitation): ClerkInvitation {
  return {
    ...cached,
    createdAt: new Date(cached.createdAt),
    roleName: cached.role,
    status: cached.status as ClerkInvitation['status'],
    revoke: () => Promise.resolve(),
  }
}

function cacheClerkInvitations(orgId: string, invitations: ClerkInvitation[]) {
  writeCachedInvitations(
    orgId,
    invitations.map((invitation) => ({
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      role: invitation.role,
      status: invitation.status,
      createdAt:
        invitation.createdAt instanceof Date
          ? invitation.createdAt.toISOString()
          : new Date().toISOString(),
    })),
  )
}

export function TeamPage() {
  const { organization, isLoaded: orgLoaded } = useOrganization()
  const { user } = useUser()
  const clerkOrgId = organization?.id

  const members = useQuery(
    api.members.list,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const updateRole = useMutation(api.members.updateRole)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<RoleValue>('org:caregiver')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [roleUpdates, setRoleUpdates] = useState<Record<string, RoleValue>>({})
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null)
  const [roleSyncError, setRoleSyncError] = useState<string | null>(null)

  const [invitations, setInvitations] = useState<ClerkInvitation[]>(() => {
    if (!clerkOrgId) return []
    const cached = readCachedInvitations(clerkOrgId)
    return cached.map(fromCache)
  })
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false)
  const [isRevoking, setIsRevoking] = useState<string | null>(null)

  const loadInvitations = useCallback(
    async (attempt = 1): Promise<void> => {
      if (!organization || !orgLoaded || !clerkOrgId) return
      setIsLoadingInvitations(true)
      try {
        const result = (await organization.getInvitations({
          status: ['pending'],
          pageSize: 100,
        })) as {
          data: ClerkInvitation[]
        }
        const clerkData = result.data ?? []
        cacheClerkInvitations(clerkOrgId, clerkData)
        setInvitations(clerkData)
        setInviteError(null)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load invitations'
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500))
          return loadInvitations(attempt + 1)
        }
        // On total failure, keep cached invitations so they don't disappear
        setInviteError(message)
      } finally {
        setIsLoadingInvitations(false)
      }
    },
    [organization, orgLoaded, clerkOrgId],
  )

  useEffect(() => {
    if (!organization || !orgLoaded || !clerkOrgId) return
    let cancelled = false

    const load = async () => {
      try {
        setIsLoadingInvitations(true)
        const result = (await organization.getInvitations({
          status: ['pending'],
          pageSize: 100,
        })) as {
          data: ClerkInvitation[]
        }
        const clerkData = result.data ?? []
        cacheClerkInvitations(clerkOrgId, clerkData)
        if (!cancelled) {
          setInvitations(clerkData)
          setInviteError(null)
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load invitations'
          setInviteError(message)
        }
      } finally {
        if (!cancelled) setIsLoadingInvitations(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [organization, organization?.id, orgLoaded, clerkOrgId])

  const handleInvite = useCallback(async () => {
    if (!organization || !inviteEmail.trim() || !clerkOrgId) return
    setIsInviting(true)
    setInviteError(null)
    setInviteSuccess(null)

    try {
      const invitation = (await organization.inviteMember({
        emailAddress: inviteEmail.trim(),
        role: 'org:member',
      })) as ClerkInvitation

      // Cache the invitation locally so it survives navigation
      addCachedInvitation(clerkOrgId, {
        id: invitation.id,
        emailAddress: invitation.emailAddress,
        role: invitation.role,
        status: invitation.status,
        createdAt:
          invitation.createdAt instanceof Date
            ? invitation.createdAt.toISOString()
            : new Date().toISOString(),
      })

      // Merge into current state immediately
      setInvitations((prev) => {
        const existing = prev.filter((i) => i.id !== invitation.id)
        return [...existing, invitation]
      })

      if (invitation.status === 'accepted') {
        setInviteSuccess(`${inviteEmail.trim()} joined the organization.`)
      } else if (invitation.status === 'pending') {
        setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`)
      } else {
        setInviteSuccess(`Invitation status: ${invitation.status}`)
      }
      setInviteEmail('')
      await loadInvitations()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setIsInviting(false)
    }
  }, [organization, inviteEmail, clerkOrgId, loadInvitations])

  const handleRevoke = useCallback(
    async (invitation: ClerkInvitation) => {
      setIsRevoking(invitation.id)
      try {
        // Cached-only invitations have a no-op revoke; just remove from cache
        const isCachedOnly =
          typeof invitation.revoke !== 'function' ||
          invitation.revoke.toString() === '() => Promise.resolve()'
        if (isCachedOnly) {
          if (clerkOrgId) removeCachedInvitation(clerkOrgId, invitation.id)
          setInvitations((prev) => prev.filter((i) => i.id !== invitation.id))
        } else {
          await invitation.revoke()
          if (clerkOrgId) removeCachedInvitation(clerkOrgId, invitation.id)
          await loadInvitations()
        }
      } catch (err) {
        setInviteError(
          err instanceof Error ? err.message : 'Failed to revoke invitation',
        )
      } finally {
        setIsRevoking(null)
      }
    },
    [loadInvitations, clerkOrgId],
  )

  async function syncConvexRole(
    clerkUserId: string,
    newRole: RoleValue,
    attempt = 1,
  ): Promise<void> {
    if (!clerkOrgId) return
    try {
      await updateRole({ clerkOrgId, clerkUserId, role: newRole })
      setRoleSyncError(null)
    } catch (err) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500))
        return syncConvexRole(clerkUserId, newRole, attempt + 1)
      }
      throw err
    }
  }

  const handleRoleChange = useCallback(
    async (clerkUserId: string, newRole: RoleValue) => {
      if (!clerkOrgId || clerkUserId === user?.id) return
      setIsUpdatingRole(clerkUserId)
      setRoleSyncError(null)
      setRoleUpdates((prev) => ({ ...prev, [clerkUserId]: newRole }))

      try {
        await organization?.updateMember({
          userId: clerkUserId,
          role: toClerkRole(newRole),
        })
        await syncConvexRole(clerkUserId, newRole)
      } catch (err) {
        setRoleUpdates((prev) => {
          const next = { ...prev }
          delete next[clerkUserId]
          return next
        })
        const message =
          err instanceof Error ? err.message : 'Role update failed'
        setRoleSyncError(message)
      } finally {
        setIsUpdatingRole(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clerkOrgId, user?.id, organization],
  )

  if (!members) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-muted">Loading team…</div>
      </div>
    )
  }

  const isAdmin =
    members.find((m) => m.clerkUserId === user?.id)?.role === 'org:admin'

  const memberEmails = new Set(
    members.map((member) => member.email.trim().toLowerCase()).filter(Boolean),
  )
  const pendingInvitations = invitations.filter(
    (i) =>
      i.status === 'pending' &&
      !memberEmails.has(i.emailAddress.trim().toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-atria-ink">Team</h1>
        <p className="text-sm text-atria-muted">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-atria-accent" />
              Invite Member
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                  Email
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-atria-muted" />
                  <Input
                    type="email"
                    placeholder="colleague@agency.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="sm:w-40">
                <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                  Role
                </label>
                <Select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as RoleValue)}
                  className="mt-1"
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="primary"
                  onClick={handleInvite}
                  disabled={isInviting || !inviteEmail.trim()}
                >
                  {isInviting ? 'Sending…' : 'Send invite'}
                </Button>
              </div>
            </div>
            {inviteError && (
              <p className="text-sm text-atria-danger">{inviteError}</p>
            )}
            {inviteSuccess && (
              <p className="text-sm text-atria-success">{inviteSuccess}</p>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending Invitations</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadInvitations()}
                disabled={isLoadingInvitations}
                className="text-atria-muted hover:text-atria-ink"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoadingInvitations ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {pendingInvitations.length === 0 ? (
              <div className="px-4 py-6 text-sm text-atria-muted">
                {isLoadingInvitations
                  ? 'Loading pending invitations...'
                  : 'No pending invitations.'}
              </div>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Email</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader className="w-24">Action</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingInvitations.map((invitation) => {
                    const isCachedOnly =
                      typeof invitation.revoke !== 'function' ||
                      invitation.revoke.toString() === '() => Promise.resolve()'
                    return (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.emailAddress}</TableCell>
                        <TableCell>
                          <Badge variant="warning">Pending</Badge>
                          {isCachedOnly && (
                            <span className="ml-2 text-[10px] text-atria-muted">
                              (cached)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isRevoking === invitation.id}
                            onClick={() => handleRevoke(invitation)}
                            className="text-atria-danger hover:text-atria-danger/80"
                          >
                            <X className="h-4 w-4" />
                            {isRevoking === invitation.id
                              ? '...'
                              : isCachedOnly
                                ? 'Remove'
                                : 'Revoke'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {roleSyncError && (
        <div className="rounded-md bg-atria-danger-bg border border-atria-danger/20 px-4 py-3">
          <p className="text-sm text-atria-danger font-medium">
            Role sync failed: {roleSyncError}
          </p>
          <p className="text-xs text-atria-danger mt-1">
            The Clerk role was updated, but the local database could not be
            synced. Please refresh the page and try again.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Agency Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-atria-border/50 mb-3">
                <Building2 className="h-6 w-6 text-atria-muted" />
              </div>
              <p className="text-sm font-medium text-atria-ink">
                No members yet
              </p>
              <p className="text-xs text-atria-muted mt-1 max-w-xs">
                Team members will appear here after they join the agency.
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Name</TableHeader>
                  <TableHeader>Email</TableHeader>
                  <TableHeader>Role</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((member) => {
                  const isSelf = member.clerkUserId === user?.id
                  const currentRole =
                    roleUpdates[member.clerkUserId] ?? member.role

                  return (
                    <TableRow key={member._id}>
                      <TableCell className="font-medium">
                        {member.displayName}
                        {isSelf && (
                          <span className="ml-2 text-xs text-atria-muted">
                            (you)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        {isAdmin && !isSelf ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={currentRole}
                              onChange={(e) =>
                                handleRoleChange(
                                  member.clerkUserId,
                                  e.target.value as RoleValue,
                                )
                              }
                              disabled={isUpdatingRole === member.clerkUserId}
                              className="w-32"
                            >
                              {roleOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </Select>
                            {isUpdatingRole === member.clerkUserId && (
                              <span className="text-xs text-atria-muted">
                                Saving…
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge
                            variant={
                              member.role === 'org:admin'
                                ? 'accent'
                                : member.role === 'org:coordinator'
                                  ? 'info'
                                  : 'success'
                            }
                          >
                            {member.role.replace('org:', '')}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
