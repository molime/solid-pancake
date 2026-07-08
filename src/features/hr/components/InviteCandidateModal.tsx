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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bypass, setBypass] = useState<{
    manualPassword: string
    magicLink: string
  } | null>(null)

  const reset = () => {
    setDisplayName('')
    setEmail('')
    setPhone('')
    setError(null)
    setBypass(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!clerkOrgId) return
    const trimmedName = displayName.trim()
    const trimmedEmail = email.trim()
    if (!trimmedName || !trimmedEmail) return

    setSubmitting(true)
    setError(null)
    setBypass(null)

    try {
      const result = await inviteCandidate({
        clerkOrgId,
        displayName: trimmedName,
        email: trimmedEmail,
        phone: phone.trim() || undefined,
        devBypassEnabled: import.meta.env.DEV,
      })

      if (result.manualPassword && result.magicLink) {
        setBypass({
          manualPassword: result.manualPassword,
          magicLink: result.magicLink,
        })
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
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader>
        <DialogTitle>Invite candidate</DialogTitle>
      </DialogHeader>
      <DialogContent className="space-y-4">
        {error && <p className="text-sm text-atria-danger">{error}</p>}
        {bypass && (
          <div
            data-testid="dev-bypass-card"
            className="rounded-md border border-atria-border bg-atria-surface p-3 text-sm"
          >
            <p className="mb-2 font-medium text-atria-ink">
              Dev bypass: candidate account created
            </p>
            <p className="mb-1 text-atria-text-secondary">
              <span className="font-medium">Password:</span>{' '}
              <code className="rounded bg-atria-surface-2 px-1 py-0.5">{bypass.manualPassword}</code>
            </p>
            <a
              href={bypass.magicLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-atria-accent hover:text-atria-accent-hover"
            >
              Open magic link
            </a>
            <p className="mt-2 text-xs text-atria-text-secondary">
              The magic link expires in 10 minutes. Do not share these credentials outside of local
              development.
            </p>
          </div>
        )}
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
      </DialogContent>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          data-testid="send-invitation-button"
          disabled={
            submitting || !displayName.trim() || !email.trim() || bypass !== null
          }
          onClick={handleSubmit}
        >
          {submitting ? 'Sending…' : 'Send invitation'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
