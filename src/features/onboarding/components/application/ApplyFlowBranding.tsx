import { useQuery } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { useTenant } from '@/app/useTenant'
import { resolveAgencyLogo } from '@/app/shell/agencyLogo'

interface ApplyFlowBrandingProps {
  /** Tenant display name (falls back to employer legal name for matching). */
  name?: string | undefined
  /** Employer legal name from tenant settings — the Golden Ages trigger. */
  legalName?: string | null
}

/**
 * Footer branding for the public apply flow: the resolved agency logo (when
 * the agency is a known one) directly above the "Powered by ATRIA-X" line.
 * Replaces the previously hardcoded Individuals Choice logo on every apply
 * page; unknown agencies render no logo instead of the wrong agency's.
 */
export function ApplyFlowBranding({ name, legalName }: ApplyFlowBrandingProps) {
  const logo = resolveAgencyLogo(name, legalName)
  return (
    <div className='mt-6 flex flex-col items-center gap-2'>
      {logo && (
        <img
          src={logo}
          alt='Agency logo'
          className='h-10 w-auto object-contain opacity-70'
        />
      )}
      <p className='text-xs text-atria-text-muted'>Powered by ATRIA-X Digital Solutions</p>
    </div>
  )
}

/**
 * Signed-in variant for the post-application pages: resolves the agency
 * identity from the current tenant plus its employer legal name, so the
 * Golden Ages tenant matches even when its display name differs.
 */
export function SignedInApplyFlowBranding() {
  const { clerkOrgId, tenantName } = useTenant()
  const employerInfo = useQuery(
    api.tenantSettings.getEmployerInfo,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  return <ApplyFlowBranding name={tenantName} legalName={employerInfo?.legalName} />
}
