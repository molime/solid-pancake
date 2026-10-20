import { useEffect, useRef, useState } from 'react'
import { useClerk } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useTenant } from '@/app/useTenant'
import { clearSessionData } from '@/shared/lib/clearSession'
import { STAFF_POLICIES, type StaffPolicy } from './staffPolicies'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'

function policyByKey(key: string): StaffPolicy | undefined {
  return STAFF_POLICIES.find((p) => p.key === key)
}

/**
 * Blocking staff-policy acknowledgment modal (compliance mini-phase, Stage 4).
 * Mounted once in the agency shell. If the current user has any pending
 * policy acknowledgments, the modal overlays the whole app and cannot be
 * dismissed (no backdrop/Escape close) until every pending policy is
 * acknowledged — the only exit besides acknowledging is the Sign out link.
 * Each policy must be scrolled to the end and explicitly agreed to, copying
 * the scroll-gating UX of the candidate AcknowledgmentPage.
 */
export function PolicyAcknowledgmentModal() {
  const { clerkOrgId, isLoading } = useTenant()
  const pending = useQuery(
    api.policies.getPendingAcknowledgments,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const acknowledge = useMutation(api.policies.acknowledge)
  const { signOut } = useClerk()

  const [index, setIndex] = useState(0)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const current = pending?.[index]

  // Reset the scroll gate / checkbox when moving to the next policy.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset-on-index-change; the
       alternative (key remount) would tear down the scroll container mid-flow. */
    setScrolledToBottom(false)
    setAgreed(false)
    setError(null)
    /* eslint-enable react-hooks/set-state-in-effect */
    scrollRef.current?.scrollTo({ top: 0 })
  }, [index])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
      if (nearBottom) setScrolledToBottom(true)
    }
    el.addEventListener('scroll', onScroll)
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [current?.key])

  if (isLoading || !clerkOrgId || !pending || pending.length === 0 || !current) {
    return null
  }

  const policy = policyByKey(current.key)
  const isLast = index === pending.length - 1

  const handleAgree = async () => {
    if (!clerkOrgId) return
    setIsSubmitting(true)
    setError(null)
    try {
      await acknowledge({
        clerkOrgId,
        policyKey: current.key,
        policyVersion: current.version,
      })
      if (isLast) {
        // The pending query will refetch to an empty list and unmount this
        // modal; nothing else to do.
      } else {
        setIndex((i) => i + 1)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not record your acknowledgment.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = () => {
    clearSessionData()
    signOut()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-atria-ink/50 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${current.title} acknowledgment`}
        className="flex max-h-full w-full max-w-[640px] flex-col overflow-hidden rounded-[var(--radius-atria-lg)] bg-atria-surface shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-atria-border px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-atria-ink">
              Policy update — please review
            </h1>
            <p className="text-sm text-atria-text-secondary">
              Policy {index + 1} of {pending.length}
              {policy ? ` · Effective ${policy.effectiveDate}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="shrink-0 text-xs text-atria-text-secondary hover:text-atria-ink hover:underline"
          >
            Sign out
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <h2 className="mb-4 text-xl font-semibold text-atria-ink">
            {current.title}
            <span className="ml-2 text-sm font-normal text-atria-text-muted">
              v{current.version}
            </span>
          </h2>
          <div
            ref={scrollRef}
            className="max-h-[45vh] overflow-y-auto rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-5"
          >
            {(policy?.sections ?? []).map((section) => (
              <div key={section.heading} className="mb-5 last:mb-0">
                <h3 className="mb-2 text-base font-semibold text-atria-ink">
                  {section.heading}
                </h3>
                <p className="text-sm leading-relaxed text-atria-text-secondary">
                  {section.body}
                </p>
              </div>
            ))}
          </div>

          {!scrolledToBottom && (
            <p className="mt-3 text-sm text-atria-warning">
              ↓ Scroll to read the full document
            </p>
          )}

          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <span className="text-sm text-atria-text-secondary">
              I have read and understood this policy, and I agree to follow it.
            </span>
          </label>

          {error && <p className="mt-3 text-sm text-atria-danger">{error}</p>}
        </div>

        <div className="border-t border-atria-border px-6 py-4">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!scrolledToBottom || !agreed || isSubmitting}
            onClick={handleAgree}
          >
            {isSubmitting
              ? 'Confirming...'
              : isLast
                ? 'I have read and agree'
                : 'I have read and agree — next policy'}
          </Button>
          <p className="mt-3 text-center text-xs text-atria-text-muted">
            Your acknowledgment is recorded with your name, the policy version,
            and a timestamp.
          </p>
        </div>
      </div>
    </div>
  )
}
