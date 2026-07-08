import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '@clerk/react'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { Checkbox } from '@/shared/ui/Checkbox'

const POLICY_SECTIONS = [
  {
    title: '1. Purpose',
    body: 'This policy explains how we protect the privacy and safety of our clients, their families, and our caregivers. By signing below, you confirm that you understand your responsibilities while using the ATRIA-X platform and while providing care services.',
  },
  {
    title: '2. What you must not do',
    body: 'You may not share client health information, photos, addresses, or any identifying details outside of ATRIA-X. You may not accept cash payments, schedule shifts off-platform, or ask clients for personal contact information. All communication about shifts must stay inside the app so we can keep everyone safe and compliant.',
  },
  {
    title: '3. Violations',
    body: 'Violating privacy or safety rules may result in immediate removal from the platform, loss of credentials, and reporting to the appropriate licensing or regulatory body. If you are unsure whether something is allowed, contact your coordinator before acting.',
  },
  {
    title: '4. Background check consent',
    body: 'You consent to a background check and reference verification as part of onboarding. This is required by our clients and by state regulations. Information collected is used only for employment eligibility and is stored securely.',
  },
]

export function AcknowledgmentPage() {
  const navigate = useNavigate()
  const { organization, isLoaded } = useOrganization()
  const clerkOrgId = organization?.id
  const acknowledge = useMutation(api.candidates.acknowledgeBackgroundCheck)

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

  if (!isLoaded || !clerkOrgId) return null

  const handleSubmit = async () => {
    setIsSubmitting(true)
    await acknowledge({ clerkOrgId })
    navigate('/onboarding', { replace: true })
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[560px]'>
        <CardContent className='p-8'>
          <button
            className='mb-4 text-sm text-atria-text-secondary hover:text-atria-ink'
            onClick={() => navigate('/onboarding')}
          >
            ← Back to checklist
          </button>

          <div className='mb-6 flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-[var(--radius-atria-md)] bg-atria-accent text-atria-on-accent'>
              <span className='text-lg font-bold'>A</span>
            </div>
            <div>
              <p className='text-lg font-semibold leading-none text-atria-ink'>ATRIA-X</p>
              <p className='text-sm text-atria-text-secondary'>Caregiver Portal</p>
            </div>
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
            <p className='mb-4 text-sm text-atria-warning'>Scroll to read the full document.</p>
          )}

          <label className='mb-6 flex cursor-pointer items-start gap-3'>
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className='mt-0.5 shrink-0'
            />
            <span className='text-sm text-atria-text-secondary'>
              I have read and understood this policy and consent to a background check and reference verification.
            </span>
          </label>

          <Button
            variant='primary'
            size='lg'
            className='w-full'
            disabled={!scrolledToBottom || !agreed || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Confirming...' : 'Confirm & sign →'}
          </Button>

          <p className='mt-4 text-center text-xs text-atria-text-muted'>
            By confirming, you are signing this acknowledgment electronically.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
