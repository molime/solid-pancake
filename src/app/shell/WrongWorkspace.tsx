import { useClerk } from '@clerk/react'
import { AlertCircle, Building2 } from 'lucide-react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { clearSessionData } from '@/shared/lib/clearSession'
import { APEX_DOMAIN } from '@/app/useTenant'
import type { TenantMismatch } from '@/app/useTenant'

/**
 * Full-screen notice shown when the signed-in user opens an agency workspace
 * subdomain (`<agency>.atriaxsolutions.com`) they are not a member of. The
 * alternative — silently serving one of their other agencies under this URL —
 * looks exactly like "my data disappeared", so we block with clear next
 * steps instead.
 */
export function WrongWorkspace({ subdomain, agencyName }: TenantMismatch) {
  const { signOut } = useClerk()

  const workspaceLabel = agencyName ?? `"${subdomain}"`

  const goToMyWorkspace = () => {
    // The apex host never pins a tenant, so the agency picker works there
    // regardless of which agency this subdomain belongs to.
    window.location.assign(
      `${window.location.protocol}//${APEX_DOMAIN}/select-agency`,
    )
  }

  const handleSignOut = () => {
    clearSessionData()
    void signOut?.()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-atria-danger mt-0.5 shrink-0" />
            <div>
              <h1 className="text-lg font-semibold text-atria-ink">
                This workspace belongs to {workspaceLabel}
              </h1>
              <p className="mt-1 text-sm text-atria-text-secondary">
                Your account doesn't have access to this agency, so its data
                can't be shown here. Nothing was deleted — you're simply
                looking at a workspace that isn't yours.
              </p>
              <p className="mt-2 text-sm text-atria-text-secondary">
                If you work with {workspaceLabel}, ask their admin to invite
                you. Otherwise, go back to your own workspace.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={goToMyWorkspace}>
              <Building2 className="h-4 w-4" />
              Go to my workspace
            </Button>
            <Button variant="secondary" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
