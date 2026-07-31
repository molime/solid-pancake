import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/react'
import { clearSessionData } from '@/shared/lib/clearSession'
import { useTenant } from '@/app/useTenant'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { Checkbox } from '@/shared/ui/Checkbox'
import { cn } from '@/shared/lib/cn'

const POLICY_SECTIONS = [
  {
    title: '1. Purpose',
    body: 'As a caregiver you may have access to client personal health information (PHI). You agree to keep all such information confidential and use it only to deliver care.',
  },
  {
    title: '2. What you must not do',
    body: 'Do not share client names, addresses, medical history, or care plans with anyone outside the care team. Do not photograph or record clients without consent.',
  },
  {
    title: '3. Violations',
    body: 'Violations may result in immediate termination and may carry legal penalties under HIPAA federal law. Report suspected breaches to your supervisor immediately.',
  },
]

export function AcknowledgmentPage() {
  const navigate = useNavigate()
  const { signOut } = useClerk()

  const handleSignOut = () => {
    clearSessionData()
    signOut(() => navigate('/sign-in'))
  }
  const { clerkOrgId, isLoading } = useTenant()
  const acknowledge = useMutation(api.candidates.acknowledgeBackgroundCheck)
  const bgCheck = useQuery(
    api.backgroundChecks.getBackgroundCheck,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const [hasConsented, setHasConsented] = useState(false)

  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

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
  }, [])

  if (isLoading || !clerkOrgId) return null

  const handleSubmit = async () => {
    setIsSubmitting(true)
    await acknowledge({ clerkOrgId })
    setHasConsented(true)
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[560px]'>
        <CardContent className='p-8'>
          <button
            className='mb-4 text-sm text-atria-accent hover:text-atria-accent-hover'
            onClick={() => navigate('/onboarding')}
          >
            ← Back to checklist
          </button>

          <div className='mb-6 flex flex-col items-center text-center'>
            <AtriaLogo />
            <p className='mt-2 text-sm text-atria-text-secondary'>Candidate Portal</p>
            <button
              type='button'
              onClick={handleSignOut}
              className='mt-2 text-xs text-atria-text-muted hover:text-atria-ink hover:underline'
            >
              Sign out
            </button>
          </div>

          <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>Read & confirm</h1>
          <p className='mb-6 text-base text-atria-text-secondary'>
            HIPAA Privacy & Confidentiality Policy
          </p>

          <div
            ref={scrollRef}
            className='mb-4 max-h-[360px] overflow-y-auto rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-5'
          >
            {POLICY_SECTIONS.map((section) => (
              <div key={section.title} className='mb-5 last:mb-0'>
                <h3 className='mb-2 text-base font-semibold text-atria-ink'>{section.title}</h3>
                <p className='text-sm leading-relaxed text-atria-text-secondary'>{section.body}</p>
              </div>
            ))}
          </div>

          {!scrolledToBottom && (
            <p className='mb-4 text-sm text-atria-warning'>↓ Scroll to read the full document</p>
          )}

          <label className='mb-6 flex cursor-pointer items-start gap-3'>
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className='mt-0.5 shrink-0'
            />
            <span className='text-sm text-atria-text-secondary'>
              I have read and understood this policy
            </span>
          </label>

          {!hasConsented ? (
            <>
              <Button
                variant='primary'
                size='lg'
                className='w-full'
                disabled={!scrolledToBottom || !agreed || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Confirming...' : 'Confirm & sign'}
              </Button>

              <p className='mt-4 text-center text-xs text-atria-text-muted'>
                Your digital signature and timestamp will be recorded.
              </p>
            </>
          ) : (
            <div className='space-y-4'>
              <div className={cn(
                'rounded-[var(--radius-atria-md)] border p-4',
                bgCheck?.status === 'clear'
                  ? 'border-atria-success/30 bg-atria-success/10'
                  : bgCheck?.status === 'consider'
                    ? 'border-atria-warning/30 bg-atria-warning/10'
                    : bgCheck?.status === 'error'
                      ? 'border-atria-danger/30 bg-atria-danger/10'
                      : 'border-atria-border bg-atria-surface-2',
              )}>
                <div className='flex items-center gap-2'>
                  {bgCheck?.status === 'pending' && (
                    <>
                      <span className='animate-pulse text-lg'>⏳</span>
                      <p className='text-sm font-medium text-atria-text-secondary'>
                        Background check in progress...
                      </p>
                    </>
                  )}
                  {bgCheck?.status === 'clear' && (
                    <>
                      <span className='text-lg'>✓</span>
                      <p className='text-sm font-medium text-atria-success'>
                        Background check cleared
                      </p>
                    </>
                  )}
                  {bgCheck?.status === 'consider' && (
                    <>
                      <span className='text-lg'>⚠️</span>
                      <p className='text-sm font-medium text-atria-warning'>
                        Background check requires review
                      </p>
                    </>
                  )}
                  {bgCheck?.status === 'error' && (
                    <>
                      <span className='text-lg'>✗</span>
                      <p className='text-sm font-medium text-atria-danger'>
                        Background check failed — please contact HR
                      </p>
                    </>
                  )}
                  {!bgCheck && (
                    <>
                      <span className='animate-pulse text-lg'>⏳</span>
                      <p className='text-sm font-medium text-atria-text-secondary'>
                        Initiating background check...
                      </p>
                    </>
                  )}
                </div>
              </div>

              <Button
                variant='secondary'
                size='lg'
                className='w-full'
                onClick={() => navigate('/onboarding', { replace: true })}
              >
                Back to checklist →
              </Button>
            </div>
          )}
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
