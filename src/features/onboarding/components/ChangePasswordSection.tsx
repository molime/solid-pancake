import { useState } from 'react'
import { useTenant } from '@/app/useTenant'
import { useAction } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { FieldGroup } from '@/shared/ui/FieldGroup'

export function ChangePasswordSection({
  onSuccess,
  forced = false,
}: {
  onSuccess?: () => void
  forced?: boolean
}) {
  const { clerkOrgId } = useTenant()
  const updatePassword = useAction(api.candidates.updateMyPassword)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!clerkOrgId) return
    if (!newPassword) {
      setError('Please enter a password.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      await updatePassword({ clerkOrgId, newPassword })
      setSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {forced && (
        <div className="rounded-md border border-atria-warning/30 bg-atria-warning-bg p-3 text-sm text-atria-warning">
          Please set a password to continue.
        </div>
      )}
      {error && <p className="text-sm text-atria-danger">{error}</p>}
      {success && <p className="text-sm text-atria-success">Password updated.</p>}
      <FieldGroup label="New password" required htmlFor="new-password">
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter a secure password"
        />
      </FieldGroup>
      <FieldGroup label="Confirm password" required htmlFor="confirm-password">
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter the password"
        />
      </FieldGroup>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Saving…' : forced ? 'Set password & continue' : 'Update password'}
      </Button>
    </div>
  )
}
