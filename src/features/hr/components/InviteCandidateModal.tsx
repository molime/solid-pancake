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

  const reset = () => {
    setDisplayName('')
    setEmail('')
    setPhone('')
    setError(null)
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

    try {
      await inviteCandidate({
        clerkOrgId,
        displayName: trimmedName,
        email: trimmedEmail,
        phone: phone.trim() || undefined,
      })
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
        <FieldGroup label="Full name" required htmlFor="candidate-name">
          <Input
            id="candidate-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Sofia Herrera"
          />
        </FieldGroup>
        <FieldGroup label="Email" required htmlFor="candidate-email">
          <Input
            id="candidate-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sofia@example.com"
          />
        </FieldGroup>
        <FieldGroup label="Phone" htmlFor="candidate-phone">
          <Input
            id="candidate-phone"
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
          disabled={
            submitting || !displayName.trim() || !email.trim()
          }
          onClick={handleSubmit}
        >
          {submitting ? 'Sending…' : 'Send invitation'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
