import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/react'
import { getStoredClerkOrgId, useTenant } from '@/app/useTenant'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { AppLoader } from '@/shared/ui/AppLoader'
import { formatDateUS } from '@/shared/format'

export function OfferAcceptancePage() {
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { clerkOrgId, tenantName } = useTenant()
  // Same effective-org-id fallback as the route guards: a momentary
  // useTenant() blip during a Clerk token refresh must not flip the query
  // to 'skip'. Authorization is unchanged — the query still re-authorizes
  // the org id server-side on every resolution.
  const effectiveClerkOrgId = clerkOrgId ?? getStoredClerkOrgId() ?? undefined
  const data = useQuery(
    api.candidates.getMyApplication,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  const accept = useMutation(api.candidates.acceptOffer)
  const reject = useMutation(api.candidates.rejectOffer)

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Hold the last payload that showed a pending offer so a transient
  // `undefined` (query resubscribe during a Clerk token refresh) keeps
  // rendering the offer instead of flashing "No pending offer". Stickiness
  // only ever bridges `undefined` — a real resolution with any other status
  // renders that status.
  const [lastOfferData, setLastOfferData] = useState<typeof data>(undefined)
  if (data !== undefined && data !== lastOfferData && data?.candidate?.status === 'offer_sent') {
    setLastOfferData(data)
  }
  const effectiveData = data !== undefined ? data : lastOfferData

  // Query loading or momentarily blipped — never show "No pending offer"
  // until the query has actually resolved.
  if (effectiveData === undefined) {
    return <AppLoader fullScreen label='Loading your offer' />
  }

  const candidate = effectiveData?.candidate
  const application = effectiveData?.application
  const status = candidate?.status

  const firstName = candidate?.displayName?.split(' ')[0] ?? 'there'
  const fields = application?.fields ?? {}
  const position = (fields.position as string) ?? 'Caregiver'
  const payRate = (fields.payRate as string) ?? '$22.00 / hr'
  const startDate = (fields.startDate as string) ?? 'As soon as paperwork is complete'
  const schedule = (fields.schedule as string) ?? 'Flexible, based on availability'
  const supervisor = (fields.supervisor as string) ?? 'Your assigned coordinator'
  const clientName = (fields.clientName as string) ?? undefined
  const agencyName = tenantName ?? 'ATRIA-X'
  const offerExpiresAt = (fields.offerExpiresAt as string) ?? undefined

  const handleAccept = async () => {
    if (!effectiveClerkOrgId) return
    setIsSubmitting(true)
    await accept({ clerkOrgId: effectiveClerkOrgId })
    navigate('/onboarding', { replace: true })
  }

  const handleReject = async () => {
    if (!window.confirm('Are you sure you want to decline this offer?')) return
    if (!effectiveClerkOrgId) return
    setIsSubmitting(true)
    await reject({ clerkOrgId: effectiveClerkOrgId })
    navigate('/onboarding/status', { replace: true })
  }

  if (status !== 'offer_sent') {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
        <Card className='w-full max-w-[480px]'>
          <CardContent className='p-8 text-center'>
            <h1 className='mb-2 text-2xl font-semibold text-atria-ink'>No pending offer</h1>
            <p className='mb-6 text-atria-text-secondary'>There is no offer available right now.</p>
            <Button variant='secondary' onClick={() => navigate('/onboarding/status')}>
              Check status {String.fromCharCode(8594)}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[520px]'>
        <CardContent className='p-8'>
          <div className='mb-6 flex flex-col items-center text-center'>
            <AtriaLogo />
            <p className='mt-2 text-sm text-atria-text-secondary'>Caregiver Portal</p>
            <button
              type='button'
              onClick={() => signOut(() => navigate('/sign-in'))}
              className='mt-2 text-xs text-atria-text-muted hover:text-atria-ink hover:underline'
            >
              Sign out
            </button>
          </div>

          <div className='mb-6 rounded-[var(--radius-atria-md)] border border-atria-success/30 bg-atria-success-bg p-5'>
            <p className='mb-1 text-xs font-semibold uppercase tracking-wide text-atria-success'>You have an offer!</p>
            <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>{position}</h1>
            <p className='text-sm text-atria-text-secondary'>
              {agencyName} {String.fromCharCode(183)} Los Angeles, CA
              {offerExpiresAt ? ` ${String.fromCharCode(183)} Expires ${formatDateUS(offerExpiresAt)}` : ''}
            </p>
          </div>

          <p className='mb-5 text-base text-atria-ink'>
            Hi {firstName}, we are excited to offer you a caregiver position. Review the details below and let us know your decision.
          </p>

          <div className='mb-6 grid grid-cols-2 gap-3'>
            <div className='rounded-[var(--radius-atria-sm)] border border-atria-border bg-atria-surface-2 p-4'>
              <p className='mb-1 text-xs font-semibold uppercase tracking-wide text-atria-text-muted'>Pay rate</p>
              <p className='text-base font-semibold text-atria-ink'>{payRate}</p>
            </div>
            <div className='rounded-[var(--radius-atria-sm)] border border-atria-border bg-atria-surface-2 p-4'>
              <p className='mb-1 text-xs font-semibold uppercase tracking-wide text-atria-text-muted'>Start date</p>
              <p className='text-base font-semibold text-atria-ink'>{formatDateUS(startDate)}</p>
            </div>
            <div className='rounded-[var(--radius-atria-sm)] border border-atria-border bg-atria-surface-2 p-4'>
              <p className='mb-1 text-xs font-semibold uppercase tracking-wide text-atria-text-muted'>Schedule</p>
              <p className='text-base font-semibold text-atria-ink'>{schedule}</p>
            </div>
            <div className='rounded-[var(--radius-atria-sm)] border border-atria-border bg-atria-surface-2 p-4'>
              <p className='mb-1 text-xs font-semibold uppercase tracking-wide text-atria-text-muted'>Supervisor</p>
              <p className='text-base font-semibold text-atria-ink'>{supervisor}</p>
            </div>
          </div>

          {clientName && (
            <div className='mb-6 rounded-[var(--radius-atria-sm)] border border-atria-border bg-atria-surface-2 p-4'>
              <p className='mb-1 text-xs font-semibold uppercase tracking-wide text-atria-text-muted'>Client you will be caring for</p>
              <p className='text-base font-semibold text-atria-ink'>{clientName}</p>
            </div>
          )}

          <Button
            variant='primary'
            size='lg'
            className='mb-3 w-full'
            disabled={isSubmitting}
            onClick={handleAccept}
          >
            {isSubmitting ? 'Accepting...' : 'Accept this offer'}
          </Button>

          <Button
            variant='secondary'
            size='lg'
            className='w-full'
            disabled={isSubmitting}
            onClick={handleReject}
          >
            No thanks, decline this offer
          </Button>

          <p className='mt-4 text-center text-xs text-atria-text-muted'>
            By accepting, you agree to the caregiver terms and conditions.
          </p>
        </CardContent>
      </Card>
      <div className='mt-6 flex flex-col items-center gap-2'>
        {/* TODO: resolve via resolveAgencyLogo(tenantName) when multi-agency support is added */}
        <img
          src="/agency-logo-individualschoice.jpeg"
          alt="Agency logo"
          className='h-10 w-auto object-contain opacity-70'
        />
        <p className='text-xs text-atria-text-muted'>Powered by ATRIA-X Digital Solutions</p>
      </div>
    </div>
  )
}
