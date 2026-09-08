import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { getStoredClerkOrgId, useTenant } from '@/app/useTenant'
import { AppLoader } from '@/shared/ui/AppLoader'
import type { PropsWithChildren } from 'react'

export function TrainingProductGuard({ children }: PropsWithChildren) {
  const { clerkOrgId, isLoading: tenantLoading } = useTenant()
  const effectiveClerkOrgId = clerkOrgId ?? getStoredClerkOrgId() ?? undefined
  const { isLoading: convexAuthLoading } = useConvexAuth()
  const hasTraining = useQuery(
    api.agencyConfig.hasProduct,
    effectiveClerkOrgId
      ? { clerkOrgId: effectiveClerkOrgId, productKey: 'training' }
      : 'skip',
  )

  if (
    !effectiveClerkOrgId ||
    tenantLoading ||
    convexAuthLoading ||
    hasTraining === undefined
  ) {
    return <AppLoader fullScreen label="Checking training access..." />
  }

  if (!hasTraining) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <h1 className="mb-2 text-xl font-bold text-atria-ink">
          Training not enabled
        </h1>
        <p className="max-w-md text-sm text-atria-text-secondary">
          Your agency has not subscribed to the Training module. Contact your
          administrator to enable it.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
