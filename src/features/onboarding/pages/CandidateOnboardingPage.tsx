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
import { cn } from '@/shared/lib/cn'
import type { Doc } from '../../../../convex/_generated/dataModel'

const TASK_META: Record<string, { label: string; shortLabel: string; actionLabel: string; due: string; optional?: boolean }> = {
  form_submission: {
    label: 'Submit your application',
    shortLabel: 'Application',
    actionLabel: 'Fill out application',
    due: 'Due today',
  },
  photo_id: {
    label: 'Photo ID',
    shortLabel: 'Photo ID',
    actionLabel: 'Upload Photo ID',
    due: 'Due in 2 days',
  },
  tax_id_ssn: {
    label: 'Tax ID or SSN',
    shortLabel: 'Tax ID / SSN',
    actionLabel: 'Upload Tax ID or SSN',
    due: 'Due in 2 days',
  },
  cpr_certificate: {
    label: 'CPR certificate',
    shortLabel: 'CPR certificate',
    actionLabel: 'Upload CPR certificate',
    due: 'Due in 2 days',
  },
  health_screen: {
    label: 'Health screen',
    shortLabel: 'Health screen',
    actionLabel: 'Upload health screen',
    due: 'Due in 3 days',
  },
  background_check: {
    label: 'Background check',
    shortLabel: 'Background check',
    actionLabel: 'Upload background check',
    due: 'Due in 3 days',
  },
  employment_agreement: {
    label: 'Employment agreement & privacy policy',
    shortLabel: 'Employment agreement',
    actionLabel: 'Review and sign agreement',
    due: 'Due in 3 days',
  },
  additional_certifications: {
    label: 'Additional certifications',
    shortLabel: 'Certifications',
    actionLabel: 'Upload certifications',
    due: 'Optional',
    optional: true,
  },
  car_insurance: {
    label: 'Car insurance policy',
    shortLabel: 'Car insurance',
    actionLabel: 'Upload car insurance',
    due: 'Due in 3 days',
  },
  personnel_record: {
    label: 'Personnel record (HCS 501)',
    shortLabel: 'Personnel record',
    actionLabel: 'Upload personnel record',
    due: 'Required now that you are hired',
  },
}

const UPLOAD_TYPES = new Set(['photo_id', 'tax_id_ssn', 'cpr_certificate', 'health_screen', 'background_check', 'additional_certifications', 'car_insurance', 'personnel_record'])

function getTaskRoute(task: Doc<'candidateTasks'>, hasTrainingProduct: boolean | undefined) {
  if (task.type === 'form_submission') return '/onboarding/application'
  if (task.type === 'employment_agreement') return '/onboarding/employment-agreement'
  if (task.type === 'platform_training') return hasTrainingProduct ? '/training' : '/onboarding/training'
  return `/onboarding/upload/${task._id}`
}

export function CandidateOnboardingPage() {
  const navigate = useNavigate()
  const { signOut } = useClerk()

  const handleSignOut = () => {
    clearSessionData()
    signOut(() => navigate('/sign-in'))
  }
  const { clerkOrgId, tenantName, isLoading } = useTenant()

  // Sticky mounting: once the page has rendered its content once, it must
  // never unmount back to a loader during brief Clerk/Convex auth flickers.
  const hasMountedRef = useRef(false)
  const lastClerkOrgIdRef = useRef<string | undefined>(undefined)
  // eslint-disable-next-line react-hooks/refs
  if (clerkOrgId) lastClerkOrgIdRef.current = clerkOrgId
  // eslint-disable-next-line react-hooks/refs
  const effectiveClerkOrgId = clerkOrgId ?? lastClerkOrgIdRef.current

  const tasks = useQuery(
    api.candidates.listCandidateTasks,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  const candidate = useQuery(
    api.candidates.getCandidateProfile,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  const employerInfo = useQuery(
    api.tenantSettings.getEmployerInfo,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId } : 'skip',
  )
  const hasTrainingProduct = useQuery(
    api.agencyConfig.hasProduct,
    effectiveClerkOrgId ? { clerkOrgId: effectiveClerkOrgId, productKey: 'training' } : 'skip',
  )

  // Skipped tasks (e.g. car_insurance when the applicant answered No to the
  // transport question) are never shown and never block progress.
  const isGoldenAges = useMemo(
    () =>
      (employerInfo?.legalName ?? '').toLowerCase().includes('golden') ||
      (tenantName ?? '').toLowerCase().includes('golden'),
    [employerInfo, tenantName],
  )

  const visibleTasks = useMemo(
    () => tasks?.filter((t) => t.status !== 'skipped'),
    [tasks],
  )

  // Skipped OPTIONAL tasks (e.g. additional certifications) stay visible at
  // the bottom of the checklist with a "Skipped" badge so the candidate can
  // change their mind and upload later.
  const skippedOptionalTasks = useMemo(
    () =>
      tasks?.filter(
        (t) => t.status === 'skipped' && TASK_META[t.type]?.optional,
      ) ?? [],
    [tasks],
  )

  const completedCount = useMemo(() => visibleTasks?.filter((t) => t.status === 'complete').length ?? 0, [visibleTasks])
  const totalCount = visibleTasks?.length ?? 8
  const progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0

  const nextPending = useMemo(() => {
    if (!visibleTasks) return null
    const required = visibleTasks.filter((t) => !(TASK_META[t.type]?.optional))
    const nextRequired = required.find((t) => t.status !== 'complete')
    if (nextRequired) return nextRequired
    return visibleTasks.find((t) => t.status !== 'complete') ?? null
  }, [visibleTasks])

  const nextMeta = nextPending ? TASK_META[nextPending.type] ?? {
    label: nextPending.type,
    shortLabel: nextPending.type,
    actionLabel: `Complete ${nextPending.type}`,
    due: 'Pending',
  } : null

  const isUploadNext = nextPending ? UPLOAD_TYPES.has(nextPending.type) : false

  // Only show the loader on the very first load; afterwards the page stays
  // mounted through brief auth flickers.
  // eslint-disable-next-line react-hooks/refs
  if (!hasMountedRef.current && (isLoading || !effectiveClerkOrgId)) {
    return <AppLoader fullScreen />
  }
  // eslint-disable-next-line react-hooks/refs
  hasMountedRef.current = true

  const handleNext = () => {
    if (nextPending) {
      navigate(getTaskRoute(nextPending, hasTrainingProduct))
    } else if (candidate?.status === 'offer_sent') {
      navigate('/onboarding/offer')
    } else if (candidate?.status === 'hired') {
      if (isGoldenAges && hasTrainingProduct) {
        navigate('/training')
      } else if (isGoldenAges) {
        navigate('/onboarding/status')
      } else {
        navigate('/onboarding/training')
      }
    } else {
      navigate('/onboarding/status')
    }
  }

  const nextLabel = nextPending
    ? `${nextMeta?.actionLabel ?? 'Next'} →`
    : candidate?.status === 'offer_sent'
      ? 'View your offer →'
      : candidate?.status === 'hired'
        ? isGoldenAges
          ? hasTrainingProduct
            ? 'Start Golden Ages training →'
            : 'Check application status →'
          : 'Complete platform training →'
        : 'Check application status →'

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

          <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>Your tasks</h1>
          <p className='mb-6 text-base text-atria-text-secondary'>
            Complete these before your first shift.
          </p>

          {isUploadNext && nextPending && !(TASK_META[nextPending.type]?.optional) && (
            <div className='mb-6 rounded-[var(--radius-atria-md)] border border-atria-warning/40 bg-atria-warning-bg p-5'>
              <div className='mb-2 flex items-center gap-2'>
                <span className='text-lg'>⚠️</span>
                <p className='text-base font-semibold text-atria-warning'>Required next step</p>
              </div>
              <p className='text-sm text-atria-ink'>
                You must <strong>{nextMeta?.label.toLowerCase() ?? 'upload this document'}</strong> before we can review your application. Tap the button below to upload now.
              </p>
            </div>
          )}

          {nextPending && TASK_META[nextPending.type]?.optional && (
            <div className='mb-6 rounded-[var(--radius-atria-md)] border border-atria-info/30 bg-atria-info/5 p-4'>
              <p className='text-sm text-atria-text-secondary'>
                <strong className='text-atria-ink'>Optional:</strong> You can add additional certifications if you have them, but this is not required. Your application can be reviewed without this step.
              </p>
            </div>
          )}

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
            {visibleTasks?.map((task, taskIndex) => {
              const meta = TASK_META[task.type] ?? {
                label: task.type,
                shortLabel: task.type,
                actionLabel: `Complete ${task.type}`,
                due: 'Pending',
              }
              const isComplete = task.status === 'complete'
              const isNext = nextPending?._id === task._id
              const isOptional = meta.optional ?? false
              // Lock a task if it's not complete and not the next pending task
              // Optional tasks are also locked until all previous required tasks are done
              const allPreviousComplete = visibleTasks?.slice(0, taskIndex).every(
                (t: { status: string }) => t.status === 'complete' || t.status === 'waived'
              ) ?? false
              const isLocked = !isComplete && !isNext && !(isOptional && allPreviousComplete)
              return (
                <button
                  key={task._id}
                  onClick={() => {
                    if (isLocked) return
                    navigate(getTaskRoute(task, hasTrainingProduct))
                  }}
                  disabled={isLocked}
                  className={cn(
                    'flex items-center gap-4 rounded-[var(--radius-atria-md)] border p-4 text-left transition-colors',
                    isComplete
                      ? 'border-atria-border bg-atria-surface'
                      : isNext
                        ? 'border-atria-warning/40 bg-atria-warning-bg'
                        : 'border-atria-border bg-atria-surface-2 opacity-50',
                    isLocked && 'cursor-not-allowed',
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
                    {isLocked && (
                      <svg className='h-3 w-3 text-atria-text-muted' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' aria-hidden>
                        <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                        <path d='M7 11V7a5 5 0 0 1 10 0v4' />
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
                            : 'text-atria-text-muted',
                      )}
                    >
                      {meta.label}
                    </p>
                    <p className='text-sm text-atria-text-muted'>
                      {isLocked ? `Complete step ${taskIndex} first` : meta.due}
                    </p>
                  </div>
                  {isNext && (
                    <span className='rounded-full bg-atria-accent px-3 py-1 text-xs font-medium text-atria-on-accent'>
                      Next
                    </span>
                  )}
                  {isOptional && !isComplete && (
                    <span className='rounded-full bg-atria-info/20 px-3 py-1 text-xs font-medium text-atria-info'>
                      Optional
                    </span>
                  )}
                  {isLocked && (
                    <span className='rounded-full bg-atria-surface-3 px-3 py-1 text-xs font-medium text-atria-text-muted'>
                      Locked
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <Button variant='primary' size='lg' className='mt-6 w-full' onClick={handleNext}>
            {nextLabel}
          </Button>

          {skippedOptionalTasks.length > 0 && (
            <div className='mt-6 border-t border-atria-border pt-4'>
              <p className='mb-3 text-sm font-medium text-atria-text-secondary'>
                Skipped optional steps
              </p>
              <div className='flex flex-col gap-3'>
                {skippedOptionalTasks.map((task) => {
                  const meta = TASK_META[task.type] ?? {
                    label: task.type,
                    shortLabel: task.type,
                    actionLabel: `Complete ${task.type}`,
                    due: 'Pending',
                  }
                  return (
                    <div
                      key={task._id}
                      className='flex items-center gap-4 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'
                    >
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-base font-medium text-atria-text-muted'>
                          {meta.label}
                        </p>
                      </div>
                      <span className='rounded-full bg-atria-surface-3 px-3 py-1 text-xs font-medium text-atria-text-muted'>
                        Skipped
                      </span>
                      <Button
                        variant='secondary'
                        size='sm'
                        onClick={() => navigate(getTaskRoute(task, hasTrainingProduct))}
                      >
                        Upload now
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <p className='mt-4 text-center text-sm text-atria-text-secondary'>
            Need help?{' '}
            <a href='mailto:recruiting@atriax.example' className='text-atria-accent hover:underline'>
              Contact your recruiter →
            </a>
          </p>
        </CardContent>
      </Card>
      <SignedInApplyFlowBranding />
    </div>
  )
}
