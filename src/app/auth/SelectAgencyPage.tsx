import {
  useAuth,
  useOrganization,
  useOrganizationList,
  useUser,
  useClerk,
} from '@clerk/react'
import { useConvexAuth } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { AppLoader } from '@/shared/ui/AppLoader'
import { setSelectedClerkOrgId } from '@/app/useTenant'
import { roleHomePath } from '@/app/roleHomePath'

type PendingOrg = {
  id: string
  name: string
  slug: string | null
}

export function SelectAgencyPage() {
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  })
  const { organization } = useOrganization()
  const { orgId } = useAuth()
  const { user } = useUser()
  const convexAuth = useConvexAuth()
  const navigate = useNavigate()
  const ensureAgency = useMutation(api.tenants.ensureSelectedAgency)
  const { signOut } = useClerk()

  const [pendingOrg, setPendingOrg] = useState<PendingOrg | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const bootstrappingOrgIdRef = useRef<string | null>(null)

  // Caregivers/candidates are NOT Clerk org members (Clerk Standard plan
  // 20-member limit). When the user has zero Clerk org memberships, resolve
  // their tenants from the tenantMembers table and send them into the app.
  const hasNoClerkMemberships =
    isLoaded && (userMemberships.data ?? []).length === 0
  const dbTenants = useQuery(
    api.candidates.getMyTenant,
    hasNoClerkMemberships && convexAuth.isAuthenticated ? {} : 'skip',
  )

  // Exactly one tenant: pick it and go straight in. Multiple tenants fall
  // through to the picker below so the user can choose their agency.
  // Navigate to the role-appropriate home (not '/') so the route guards
  // don't re-evaluate and risk a redirect loop back to /select-agency.
  useEffect(() => {
    if (!hasNoClerkMemberships || !dbTenants || dbTenants.length !== 1) return
    setSelectedClerkOrgId(dbTenants[0].clerkOrgId)
    navigate(roleHomePath(dbTenants[0].role), { replace: true })
  }, [hasNoClerkMemberships, dbTenants, navigate])

  const handleDbTenantSelect = useCallback(
    (clerkOrgId: string, role: string) => {
      setSelectedClerkOrgId(clerkOrgId)
      navigate(roleHomePath(role), { replace: true })
    },
    [navigate],
  )

  const handleSelect = useCallback(
    async (org: PendingOrg) => {
      setError(null)
      setIsBootstrapping(true)
      try {
        await setActive?.({ organization: org.id })
        setPendingOrg(org)
      } catch (err: unknown) {
        bootstrappingOrgIdRef.current = null
        setIsBootstrapping(false)
        setPendingOrg(null)
        setError(
          err instanceof Error ? err.message : 'Failed to switch organization.',
        )
      }
    },
    [setActive],
  )

  // Detect permanent auth failure (not loading and not authenticated).
  useEffect(() => {
    if (!pendingOrg) return
    if (convexAuth.isLoading) return
    if (convexAuth.isAuthenticated) return

    const timer = setTimeout(() => {
      bootstrappingOrgIdRef.current = null
      setIsBootstrapping(false)
      setPendingOrg(null)
      setError(
        'Authentication failed. Please check your Clerk + Convex configuration.',
      )
    }, 0)
    return () => clearTimeout(timer)
  }, [pendingOrg, convexAuth.isLoading, convexAuth.isAuthenticated])

  // Auto-select the only membership so users aren't forced to click.
  // This fires immediately when there's exactly 1 membership, regardless of
  // Convex auth loading state. The bootstrap effect handles the Convex auth wait.
  useEffect(() => {
    if (!isLoaded || isBootstrapping || pendingOrg) return
    const memberships = userMemberships.data ?? []
    if (memberships.length !== 1) return
    const mem = memberships[0]
    const orgData = {
      id: mem.organization.id,
      name: mem.organization.name,
      slug: mem.organization.slug ?? null,
    }
    // If the user already has an active org matching the membership, skip setActive
    // and go straight to bootstrap by setting pendingOrg directly.
    if (organization && organization.id === orgData.id && orgId === orgData.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingOrg(orgData)
      return
    }
    if (organization || orgId) return
    void handleSelect(orgData)
  }, [
    isLoaded,
    isBootstrapping,
    pendingOrg,
    userMemberships.data,
    handleSelect,
    organization,
    orgId,
  ])

  const isTokenError = (err: unknown): boolean => {
    const message = err instanceof Error ? err.message : ''
    return (
      message.includes('missing from token') ||
      message.includes('does not match the requested agency')
    )
  }

  // Bootstrap once org and Convex auth are both ready.
  useEffect(() => {
    if (!pendingOrg || !user) return
    if (!organization || organization.id !== pendingOrg.id) return
    if (orgId !== pendingOrg.id) return
    if (!convexAuth.isAuthenticated) return
    if (convexAuth.isLoading) return
    if (bootstrappingOrgIdRef.current === pendingOrg.id) return

    const targetOrgId = pendingOrg.id
    bootstrappingOrgIdRef.current = targetOrgId
    setError(null)

    // Timeout fallback: if bootstrap takes >10s, navigate to / anyway
    const timeoutId = setTimeout(() => {
      navigate('/', { replace: true })
    }, 10000)

    const callEnsureAgency = async () => {
      try {
        return await ensureAgency({
          clerkOrgId: targetOrgId,
          name: pendingOrg.name,
          slug: pendingOrg.slug ?? targetOrgId,
          displayName: user.fullName ?? 'User',
          email: user.primaryEmailAddress?.emailAddress ?? '',
        })
      } catch (err) {
        // Defensive retry for transient token sync delays.
        if (isTokenError(err)) {
          await new Promise((r) => setTimeout(r, 400))
          return await ensureAgency({
            clerkOrgId: targetOrgId,
            name: pendingOrg.name,
            slug: pendingOrg.slug ?? targetOrgId,
            displayName: user.fullName ?? 'User',
            email: user.primaryEmailAddress?.emailAddress ?? '',
          })
        }
        throw err
      }
    }

    callEnsureAgency()
      .then(() => {
        clearTimeout(timeoutId)
        navigate('/', { replace: true })
      })
      .catch((err: unknown) => {
        clearTimeout(timeoutId)
        bootstrappingOrgIdRef.current = null
        setIsBootstrapping(false)
        setPendingOrg(null)
        const message = err instanceof Error ? err.message : ''
        if (message.includes('missing from token')) {
          setError(
            'Agency could not be opened because the Convex JWT is missing active organization claims. Check the Clerk convex JWT template and Convex auth config.',
          )
        } else {
          setError(message || 'Unable to open agency.')
        }
      })
  }, [
    pendingOrg,
    user,
    organization,
    orgId,
    convexAuth.isAuthenticated,
    convexAuth.isLoading,
    ensureAgency,
    navigate,
  ])

  if (!isLoaded || userMemberships.data === undefined) {
    return <AppLoader fullScreen label="Finding your agencies" />
  }

  // No Clerk org memberships: wait for the tenantMembers resolution. A
  // single resolved tenant triggers the redirect effect above; multiple
  // tenants render the picker below; only an empty result (no member record
  // at all) falls through to the empty state.
  if (hasNoClerkMemberships && (dbTenants === undefined || dbTenants.length === 1)) {
    return <AppLoader fullScreen label="Opening your agency workspace" />
  }

  const memberships = userMemberships.data ?? []

  // Universal rule: if the user has exactly 1 org membership, always auto-select
  // and never show the selector UI. Only show the selector for 0 or 2+ memberships.
  if (memberships.length === 1 && !error) {
    return <AppLoader fullScreen label="Opening your agency workspace" />
  }

  if (isBootstrapping) {
    return <AppLoader fullScreen label="Opening your agency workspace" />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-atria-accent mb-3">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-atria-ink">
            Select Agency
          </h1>
          <p className="text-sm text-atria-muted mt-1">
            Choose an agency organization to access ATRIA-X operations.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-md bg-atria-danger-bg p-3 text-atria-danger">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          {userMemberships.data?.length === 0 ? (
            dbTenants && dbTenants.length > 0 ? (
              dbTenants.map((tenant) => (
                <Card
                  key={tenant.clerkOrgId}
                  className="transition-colors cursor-pointer hover:border-atria-accent"
                >
                  <CardContent className="p-4">
                    <button
                      className="w-full flex items-center justify-between text-left"
                      onClick={() =>
                        handleDbTenantSelect(tenant.clerkOrgId, tenant.role)
                      }
                    >
                      <div>
                        <p className="text-sm font-medium text-atria-ink">
                          {tenant.tenantName}
                        </p>
                        <p className="text-xs text-atria-muted mt-0.5">
                          Role: {tenant.role.replace('org:', '')}
                        </p>
                      </div>
                      <Building2 className="h-4 w-4 text-atria-muted" />
                    </button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-center space-y-4">
                  <AlertCircle className="h-6 w-6 text-atria-danger mx-auto" />
                  <p className="text-sm text-atria-ink">
                    You don't belong to any agency yet.
                  </p>
                  <p className="text-xs text-atria-muted">
                    Ask your HR team to invite you, or sign out and try a different account.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void signOut?.()}
                  >
                    Sign out
                  </Button>
                </CardContent>
              </Card>
            )
          ) : (
            userMemberships.data?.map((mem: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const isLoading = pendingOrg?.id === mem.organization.id
              return (
                <Card
                  key={mem.organization.id}
                  className={`transition-colors ${
                    isLoading
                      ? 'opacity-60 cursor-wait'
                      : 'cursor-pointer hover:border-atria-accent'
                  }`}
                >
                  <CardContent className="p-4">
                    <button
                      className="w-full flex items-center justify-between text-left disabled:cursor-wait"
                      disabled={isBootstrapping}
                      onClick={() =>
                        handleSelect({
                          id: mem.organization.id,
                          name: mem.organization.name,
                          slug: mem.organization.slug ?? null,
                        })
                      }
                    >
                      <div>
                        <p className="text-sm font-medium text-atria-ink">
                          {mem.organization.name}
                        </p>
                        <p className="text-xs text-atria-muted mt-0.5">
                          Role:{' '}
                          {(mem.publicMetadata as { atriaRole?: string } | undefined)
                            ?.atriaRole?.replace('org:', '') ??
                            mem.role?.replace('org:', '') ??
                            'member'}
                        </p>
                      </div>
                      {isLoading ? (
                        <Badge variant="default">Opening…</Badge>
                      ) : (
                        <Building2 className="h-4 w-4 text-atria-muted" />
                      )}
                    </button>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>


      </div>
    </div>
  )
}
