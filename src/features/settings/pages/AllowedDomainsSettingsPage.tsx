import { useOrganization } from '@clerk/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { Mail } from 'lucide-react'

export function AllowedDomainsSettingsPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const tenant = useQuery(
    api.tenants.get,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const setAllowedEmailDomains = useMutation(api.tenants.setAllowedEmailDomains)

  const [draft, setDraft] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!tenant) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-muted">Loading settings…</div>
      </div>
    )
  }

  const domainsValue =
    draft ?? (tenant.allowedEmailDomains ?? []).join(', ')

  const handleSave = async () => {
    if (!clerkOrgId) return
    setIsSaving(true)
    setError(null)
    setMessage(null)

    const domains = domainsValue
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter((domain) => domain.length > 0)

    try {
      await setAllowedEmailDomains({ clerkOrgId, domains })
      setDraft(null)
      setMessage(
        domains.length > 0
          ? 'Allowed email domains saved.'
          : 'Domain restriction cleared — all email domains are now allowed.',
      )
    } catch (err) {
      setError(err instanceof Error ? sanitizeConvexError(err.message) : 'Failed to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-atria-ink">Settings</h1>
        <p className="text-sm text-atria-muted">Allowed email domains</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-atria-accent" />
            Allowed email domains
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-atria-muted">
            Restrict invitations to specific email domains. When the list is
            empty, invitations to any email domain are allowed.
          </p>

          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              Domains (comma-separated)
            </label>
            <Input
              type="text"
              value={domainsValue}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="individualschoice.com, gmail.com"
              className="mt-1"
              data-testid="allowed-domains-input"
            />
            <p className="text-xs text-atria-muted mt-1">
              Example: individualschoice.com, gmail.com. Leave empty to allow
              all domains.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="save-allowed-domains-button"
          >
            {isSaving ? 'Saving…' : 'Save allowed domains'}
          </Button>

          {error && <p className="text-sm text-atria-danger" data-testid="allowed-domains-error">{error}</p>}
          {message && <p className="text-sm text-atria-success" data-testid="allowed-domains-message">{message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
