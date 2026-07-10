import { useState } from 'react'
import { useOrganization } from '@clerk/react'
import { useAction } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { FieldGroup } from '@/shared/ui/FieldGroup'

export function InviteCandidateModal({
  open,
  onClose,
  onInvited,
}: {
  open: boolean
  onClose: () => void
  onInvited?: () => void
}) {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const inviteCandidate = useAction(api.candidates.inviteCandidate)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [manualSetup, setManualSetup] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualResult, setManualResult] = useState<{
    magicLink: string
    initialPassword?: string
  } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedPassword, setCopiedPassword] = useState(false)

  const reset = () => {
    setDisplayName('')
    setEmail('')
    setPhone('')
    setManualSetup(false)
    setError(null)
    setManualResult(null)
    setCopiedLink(false)
    setCopiedPassword(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const copyMagicLink = async () => {
    if (!manualResult?.magicLink) return
    try {
      await navigator.clipboard.writeText(manualResult.magicLink)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      setCopiedLink(false)
    }
  }

  const copyInitialPassword = async () => {
    if (!manualResult?.initialPassword) return
    try {
      await navigator.clipboard.writeText(manualResult.initialPassword)
      setCopiedPassword(true)
      setTimeout(() => setCopiedPassword(false), 2000)
    } catch {
      setCopiedPassword(false)
    }
  }

  const handleSubmit = async () => {
    if (!clerkOrgId) return
    const trimmedName = displayName.trim()
    const trimmedEmail = email.trim()
    if (!trimmedName || !trimmedEmail) return

    setSubmitting(true)
    setError(null)
    setManualResult(null)
    setCopiedLink(false)

    try {
      const result = await inviteCandidate({
        clerkOrgId,
        displayName: trimmedName,
        email: trimmedEmail,
        phone: phone.trim() || undefined,
        manualSetup,
      })

      if (result.magicLink) {
        setManualResult({ magicLink: result.magicLink, initialPassword: result.initialPassword })
        onInvited?.()
        return
      }

      reset()
      onInvited?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invitation failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={manualResult ? () => {} : handleClose}>
      <DialogHeader>
        <DialogTitle>{manualResult ? 'Manual account setup' : 'Invite candidate'}</DialogTitle>
      </DialogHeader>
      <DialogContent className="space-y-4">
        {error && <p className="text-sm text-atria-danger">{error}</p>}
        {manualResult && (
          <div
            data-testid="manual-setup-card"
            className="rounded-md border border-atria-border bg-atria-surface p-3 text-sm"
          >
            <p className="mb-2 font-medium text-atria-ink">
              Candidate account created — share this sign-in link
            </p>
            <div className="mb-2 flex items-center gap-2">
              <input
                readOnly
                value={manualResult.magicLink}
                className="flex-1 rounded border border-atria-border bg-atria-surface-2 px-2 py-1 text-xs text-atria-ink"
              />
              <Button variant='secondary' size='sm' onClick={copyMagicLink}>
                {copiedLink ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <a
              href={manualResult.magicLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-atria-accent hover:text-atria-accent-hover"
            >
              Open sign-in link
            </a>
            {manualResult.initialPassword && (
              <div className="mt-3 space-y-2">
                <p className="font-medium text-atria-ink">Initial password</p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={manualResult.initialPassword}
                    className="flex-1 rounded border border-atria-border bg-atria-surface-2 px-2 py-1 text-xs text-atria-ink"
                  />
                  <Button variant='secondary' size='sm' onClick={copyInitialPassword}>
                    {copiedPassword ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <p className="text-xs text-atria-text-secondary">
                  The candidate will also receive a password-reset email from Clerk.
                </p>
              </div>
            )}

            <p className="mt-2 text-xs text-atria-text-secondary">
              The link is valid for 7 days. After signing in, the candidate must set a password.
            </p>
          </div>
        )}
        {!manualResult && (
          <>
            <FieldGroup label="Full name" required htmlFor="candidate-name">
              <Input
                id="candidate-name"
                data-testid="candidate-name-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sofia Herrera"
              />
            </FieldGroup>
            <FieldGroup label="Email" required htmlFor="candidate-email">
              <Input
                id="candidate-email"
                data-testid="candidate-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sofia@example.com"
              />
            </FieldGroup>
            <FieldGroup label="Phone" htmlFor="candidate-phone">
              <Input
                id="candidate-phone"
                data-testid="candidate-phone-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </FieldGroup>
            <label className="flex items-center gap-2 text-sm text-atria-ink">
              <input
                type="checkbox"
                checked={manualSetup}
                onChange={(e) => setManualSetup(e.target.checked)}
                className="h-4 w-4"
              />
              Create account manually and share sign-in link with candidate
            </label>
          </>
        )}
      </DialogContent>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={manualResult ? handleClose : handleClose}>
          {manualResult ? 'Close' : 'Cancel'}
        </Button>
        {!manualResult && (
          <Button
            variant="primary"
            size="sm"
            data-testid="send-invitation-button"
            disabled={submitting || !displayName.trim() || !email.trim()}
            onClick={handleSubmit}
          >
            {submitting ? 'Sending…' : manualSetup ? 'Create account' : 'Send invitation'}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  )
}
