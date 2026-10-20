import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { maskSsn } from '@/shared/utils/ssnMask'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'

/**
 * SSN display field (compliance mini-phase, Stage 3): always renders the
 * masked value; org:hr/org:admin viewers get a "Reveal" button that calls the
 * audited `sensitiveAccess.revealSsn` mutation and swaps in the full value for
 * this session only (never persisted). The audit metadata never contains the
 * SSN itself.
 */
export function SsnField({
  clerkOrgId,
  candidateId,
  contextType,
  label,
  value,
  canReveal,
}: {
  clerkOrgId: string
  candidateId: Id<'candidates'>
  contextType: 'application' | 'w4' | 'i9'
  label: string
  value: string | null | undefined
  canReveal: boolean
}) {
  const revealSsn = useMutation(api.sensitiveAccess.revealSsn)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const hasValue = !!value

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
        {label}
      </p>
      <p className="mt-1 text-base text-atria-ink">
        {revealed ?? (hasValue ? maskSsn(value) : '—')}
      </p>
      {canReveal && hasValue && !revealed && (
        <button
          type="button"
          onClick={async () => {
            setBusy(true)
            setError('')
            try {
              const result = await revealSsn({
                clerkOrgId,
                candidateId,
                contextType,
              })
              if (result.ssn) setRevealed(result.ssn)
            } catch (err) {
              setError(
                err instanceof Error
                  ? sanitizeConvexError(err.message)
                  : 'Failed to reveal SSN.',
              )
            } finally {
              setBusy(false)
            }
          }}
          disabled={busy}
          className="mt-1 text-xs font-medium text-atria-accent hover:underline disabled:opacity-50"
        >
          {busy ? 'Revealing…' : 'Reveal'}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-atria-danger">{error}</p>}
    </div>
  )
}
