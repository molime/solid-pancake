import { useTenant } from '@/app/useTenant'
import { resolveAgencyLogo } from '@/app/shell/agencyLogo'

export function AgencyBranding() {
  const { tenantName } = useTenant()
  const agencyLogo = resolveAgencyLogo(tenantName)

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      {agencyLogo && (
        <img
          src={agencyLogo}
          alt="Agency logo"
          className="h-10 w-auto object-contain opacity-70"
        />
      )}
      <p className="text-xs text-atria-text-muted">Powered by ATRIA-X Digital Solutions</p>
    </div>
  )
}
