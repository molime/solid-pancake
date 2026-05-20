import {
  useAuth,
  useOrganization,
  useOrganizationList,
  useUser,
} from '@clerk/react'
import { useConvexAuth } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Building2, Plus, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'

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

  const [pendingOrg, setPendingOrg] = useState<PendingOrg | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const bootstrappingOrgIdRef = useRef<string | null>(null)

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
      .then(() => navigate('/', { replace: true }))
      .catch((err: unknown) => {
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

  const handleSelect = async (org: PendingOrg) => {
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
  }

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-atria-bg">
        <div className="text-sm text-atria-muted">Loading organizations…</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-atria-accent mb-3">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-atria-ink">Select Agency</h1>
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
          {userMemberships.data?.map((mem) => {
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
                        Role: {mem.role?.replace('org:', '') ?? 'member'}
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
          })}
        </div>

        <div className="flex justify-center">
          <Button
            variant="secondary"
            disabled={isBootstrapping}
            onClick={() => {
              window.location.href = '/create-agency'
            }}
          >
            <Plus className="h-4 w-4" />
            Create New Agency
          </Button>
        </div>
      </div>
    </div>
  )
}
