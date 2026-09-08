import { useMemo, useRef } from 'react'
import { SignedInApplyFlowBranding } from '../components/application/ApplyFlowBranding'
import { useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/react'
import { clearSessionData } from '@/shared/lib/clearSession'
import { useTenant } from '@/app/useTenant'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent } from '@/shared/ui/Card'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { AppLoader } from '@/shared/ui/AppLoader'
import { Button } from '@/shared/ui/Button'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { cn } from '@/shared/lib/cn'
import { formatDateUS } from '@/shared/format'


const STATUS_CONFIG: Record<string, { title: string; description: string; variant: 'success' | 'warning' | 'info' | 'neutral' | 'danger'; cardClass: string; labelClass: string }> = {
  invited: {
    title: 'Application not started',
    description: 'Please fill out and submit your application.',
    variant: 'neutral',
    cardClass: 'border-atria-border bg-atria-surface-2',
    labelClass: 'text-atria-text-secondary',
  },
  applied: {
    title: 'Under review',
    description: 'We received your application. An HR team member will review it soon.',
    variant: 'warning',
    cardClass: 'border-atria-warning/30 bg-atria-warning/10',
    labelClass: 'text-atria-warning',
  },
  hr_review: {
    title: 'Under review',
    description: 'Your application is being reviewed by the hiring team.',
    variant: 'warning',
    cardClass: 'border-atria-warning/30 bg-atria-warning/10',
    labelClass: 'text-atria-warning',
  },
  application_draft: {
    title: 'Needs correction',
    description: 'HR requested updates to your application. Please resubmit.',
    variant: 'danger',
    cardClass: 'border-atria-danger/30 bg-atria-danger/10',
    labelClass: 'text-atria-danger',
  },
  offer_sent: {
    title: 'Offer sent',
    description: 'You have an offer waiting! Please review and accept.',
    variant: 'success',
    cardClass: 'border-atria-success/30 bg-atria-success/10',
    labelClass: 'text-atria-success',
  },
  accepted: {
    title: 'Offer accepted',
    description: 'Welcome to the team! Complete your tasks.',
    variant: 'success',
    cardClass: 'border-atria-success/30 bg-atria-success/10',
    labelClass: 'text-atria-success',
  },
  hired: {
    title: 'Hired',
    description: 'You are hired. Head to your caregiver dashboard.',
    variant: 'success',
    cardClass: 'border-atria-success/30 bg-atria-success/10',
    labelClass: 'text-atria-success',
  },
  rejected: {
    title: 'Not moving forward',
    description: 'Thank you for your interest. We decided not to move forward.',
    variant: 'danger',
    cardClass: 'border-atria-danger/30 bg-atria-danger/10',
    labelClass: 'text-atria-danger',
  },
  withdrawn: {
    title: 'Withdrawn',
    description: 'This application has been withdrawn.',
    variant: 'neutral',
    cardClass: 'border-atria-border bg-atria-surface-2',
    labelClass: 'text-atria-text-secondary',
  },
}

const STEPS = [
  { key: 'submitted', label: 'Application submitted' },
  { key: 'documents', label: 'Documents received' },
  { key: 'review', label: 'Under review' },
  { key: 'decision', label: 'Decision' },
]

const UPLOAD_TYPES = new Set(['photo_id', 'cpr_certificate'])

function formatDate(value?: string) {
  if (!value) return ''
  return formatDateUS(value)
}

export function ApplicationStatusPage() {
  const navigate = useNavigate()
  const { signOut } = useClerk()

  const handleSignOut = () => {
    clearSessionData()
    signOut(() => navigate('/sign-in'))
  }
  const { clerkOrgId, isLoading } = useTenant()

  // Sticky mounting: once the page has rendered its content once, it must
  // never unmount back to a loader during brief Clerk/Convex auth flickers.
  const hasMountedRef = useRef(false)
  const lastClerkOrgIdRef = useRef<string | undefined>(undefined)
  // eslint-disable-next-line react-hooks/refs
  if (clerkOrgId) lastClerkOrgIdRef.current = clerkOrgId
  // eslint-disable-next-line react-hooks/refs
  const effectiveClerkOrgId = clerkOrgId ?? lastClerkOrgIdRef.current

  const data = useQuery(
    api.candidates.getMyApplication,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  const hasTrainingProduct = useQuery(
    api.agencyConfig.hasProduct,
    effectiveClerkOrgId
      ? { clerkOrgId: effectiveClerkOrgId, productKey: 'training' }
      : 'skip',
  )

  const candidate = data?.candidate
  const application = data?.application
  const tasks = data?.tasks

  const status = candidate?.status ?? 'invited'
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.invited

  const currentStepIndex = useMemo(() => {
    if (['hired', 'accepted', 'offer_sent'].includes(status)) return 3
    if (['applied', 'hr_review', 'application_draft'].includes(status)) return 2
    if (tasks?.some((t) => t.status === 'complete')) return 1
    return 0
  }, [status, tasks])

  const submittedDate = formatDate(application?.submittedAt)
  const documentTasks = tasks?.filter((t) => UPLOAD_TYPES.has(t.type)) ?? []
  const documentsComplete = documentTasks.length > 0 && documentTasks.every((t) => t.status === 'complete')
  const documentsDate = tasks?.find((t) => UPLOAD_TYPES.has(t.type) && t.completedAt)?.completedAt

  const firstPendingDocumentTask = useMemo(() => {
    if (!tasks) return null
    return tasks.find((t) => UPLOAD_TYPES.has(t.type) && t.status !== 'complete') ?? null
  }, [tasks])

  // Only show the loader on the very first load; afterwards the page stays
  // mounted through brief auth flickers.
  // eslint-disable-next-line react-hooks/refs
  if (!hasMountedRef.current && (isLoading || !effectiveClerkOrgId)) {
    return <AppLoader fullScreen />
  }
  // eslint-disable-next-line react-hooks/refs
  hasMountedRef.current = true

  const firstName = candidate?.displayName?.split(' ')[0] ?? 'there'

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[540px]'>
        <CardContent className='p-8'>
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

          <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>Hi {firstName} 👋</h1>
          <p className='mb-6 text-base text-atria-text-secondary'>Here is where your application stands.</p>

          <div className={cn('mb-8 rounded-[var(--radius-atria-md)] border p-5', config.cardClass)}>
            <p className={cn('mb-2 text-xs font-semibold uppercase tracking-wide', config.labelClass)}>Current status</p>
            <div className='mb-2 flex items-center gap-3'>
              <h2 className='text-xl font-semibold text-atria-ink'>{config.title}</h2>
              <StatusBadge variant={config.variant} />
            </div>
            <p className='text-sm text-atria-text-secondary'>{config.description}</p>
          </div>

          {['applied', 'hr_review', 'application_draft'].includes(status) && !documentsComplete && firstPendingDocumentTask && (
            <div className='mb-8 rounded-[var(--radius-atria-md)] border border-atria-warning/40 bg-atria-warning-bg p-5'>
              <div className='mb-2 flex items-center gap-2'>
                <span className='text-lg'>⚠️</span>
                <p className='text-base font-semibold text-atria-warning'>Your application is waiting on documents</p>
              </div>
              <p className='mb-4 text-sm text-atria-ink'>
                We cannot review your application until you upload the required documents. Tap below to upload now.
              </p>
              <Button
                variant='primary'
                size='lg'
                className='w-full'
                onClick={() =>
                  firstPendingDocumentTask
                    ? navigate(`/onboarding/upload/${firstPendingDocumentTask._id}`)
                    : navigate('/onboarding/checklist')
                }
              >
                Upload required document →
              </Button>
            </div>
          )}

          <h3 className='mb-4 text-base font-semibold text-atria-ink'>Your progress</h3>

          <div className='relative mb-8 pl-2'>
            {STEPS.map((step, idx) => {
              const completed = idx <= currentStepIndex
              const isCurrent = idx === currentStepIndex
              const subtext =
                step.key === 'submitted' && submittedDate
                  ? `Submitted on ${submittedDate}`
                  : step.key === 'documents' && documentsComplete && documentsDate
                    ? `Completed on ${formatDate(documentsDate)}`
                    : step.key === 'documents' && !documentsComplete
                      ? 'Photo ID and CPR certificate required'
                      : isCurrent
                        ? 'In progress'
                        : ''
              return (
                <div key={step.key} className='relative flex gap-4 pb-6 last:pb-0'>
                  {idx !== STEPS.length - 1 && (
                    <div
                      className={cn(
                        'absolute left-[11px] top-6 w-px',
                        completed ? 'bg-atria-accent' : 'bg-atria-border',
                      )}
                      style={{ height: 'calc(100% - 24px)' }}
                    />
                  )}
                  <div
                    className={cn(
                      'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                      completed
                        ? 'border-atria-accent bg-atria-accent text-atria-on-accent'
                        : 'border-atria-border bg-atria-surface-3 text-atria-text-muted',
                    )}
                  >
                    {completed ? (
                      <svg className='h-4 w-4' viewBox='0 0 24 24' fill='currentColor' aria-hidden>
                        <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' />
                      </svg>
                    ) : (
                      <span className='text-xs'>{idx + 1}</span>
                    )}
                  </div>
                  <div>
                    <p
                      className={cn(
                        'text-base font-medium',
                        completed ? 'text-atria-ink' : 'text-atria-text-secondary',
                      )}
                    >
                      {step.label}
                    </p>
                    {subtext && (
                      <p className={cn('text-sm', step.key === 'documents' && !documentsComplete ? 'text-atria-warning font-medium' : 'text-atria-text-secondary')}>{subtext}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className='flex flex-col gap-3'>
            {status === 'application_draft' && (
              <Button variant='primary' size='lg' className='w-full' onClick={() => navigate('/onboarding/application')}>
                Update application {String.fromCharCode(8594)}
              </Button>
            )}
            {status === 'offer_sent' && (
              <Button variant='primary' size='lg' className='w-full' onClick={() => navigate('/onboarding/offer')}>
                View your offer {String.fromCharCode(8594)}
              </Button>
            )}
            {['applied', 'hr_review'].includes(status) && (
              <Button variant='primary' size='lg' className='w-full' onClick={() => navigate('/onboarding')}>
                View my tasks {String.fromCharCode(8594)}
              </Button>
            )}
            {status === 'accepted' && (
              <Button variant='secondary' size='lg' className='w-full' onClick={() => navigate('/onboarding')}>
                Back to task list {String.fromCharCode(8594)}
              </Button>
            )}
            {status === 'hired' && (
              <Button variant='primary' size='lg' className='w-full' onClick={() => navigate(hasTrainingProduct ? '/training' : '/onboarding/training')}>
                {hasTrainingProduct ? 'Start training' : 'Complete platform training'} {String.fromCharCode(8594)}
              </Button>
            )}
            {['rejected', 'withdrawn'].includes(status) && (
              <Button variant='secondary' size='lg' className='w-full' onClick={() => navigate('/onboarding')}>
                Back to task list {String.fromCharCode(8594)}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <SignedInApplyFlowBranding />
    </div>
  )
}
