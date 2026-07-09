import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'
import type { Doc } from '../../../../convex/_generated/dataModel'

const TASK_META: Record<string, { label: string; shortLabel: string; due: string }> = {
  form_submission: {
    label: 'Submit your application',
    shortLabel: 'Application',
    due: 'Due today',
  },
  photo_id: {
    label: 'Upload photo ID',
    shortLabel: 'Photo ID',
    due: 'Due in 2 days',
  },
  cpr_certificate: {
    label: 'Upload CPR certificate',
    shortLabel: 'CPR certificate',
    due: 'Due in 2 days',
  },
  background_check: {
    label: 'Consent to background check',
    shortLabel: 'Background check',
    due: 'Due in 3 days',
  },
  employment_agreement: {
    label: 'Sign employment agreement',
    shortLabel: 'Employment agreement',
    due: 'Due in 3 days',
  },
  platform_training: {
    label: 'Complete platform training',
    shortLabel: 'Platform training',
    due: 'Due before first shift',
  },
}

function getTaskRoute(task: Doc<'candidateTasks'>) {
  if (task.type === 'form_submission') return '/onboarding/application'
  if (task.type === 'background_check' || task.type === 'employment_agreement') {
    return '/onboarding/acknowledgment'
  }
  if (task.type === 'platform_training') return '/onboarding/training'
  return `/onboarding/upload/${task._id}`
}

export function CandidateOnboardingPage() {
  const navigate = useNavigate()
  const { organization, isLoaded } = useOrganization()
  const clerkOrgId = organization?.id
  const tasks = useQuery(
    api.candidates.listCandidateTasks,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const candidate = useQuery(
    api.candidates.getCandidateProfile,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const completedCount = useMemo(() => tasks?.filter((t) => t.status === 'complete').length ?? 0, [tasks])
  const totalCount = tasks?.length ?? 6
  const progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0

  const nextPending = useMemo(() => {
    if (!tasks) return null
    return tasks.find((t) => t.status !== 'complete') ?? null
  }, [tasks])

  if (!isLoaded || !clerkOrgId) return null

  const handleNext = () => {
    if (nextPending) {
      navigate(getTaskRoute(nextPending))
    } else if (candidate?.status === 'offer_sent') {
      navigate('/onboarding/offer')
    } else if (candidate?.status === 'hired') {
      navigate('/onboarding/training')
    } else {
      navigate('/onboarding/status')
    }
  }

  const nextLabel = nextPending
    ? `Next: ${TASK_META[nextPending.type]?.shortLabel ?? nextPending.type} →`
    : candidate?.status === 'offer_sent'
      ? 'View your offer →'
      : 'Check application status →'

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[540px]'>
        <CardContent className='p-8'>
          <div className='mb-6 flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-[var(--radius-atria-md)] bg-atria-accent text-atria-on-accent'>
              <span className='text-lg font-bold'>A</span>
            </div>
            <div>
              <p className='text-lg font-semibold leading-none text-atria-ink'>ATRIA-X</p>
              <p className='text-sm text-atria-text-secondary'>Caregiver Portal</p>
            </div>
          </div>

          <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>Your onboarding tasks</h1>
          <p className='mb-6 text-base text-atria-text-secondary'>
            Complete these before your first shift.
          </p>

          <div className='mb-6'>
            <div className='mb-2 flex items-center justify-between text-sm'>
              <span className='font-medium text-atria-ink'>{completedCount} of {totalCount} complete</span>
              <span className='text-atria-text-secondary'>{progress}%</span>
            </div>
            <div className='h-2 w-full overflow-hidden rounded-full bg-atria-surface-2'>
              <div
                className='h-full rounded-full bg-atria-accent transition-all duration-500'
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            {tasks?.map((task) => {
              const meta = TASK_META[task.type] ?? {
                label: task.type,
                shortLabel: task.type,
                due: 'Pending',
              }
              const isComplete = task.status === 'complete'
              const isNext = nextPending?._id === task._id
              return (
                <button
                  key={task._id}
                  onClick={() => navigate(getTaskRoute(task))}
                  className={cn(
                    'flex items-center gap-4 rounded-[var(--radius-atria-md)] border p-4 text-left transition-colors',
                    isComplete
                      ? 'border-atria-border bg-atria-surface'
                      : isNext
                        ? 'border-atria-warning/40 bg-atria-warning-bg'
                        : 'border-atria-border bg-atria-surface-2',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-atria-sm)] border',
                      isComplete
                        ? 'border-atria-success bg-atria-success text-white'
                        : isNext
                          ? 'border-atria-warning bg-atria-warning/10'
                          : 'border-atria-border bg-atria-surface-3',
                    )}
                  >
                    {isComplete && (
                      <svg className='h-4 w-4' viewBox='0 0 24 24' fill='currentColor' aria-hidden>
                        <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' />
                      </svg>
                    )}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p
                      className={cn(
                        'truncate text-base font-medium',
                        isComplete
                          ? 'text-atria-text-secondary line-through'
                          : isNext
                            ? 'text-atria-warning'
                            : 'text-atria-text-secondary',
                      )}
                    >
                      {meta.label}
                    </p>
                    <p className='text-sm text-atria-text-muted'>{meta.due}</p>
                  </div>
                  {isNext && (
                    <span className='rounded-full bg-atria-accent px-3 py-1 text-xs font-medium text-atria-on-accent'>
                      Next
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <Button variant='primary' size='lg' className='mt-6 w-full' onClick={handleNext}>
            {nextLabel}
          </Button>

          <p className='mt-4 text-center text-sm text-atria-text-secondary'>
            Need help?{' '}
            <a href='mailto:recruiting@atriax.example' className='text-atria-accent hover:underline'>
              Contact your recruiter →
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
