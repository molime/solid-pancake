import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { Checkbox } from '@/shared/ui/Checkbox'
import { cn } from '@/shared/lib/cn'

const TRAINING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to ATRIA-X',
    duration: '3 min',
    body: [
      'ATRIA-X is the platform trusted by home care agencies to schedule shifts, document care, and stay compliant.',
      'As a caregiver, you will use ATRIA-X to view your assigned shifts, clock in and out, complete shift notes, and upload required documents.',
      'Everything you do in ATRIA-X is tied to a client record. Always make sure you are clocked into the correct shift and that your notes are accurate.',
      'Your coordinator can see your availability, assigned shifts, and documentation in real time. Communication about schedule changes should stay inside the app.',
      'Complete this short training so you can start working safely and confidently.',
    ],
    minReadSeconds: 20,
  },
  {
    id: 'shifts',
    title: 'Shifts, clock-in \u0026 clock-out',
    duration: '4 min',
    body: [
      'You will receive shift assignments based on your availability. Each shift shows the client, address, start/end time, and any special instructions.',
      'When you arrive at the shift location, open the app and tap Clock In. Some agencies require location services to verify you are on-site.',
      'At the end of the shift, tap Clock Out. You cannot clock out before the scheduled end time unless your coordinator approves an early release.',
      'If you are running late or cannot make a shift, message your coordinator as early as possible. Do not text the client directly.',
      'Always follow the care plan and any risk flags shown on the shift detail screen.',
    ],
    minReadSeconds: 20,
  },
  {
    id: 'documentation',
    title: 'Documenting care',
    duration: '5 min',
    body: [
      'After every shift, you must submit a progress note. Notes should describe the services provided, the client response, and any issues or concerns.',
      'Use the When, What, How, Goal framework shown in the note form. Be specific and objective. Avoid opinions or personal details.',
      'If a shift task requires proof, such as a photo or signature, the app will prompt you before you can submit the note.',
      'Notes must be submitted before billing can begin. Unsubmitted shifts delay payroll and may affect client authorization hours.',
      'Your coordinator will review notes and may request corrections. You will be notified when a note needs editing.',
    ],
    minReadSeconds: 20,
  },
  {
    id: 'compliance',
    title: 'Documents \u0026 compliance',
    duration: '3 min',
    body: [
      'Keep your CPR certificate, driver license, and any required credentials current. The app will remind you before documents expire.',
      'Upload documents through the onboarding checklist or your profile. Only JPG, PNG, WebP, and PDF files under 10 MB are accepted.',
      'Never share client photos, health records, or personal information outside of ATRIA-X. This is a strict privacy rule.',
      'Background checks and references are required by most agencies. Completing them is part of onboarding.',
      'If you have questions about compliance, contact your coordinator or recruiting team.',
    ],
    minReadSeconds: 20,
  },
  {
    id: 'help',
    title: 'Getting help',
    duration: '2 min',
    body: [
      'If the app is not working as expected, first check that you are signed into the correct organization and that your internet connection is stable.',
      'For shift-related questions, contact your assigned coordinator through the app.',
      'For onboarding or compliance questions, email recruiting@atriax.example or call the support number provided by your agency.',
      'Never ignore an error that prevents you from clocking in, submitting a note, or uploading a document. Report it immediately.',
      'Thank you for completing training. Tap the checkbox and finish below to record your completion.',
    ],
    minReadSeconds: 20,
  },
]

function StepView({
  step,
  onComplete,
  isLast,
  isSubmitting,
}: {
  step: (typeof TRAINING_STEPS)[0]
  onComplete: () => void
  isLast: boolean
  isSubmitting: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(step.minReadSeconds)

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

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

  return (
    <>
      <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>{step.title}</h1>
      <p className='mb-6 text-base text-atria-text-secondary'>Estimated read time: {step.duration}</p>

      <div
        ref={scrollRef}
        className='mb-4 max-h-[360px] overflow-y-auto rounded-[var(--radius-atria-md)] border border-atria-success/20 bg-atria-success/5 p-6'
      >
        {step.body.map((paragraph, idx) => (
          <p key={idx} className='mb-4 text-sm leading-relaxed text-atria-text-secondary last:mb-0'>
            {paragraph}
          </p>
        ))}
      </div>

      <div className='mb-4 flex items-center justify-between'>
        {!scrolledToBottom && (
          <p className='text-sm text-atria-warning'>Scroll to read the full section.</p>
        )}
        {scrolledToBottom && secondsRemaining > 0 && (
          <p className='text-sm text-atria-text-secondary'>{secondsRemaining} seconds remaining</p>
        )}
        {scrolledToBottom && secondsRemaining === 0 && (
          <p className='text-sm text-atria-success'>Read ✓</p>
        )}
      </div>

      <label className='mb-6 flex cursor-pointer items-start gap-3'>
        <Checkbox
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className='mt-0.5 shrink-0'
        />
        <span className='text-sm text-atria-text-secondary'>
          I have read and understood this training section.
        </span>
      </label>

      <Button
        variant='primary'
        size='lg'
        className='w-full'
        disabled={!scrolledToBottom || !agreed || secondsRemaining > 0 || isSubmitting}
        onClick={onComplete}
      >
        {isSubmitting
          ? 'Saving...'
          : isLast
            ? 'Finish training'
            : 'Complete \u0026 continue'}
      </Button>
    </>
  )
}

export function TrainingPage() {
  const navigate = useNavigate()
  const { organization, isLoaded } = useOrganization()
  const clerkOrgId = organization?.id
  const completions = useQuery(api.platformTrainingCompletions.listMyCompletions, clerkOrgId ? { clerkOrgId } : 'skip')
  const completeTraining = useMutation(api.platformTrainingCompletions.completeForCandidate)

  const completionsList = completions as { trainingId: string }[] | undefined
  const completedIds = useMemo(
    () => new Set(completionsList?.map((c) => c.trainingId) ?? []),
    [completionsList],
  )

  const initialIndex = useMemo(() => {
    for (let i = 0; i < TRAINING_STEPS.length; i++) {
      if (!completedIds.has(TRAINING_STEPS[i].id)) return i
    }
    return 0
  }, [completedIds])

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const step = TRAINING_STEPS[currentIndex]
  const isLast = currentIndex === TRAINING_STEPS.length - 1

  if (!isLoaded || !clerkOrgId) return null

  const handleComplete = async () => {
    setIsSubmitting(true)
    await completeTraining({
      clerkOrgId,
      trainingId: step.id,
      completedAt: new Date().toISOString(),
      status: 'complete',
    })
    if (isLast) {
      navigate('/caregiver/today', { replace: true })
    } else {
      setCurrentIndex((i) => i + 1)
      setIsSubmitting(false)
    }
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[640px]'>
        <CardContent className='p-8'>
          <button
            className='mb-4 text-sm text-atria-text-secondary hover:text-atria-ink'
            onClick={() => navigate('/onboarding/checklist')}
          >
            {String.fromCharCode(8592)} Back to checklist
          </button>

          <div className='mb-6 flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-[var(--radius-atria-md)] bg-atria-accent text-atria-on-accent'>
              <span className='text-lg font-bold'>A</span>
            </div>
            <div className='flex-1'>
              <p className='text-lg font-semibold leading-none text-atria-ink'>ATRIA-X</p>
              <p className='text-sm text-atria-text-secondary'>Required Training</p>
            </div>
            <div className='text-right'>
              <p className='text-sm font-medium text-atria-ink'>
                {Math.min(currentIndex + 1, TRAINING_STEPS.length)} / {TRAINING_STEPS.length}
              </p>
            </div>
          </div>

          <div className='mb-4 flex flex-wrap gap-2'>
            {TRAINING_STEPS.map((s, idx) => (
              <div
                key={s.id}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  idx < currentIndex || completedIds.has(s.id)
                    ? 'bg-atria-accent'
                    : idx === currentIndex
                      ? 'bg-atria-warning'
                      : 'bg-atria-surface-3',
                )}
              />
            ))}
          </div>

          <StepView
            key={step.id}
            step={step}
            isLast={isLast}
            isSubmitting={isSubmitting}
            onComplete={handleComplete}
          />

          <p className='mt-4 text-center text-xs text-atria-text-muted'>
            Training completion is recorded securely and tied to your profile.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
