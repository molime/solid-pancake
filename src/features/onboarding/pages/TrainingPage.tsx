import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenant } from '@/app/useTenant'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { Checkbox } from '@/shared/ui/Checkbox'
import { cn } from '@/shared/lib/cn'
import {
  isPlatformTrainingComplete,
  COMPLETE_STATUSES,
  markTrainingCompletedInSession,
} from '@/features/onboarding/model/trainingCompletion'

type TrainingStep = {
  id: string
  title: string
  type: 'text' | 'video' | 'image' | 'policy' | 'quiz'
  content: string
  caption?: string
  minDurationSec?: number
  required: boolean
}

type QuizQuestion = {
  question: string
  options: string[]
  correct: number
}

const STEP_ICONS: Record<string, string> = {
  welcome: '👋',
  org_structure: '🏢',
  role_of_staff: '👥',
  consumer_rights: '🛡️',
  policies_conduct: '📜',
  medication_procedures: '💊',
  emergency_procedures: '🚨',
  quiz: '🎯',
}

const STEP_COLORS: Record<string, string> = {
  welcome: 'atria-accent',
  org_structure: 'atria-info',
  role_of_staff: 'atria-step-what',
  consumer_rights: 'atria-step-goal',
  policies_conduct: 'atria-warning',
  medication_procedures: 'atria-step-when',
  emergency_procedures: 'atria-danger',
  quiz: 'atria-accent',
}

const CONFETTI_COLORS = ['#16a34a', '#f0b429', '#4d8df6', '#a855f7', '#f0564a']
const CONFETTI_PIECES = Array.from({ length: 20 }, (_, i) => ({
  left: (i * 37) % 100,
  color: CONFETTI_COLORS[i % 5],
  delay: (i * 0.07) % 0.5,
}))

function parseQuiz(content: string): QuizQuestion[] {
  try {
    return JSON.parse(content).questions ?? []
  } catch {
    return []
  }
}



function InteractiveContent({
  step,
  scrollRef,
  setScrolledToBottom,
}: {
  step: TrainingStep
  scrollRef: React.RefObject<HTMLDivElement | null>
  setScrolledToBottom: (v: boolean) => void
}) {
  const blocks = step.content.split('\n\n').filter((b) => b.trim())
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())

  const toggleCard = (i: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      // If all cards are expanded, mark as "read"
      if (next.size === blocks.length) {
        setScrolledToBottom(true)
      }
      return next
    })
  }

  const allExpanded = expandedCards.size === blocks.length

  return (
    <div
      ref={scrollRef}
      className='mb-4 max-h-[380px] overflow-y-auto rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'
    >
      {blocks.map((block, i) => {
        const trimmed = block.trim()
        const isHeading = /^[A-Z][A-Z\s]{2,}:/.test(trimmed) || /^\d+\./.test(trimmed)
        const isBullet = trimmed.startsWith('- ')
        const isExpanded = expandedCards.has(i)
        const headingMatch = trimmed.match(/^([A-Z][A-Z\s]{2,}:)/)
        const heading = headingMatch ? headingMatch[1].trim() : isHeading ? trimmed.split('.')[0] + '.' : null
        const body = headingMatch ? trimmed.substring(headingMatch[0].length).trim() : heading ? trimmed.substring(heading.length).trim() : trimmed

        return (
          <div
            key={i}
            className={cn(
              'training-animate-fade-up mb-2 rounded-[var(--radius-atria-md)] border transition-all duration-300 cursor-pointer',
              isExpanded ? 'border-atria-accent/40 bg-atria-surface' : 'border-atria-border bg-atria-surface-2 hover:border-atria-border-strong',
            )}
            style={{ animationDelay: `${Math.min(i * 0.06, 0.3)}s`, opacity: 0 }}
            onClick={() => toggleCard(i)}
          >
            <div className='flex items-start gap-3 p-3'>
              <div
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs transition-all duration-300',
                  isExpanded ? 'bg-atria-accent text-white' : 'bg-atria-surface-3 text-atria-text-muted',
                )}
              >
                {isExpanded ? '✓' : i + 1}
              </div>
              <div className='flex-1'>
                {heading && (
                  <p className='mb-1 text-sm font-bold text-atria-ink'>{heading}</p>
                )}
                {isExpanded ? (
                  <div className='training-animate-fade-up'>
                    {isBullet ? (
                      <ul className='space-y-1.5'>
                        {body.split('\n').map((item, j) => (
                          <li key={j} className='flex items-start gap-2 text-sm leading-relaxed text-atria-text-secondary'>
                            <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-atria-accent' />
                            {item.replace(/^- /, '').trim()}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className='text-sm leading-relaxed text-atria-text-secondary'>{body}</p>
                    )}
                  </div>
                ) : (
                  <p className='text-sm text-atria-text-muted'>
                    {isBullet ? `${body.split('\n').length} key points` : `${body.substring(0, 60)}...`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {allExpanded && (
        <div className='training-animate-bounce-in mt-3 flex items-center gap-2 rounded-[var(--radius-atria-md)] border border-atria-success/30 bg-atria-success-bg p-3'>
          <span className='text-lg'>🎉</span>
          <p className='text-sm font-medium text-atria-success'>All sections reviewed! Tap the checkbox below to continue.</p>
        </div>
      )}

      {step.id === 'welcome' && (
        <KeyTakeaway icon='🎯'>
          Our goal is to assist individuals with intellectual disabilities in achieving their aspired goals and promote their self-esteem.
        </KeyTakeaway>
      )}
      {step.id === 'org_structure' && (
        <KeyTakeaway icon='🏢'>
          ILS = customized instruction at the participant own pace. SLS = assistance with life skills for independent living.
        </KeyTakeaway>
      )}
      {step.id === 'role_of_staff' && (
        <KeyTakeaway icon='👥'>
          You are the eyes and ears of the team. ADLs are one of your biggest responsibilities.
        </KeyTakeaway>
      )}
      {step.id === 'medication_procedures' && (
        <KeyTakeaway icon='💊'>
          Always check the 5 rights: right medication, dose, time, route, and individual. Document everything.
        </KeyTakeaway>
      )}
      {step.id === 'emergency_procedures' && (
        <KeyTakeaway icon='🚨'>
          In any emergency: ensure consumer safety first, call 911 if needed, then notify the Program Director.
        </KeyTakeaway>
      )}
    </div>
  )
}

function KeyTakeaway({ children, icon = '💡' }: { children: React.ReactNode; icon?: string }) {
  return (
    <div className='training-animate-fade-up mb-4 rounded-[var(--radius-atria-md)] border border-atria-warning/30 bg-atria-warning-bg p-4' style={{ opacity: 0, animationDelay: '0.3s' }}>
      <div className='flex items-start gap-3'>
        <span className='text-xl'>{icon}</span>
        <div>
          <p className='mb-1 text-xs font-bold uppercase tracking-wide text-atria-warning'>Key Takeaway</p>
          <p className='text-sm text-atria-ink'>{children}</p>
        </div>
      </div>
    </div>
  )
}

function ImageWalkthrough({ step }: { step: TrainingStep }) {
  const [hotspotIndex, setHotspotIndex] = useState(0)
  const hotspots: { label: string; desc: string }[] = [
    { label: 'Clock In Button', desc: 'When you arrive at your shift, tap this green button to clock in. Your start time is recorded automatically.' },
    { label: 'Your Status', desc: 'After clocking in, your status changes to “On Shift” so your coordinator knows you have arrived.' },
    { label: 'Clock Out Button', desc: 'At the end of your shift, tap this button to clock out. Your hours are calculated and sent for approval.' },
  ]
  const current = hotspots[hotspotIndex]
  const isLast = hotspotIndex === hotspots.length - 1

  return (
    <div className='mb-6'>
      <div className='relative overflow-hidden rounded-[var(--radius-atria-md)] border border-atria-border'>
        <img
          src={hotspotIndex < 2 ? '/training/clock-in.png' : '/training/clock-out.png'}
          alt={step.title}
          className='max-h-[320px] w-full object-contain bg-atria-surface-2'
        />
        <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'>
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full text-2xl transition-all duration-300',
              hotspotIndex === 0 && 'training-animate-pulse-ring bg-atria-accent/80 text-white',
              hotspotIndex > 0 && 'bg-atria-success/60 text-white scale-75',
            )}
          >
            {hotspotIndex === 0 ? '👉' : '✅'}
          </div>
        </div>
        <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-atria-bg/95 to-transparent p-4'>
          <div className='training-animate-bounce-in rounded-[var(--radius-atria-md)] border border-atria-accent/30 bg-atria-surface/90 p-3'>
            <p className='mb-1 text-xs font-bold uppercase tracking-wide text-atria-accent'>{current.label}</p>
            <p className='text-sm text-atria-ink'>{current.desc}</p>
          </div>
        </div>
      </div>
      <div className='mt-3 flex items-center justify-between'>
        <div className='flex gap-1.5'>
          {hotspots.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === hotspotIndex ? 'w-8 bg-atria-accent' : i < hotspotIndex ? 'w-2 bg-atria-success' : 'w-2 bg-atria-surface-3',
              )}
            />
          ))}
        </div>
        {!isLast ? (
          <Button variant='secondary' size='sm' onClick={() => setHotspotIndex((i) => i + 1)}>
            Next highlight →
          </Button>
        ) : (
          <span className='text-sm font-medium text-atria-success'>✅ All highlights shown</span>
        )}
      </div>
    </div>
  )
}

function StepView({
  step,
  onComplete,
  isLast,
  isSubmitting,
  quizPassThreshold,
  stepIndex,
  totalSteps,
}: {
  step: TrainingStep
  onComplete: () => void
  isLast: boolean
  isSubmitting: boolean
  quizPassThreshold: number
  stepIndex: number
  totalSteps: number
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(step.minDurationSec ?? 0)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [answerFeedback, setAnswerFeedback] = useState<{ correct: boolean; index: number } | null>(null)
  const [quizStreak, setQuizStreak] = useState(0)

  const stepIcon = STEP_ICONS[step.id] ?? '📚'
  const stepColor = STEP_COLORS[step.id] ?? 'atria-accent'

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [step])

  // Scroll enforcement handled by InteractiveContent for text/policy steps.
  // The old scroll listener is removed to prevent bypassing the card expansion.

  const quizQuestions = step.type === 'quiz' ? parseQuiz(step.content) : []

  const handleQuizAnswer = (qi: number, oi: number) => {
    if (answerFeedback) return
    const next = [...quizAnswers]
    next[qi] = oi
    setQuizAnswers(next)
    const isCorrect = oi === quizQuestions[qi].correct
    setAnswerFeedback({ correct: isCorrect, index: oi })
    if (isCorrect) {
      setQuizStreak((s) => s + 1)
    } else {
      setQuizStreak(0)
    }
  }

  const handleNextQuestion = () => {
    setAnswerFeedback(null)
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion((q) => q + 1)
    } else {
      const total = quizQuestions.length
      const correct = quizQuestions.filter((q, i) => quizAnswers[i] === q.correct).length
      const score = Math.round((correct / total) * 100)
      const passed = score >= quizPassThreshold
      setQuizResult({ score, passed })
      if (passed) {
        setShowConfetti(true)
        onComplete()
      }
    }
  }

  const needsScrollEnforcement = step.type === 'text' || step.type === 'policy'
  const canProceed =
    step.type === 'quiz'
      ? quizAnswers.length === quizQuestions.length
      : needsScrollEnforcement
        ? scrolledToBottom && agreed && secondsRemaining === 0
        : true

  const quizProgress = quizQuestions.length > 0
    ? Math.round(((currentQuestion + (answerFeedback ? 1 : 0)) / quizQuestions.length) * 100)
    : 0

  return (
    <>
      <div className='training-animate-bounce-in mb-2 flex items-center gap-3'>
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-[var(--radius-atria-md)] text-2xl',
            stepColor === 'atria-accent' && 'bg-atria-accent/20',
            stepColor === 'atria-info' && 'bg-atria-info-bg',
            stepColor === 'atria-step-what' && 'bg-purple-500/20',
            stepColor === 'atria-step-goal' && 'bg-teal-500/20',
            stepColor === 'atria-warning' && 'bg-atria-warning-bg',
            stepColor === 'atria-step-when' && 'bg-blue-500/20',
            stepColor === 'atria-danger' && 'bg-atria-danger-bg',
          )}
        >
          {stepIcon}
        </div>
        <div className='flex-1'>
          <p className='text-xs font-medium uppercase tracking-wide text-atria-text-muted'>
            Module {stepIndex + 1} of {totalSteps}
          </p>
          <h1 className='text-xl font-bold text-atria-ink'>{step.title}</h1>
        </div>
      </div>

      {step.type === 'quiz' && (
        <div className='training-animate-fade-up mb-4 rounded-[var(--radius-atria-md)] border border-atria-warning/40 bg-atria-warning-bg p-3' style={{ opacity: 0, animationDelay: '0.1s' }}>
          <div className='flex items-center gap-2'>
            <span className='text-lg'>⚠️</span>
            <p className='text-sm font-medium text-atria-warning'>
              You must score at least {quizPassThreshold}% to pass. You can retake this quiz as many times as needed.
            </p>
          </div>
        </div>
      )}

      {(step.type === 'text' || step.type === 'policy') && (
        <div className='training-animate-fade-up mb-3 rounded-[var(--radius-atria-md)] border border-atria-info/30 bg-atria-info-bg p-3' style={{ opacity: 0, animationDelay: '0.05s' }}>
          <div className='flex items-center gap-2'>
            <span className='text-lg training-animate-float'>👆</span>
            <p className='text-sm font-medium text-atria-info'>Tap each card below to reveal the content. Expand all cards to continue.</p>
          </div>
        </div>
      )}

      {(step.type === 'text' || step.type === 'policy') && (
        <InteractiveContent step={step} scrollRef={scrollRef} setScrolledToBottom={setScrolledToBottom} />
      )}

      {step.type === 'video' && (
        <div className='mb-6 aspect-video overflow-hidden rounded-[var(--radius-atria-md)] border border-atria-border'>
          <iframe
            src={step.content}
            title={step.title}
            className='h-full w-full'
            allowFullScreen
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
          />
        </div>
      )}

      {step.type === 'image' && (
        <ImageWalkthrough step={step} />
      )}

      {step.type === 'quiz' && !quizResult && (
        <div className='mb-4'>
          <div className='mb-3 flex items-center gap-3'>
            <div className='h-2 flex-1 overflow-hidden rounded-full bg-atria-surface-3'>
              <div
                className='h-full rounded-full bg-atria-accent transition-all duration-500'
                style={{ width: `${quizProgress}%` }}
              />
            </div>
            {quizStreak > 1 && (
              <div className='training-animate-streak-glow flex items-center gap-1 rounded-full bg-atria-warning/20 px-3 py-1'>
                <span className='text-sm'>🔥</span>
                <span className='text-xs font-bold text-atria-warning'>{quizStreak}x streak!</span>
              </div>
            )}
          </div>
          <p className='mb-3 text-xs font-medium text-atria-text-muted'>
            Question {currentQuestion + 1} of {quizQuestions.length}
          </p>
          <div key={currentQuestion} className='training-animate-slide-in rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-5'>
            <p className='mb-4 text-sm font-semibold text-atria-ink'>
              {quizQuestions[currentQuestion]?.question}
            </p>
            <div className='flex flex-col gap-2'>
              {quizQuestions[currentQuestion]?.options.map((opt, oi) => {
                const isSelected = answerFeedback?.index === oi
                const isCorrect = oi === quizQuestions[currentQuestion].correct
                const showResult = answerFeedback !== null
                return (
                  <button
                    key={oi}
                    type='button'
                    disabled={showResult}
                    onClick={() => handleQuizAnswer(currentQuestion, oi)}
                    className={cn(
                      'flex items-center gap-3 rounded-[var(--radius-atria-md)] border p-3 text-left text-sm transition-all',
                      !showResult && quizAnswers[currentQuestion] === oi && 'border-atria-accent bg-atria-accent-quiet text-atria-ink',
                      !showResult && quizAnswers[currentQuestion] !== oi && 'border-atria-border bg-atria-surface text-atria-text-secondary hover:bg-atria-surface-3',
                      showResult && isCorrect && 'border-atria-success bg-atria-success-bg text-atria-ink training-animate-pop',
                      showResult && isSelected && !isCorrect && 'border-atria-danger bg-atria-danger-bg text-atria-ink training-animate-shake',
                      showResult && !isCorrect && !isSelected && 'border-atria-border bg-atria-surface opacity-50',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs',
                        !showResult && quizAnswers[currentQuestion] === oi && 'border-atria-accent bg-atria-accent text-white',
                        !showResult && quizAnswers[currentQuestion] !== oi && 'border-atria-border',
                        showResult && isCorrect && 'border-atria-success bg-atria-success text-white',
                        showResult && isSelected && !isCorrect && 'border-atria-danger bg-atria-danger text-white',
                        showResult && !isCorrect && !isSelected && 'border-atria-border',
                      )}
                    >
                      {showResult && isCorrect && '✓'}
                      {showResult && isSelected && !isCorrect && '✗'}
                      {!showResult && quizAnswers[currentQuestion] === oi && (
                        <svg className='h-3 w-3 text-white' viewBox='0 0 24 24' fill='currentColor' aria-hidden>
                          <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' />
                        </svg>
                      )}
                    </div>
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
          {answerFeedback && (
            <div className='mt-3'>
              {answerFeedback.correct ? (
                <div className='training-animate-bounce-in flex items-center gap-2 rounded-[var(--radius-atria-md)] border border-atria-success/30 bg-atria-success-bg p-3'>
                  <span className='text-lg'>🎉</span>
                  <p className='text-sm font-medium text-atria-success'>Correct! Great job!</p>
                </div>
              ) : (
                <div className='training-animate-bounce-in flex items-center gap-2 rounded-[var(--radius-atria-md)] border border-atria-danger/30 bg-atria-danger-bg p-3'>
                  <span className='text-lg'>💦</span>
                  <p className='text-sm font-medium text-atria-danger'>Not quite. The correct answer is highlighted in green.</p>
                </div>
              )}
              <Button
                variant='primary'
                size='lg'
                className='mt-3 w-full'
                onClick={handleNextQuestion}
              >
                {currentQuestion < quizQuestions.length - 1 ? 'Next question →' : 'See my score →'}
              </Button>
            </div>
          )}
        </div>
      )}

      {step.type === 'quiz' && quizResult && (
        <div className='relative mb-4 text-center'>
          {showConfetti && (
            <div className='pointer-events-none absolute inset-0 overflow-hidden'>
              {CONFETTI_PIECES.map((piece, i) => (
                <div
                  key={i}
                  className='training-confetti'
                  style={{
                    left: `${piece.left}%`,
                    top: '0%',
                    backgroundColor: piece.color,
                    animationDelay: `${piece.delay}s`,
                  }}
                />
              ))}
            </div>
          )}
          {quizResult.passed ? (
            <>
              <div className='training-animate-star-burst mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-atria-success text-white'>
                <span className='text-4xl'>🎉</span>
              </div>
              <h2 className='training-animate-fade-up mb-2 text-xl font-bold text-atria-ink' style={{ opacity: 0, animationDelay: '0.2s' }}>
                Quiz passed! You scored {quizResult.score}%
              </h2>
              <p className='training-animate-fade-up text-sm text-atria-text-secondary' style={{ opacity: 0, animationDelay: '0.3s' }}>
                You answered {quizQuestions.filter((q, i) => quizAnswers[i] === q.correct).length} out of {quizQuestions.length} correctly.
              </p>
            </>
          ) : (
            <div className='rounded-[var(--radius-atria-md)] border border-atria-danger/30 bg-atria-danger-bg p-6'>
              <div className='mb-2 text-4xl'>💪</div>
              <h2 className='mb-2 text-xl font-bold text-atria-danger'>You scored {quizResult.score}%</h2>
              <p className='mb-4 text-sm text-atria-text-secondary'>
                You need at least {quizPassThreshold}% to pass. Review the training and try again!
              </p>
              <Button
                variant='secondary'
                size='lg'
                onClick={() => {
                  setQuizAnswers([])
                  setQuizResult(null)
                  setCurrentQuestion(0)
                  setShowConfetti(false)
                  setAnswerFeedback(null)
                  setQuizStreak(0)
                }}
              >
                Retake quiz
              </Button>
            </div>
          )}
        </div>
      )}

      {(step.type === 'text' || step.type === 'policy') && (
        <>
          <div className='mb-4 flex items-center justify-between'>
            {!scrolledToBottom && (
              <p className='text-sm text-atria-warning'>
                {secondsRemaining > 0 ? `${secondsRemaining}s — tap all cards to continue` : 'Expand all cards to continue'}
              </p>
            )}
            {scrolledToBottom && secondsRemaining > 0 && (
              <p className='text-sm text-atria-text-secondary'>⏳ {secondsRemaining}s remaining</p>
            )}
            {scrolledToBottom && secondsRemaining === 0 && (
              <p className='training-animate-pop text-sm font-medium text-atria-success'>✓ All cards reviewed!</p>
            )}
          </div>

          <label className='mb-6 flex cursor-pointer items-start gap-3'>
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className='mt-0.5 shrink-0'
            />
            <span className='text-sm text-atria-text-secondary'>
              I have read and understood this section.
            </span>
          </label>
        </>
      )}

      {step.type !== 'quiz' && (
        <Button
          variant='primary'
          size='lg'
          className={cn('w-full', canProceed && !isSubmitting && 'training-animate-glow')}
          disabled={!canProceed || isSubmitting}
          onClick={onComplete}
        >
          {isSubmitting
            ? 'Saving...'
            : isLast
              ? '🎉 Finish training'
              : 'Complete & continue →'}
        </Button>
      )}
    </>
  )
}

const DEFAULT_STEPS: TrainingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Individuals Choice',
    type: 'text',
    content: 'Welcome to Individuals Choice, Inc! We are a vendor of the San Andreas Regional Center, providing health services to our consumers to improve their lifestyle and life quality.\n\nOur goal is to assist individuals with intellectual disabilities in achieving their aspired goals and promote their self-esteem by providing assistance in training, care, and supervision in daily living activities.\n\nOur mission is grounded on consumer choices, individualized services, and support — a partnership and collaboration of formal and natural supports.',
    minDurationSec: 10,
    required: true,
  },
  {
    id: 'org_structure',
    title: 'Organizational Structure',
    type: 'text',
    content: 'Individuals Choice, Inc operates two main programs.\n\n1. Independent Living Services (ILS): Customized instruction designed to meet the participant\'s needs, choices, and functional abilities. Planned to develop knowledge of specific tasks and learn at their own speed.\n\n2. Supported Living Services (SLS): Designed to assist with life skills such as budgeting, interpersonal and social skills, looking for employment, interviewing skills, general transportation, active life, and assistance with personal care.\n\nThe range of supported living services includes: assessment of consumer needs, assistance in finding and maintaining a home, facilitating circles of support, 24-hour emergency response system, social and daily living skills development, hiring and training of support staff, and development of work.',
    minDurationSec: 10,
    required: true,
  },
  {
    id: 'role_of_staff',
    title: 'Your Role as Support Staff',
    type: 'text',
    content: 'As a support staff member, you are the eyes and ears of the team. Your key responsibilities include:\n\n- Observing and reporting changes or any atypical observations about a consumer\'s condition\n- Performing assigned tasks as outlined in the consumer\'s support plan\n- Assisting with Activities of Daily Living (ADLs) — one of your main responsibilities (bathing, caring for skin/hair/teeth, toileting, walking, etc.)\n- Supporting consumers as they progress toward their life goals\n- Promoting practices that keep individuals healthy and safe\n\nWhile the consumer\'s support plan is created by the support coordinator and program director, input from all care team members is needed and valued.\n\nExpected qualities: dedicated, creative, honest, flexible, perceptive, empathetic, cheerful, patient, tactful, respectful, adaptable, hardworking, a good communicator, a good listener, compassionate, and reliable.',
    minDurationSec: 10,
    required: true,
  },
  {
    id: 'consumer_rights',
    title: 'Consumer Rights & Professional Boundaries',
    type: 'policy',
    content: 'CONSUMER RIGHTS: Every consumer has the right to be treated with consideration, respect, and full recognition of their dignity. Consumers shall receive treatment and services that are adequate, appropriate, and in compliance with federal and state laws. This includes respect for privacy, confidential treatment of records, freedom from discrimination and abuse, participation in the development of their care plan, and the right to refuse treatment after being fully informed.\n\nPROFESSIONAL BOUNDARIES: Maintain a positive, helpful relationship with consumers. Do not share personal information or use the consumer as a confidant. Keep the relationship supportive, not social. Be aware of consumer behavior in case of a disease or disorder. In case of a negative reaction, step back and re-approach later when calm. Use touch only when it serves a good purpose. Avoid terms the consumer may misconstrue. Practice good personal hygiene, dress professionally, and avoid off-color jokes, racial slurs, and profanity.\n\nHIPAA: Every employee must abide by confidentiality laws governing access, use, and dissemination of consumer information. You will sign a consent form to authorize the release of any information.',
    minDurationSec: 10,
    required: true,
  },
  {
    id: 'policies_conduct',
    title: 'Policies & Code of Conduct',
    type: 'policy',
    content: 'ZERO-TOLERANCE POLICIES: Individuals Choice, Inc maintains zero-tolerance for sexual harassment (unwelcome touching, comments about appearance, displaying inappropriate images), drugs (use of illegal substances on duty), and retaliation.\n\nCOMPLIANCE: All employees must comply with program rules, policies, and local, state, and federal laws. All employees are screened for criminal conviction before working with consumers. Unlawful or unethical behavior that harms the agency\'s reputation will not be permitted.\n\nCONFLICT OF INTEREST: Do not accept, offer, or give gifts or gratuities to or from consumers. Put the program\'s interests before your own. Do not borrow money from consumers or their family members. Do not accept additional private pay work from them.\n\nCONSEQUENCES: Violating the code of conduct may result in disciplinary action, termination of employment contract, and civil/criminal charges.\n\nCAUSES FOR TERMINATION: Use of drugs/alcohol on duty, physical force or abuse, threatening behavior, insubordination, neglect or abandoning a consumer, failure to report incidents, theft, no call/no show (automatic termination), and falsifying documentation.',
    minDurationSec: 10,
    required: true,
  },
  {
    id: 'medication_procedures',
    title: 'Medication Procedures',
    type: 'text',
    content: 'STORAGE: All medications (prescribed and OTC) are kept in a safe, centrally located, locked site accessible only to DSPs. Some individuals may keep medication in a locked space in their room if their physician has approved. Refrigerated medications are kept in a locked container. All medication is stored in its original container with original prescription labels.\n\nADMINISTRATION GUIDELINES: (1) Wash hands and wear gloves. (2) Remove medication from locked storage. (3) Check right medication, dose, time, route, and individual. (4) Give medication with water. (5) Watch the individual swallow. (6) Return container to locked storage.\n\nREFUSAL OR ERROR: If a consumer refuses medication or an error occurs, immediately notify the physician, page the program director, and document the incident. The program director files a written incident report to SARC within 24 hours.\n\nPRN MEDICATIONS: Contact the physician before each dose, describe symptoms, get permission, and document everything including physician directions and the individual\'s response within 1 hour.',
    minDurationSec: 10,
    required: true,
  },
  {
    id: 'emergency_procedures',
    title: 'Emergency Procedures',
    type: 'text',
    content: 'FIRE: (1) Sound the alarm. (2) Get everyone out. (3) Follow escape routes. (4) Crawl if caught in smoke. (5) Test doors with the back of your hand. (6) Meet at a pre-arranged safe place. (7) Do a head count. (8) Lead staff calls 911. (9) Fire department directs all activity once on site.\n\nEARTHQUAKE (INDOORS): Drop, cover, and hold. Get under doorways, beds, tables, or desks. Protect your head. Stay away from windows and anything that could topple.\n\nEARTHQUAKE (OUTDOORS): Move away from buildings, trees, and electrical lines. Drop to the ground until shaking stops.\n\nFLOOD (INTERNAL): Notify program director, shut main water valve, shut electricity/gas if needed, evacuate consumers if necessary.\n\nFLOOD (EXTERNAL): Notify program director, secure doors with blankets and sandbags, move consumers to higher ground.\n\nDISASTER KIT: Keep a 3-day supply of non-perishable food and water (1 gallon/person/day), first aid kit with prescription medications, flashlight and radio with extra batteries, change of clothing, sanitation supplies, and special medical supplies.\n\nMEDICAL EMERGENCY: Call 911 immediately, then report to support coordinator and program director.',
    minDurationSec: 10,
    required: true,
  },

  {
    id: 'clockin_flow',
    title: 'Clock In & Clock Out',
    type: 'image',
    content: '/training/clock-in.png',
    caption: 'When you arrive at a shift, tap Clock In. At the end, tap Clock Out. The app records your time automatically.',
    minDurationSec: 5,
    required: true,
  },
  {
    id: 'quiz',
    title: 'Knowledge Check',
    type: 'quiz',
    content: JSON.stringify({"questions": [{"question": "What is the primary mission of Individuals Choice, Inc?", "options": ["To provide medical treatment to consumers", "To assist individuals with intellectual disabilities in achieving their goals and promote self-esteem", "To operate a residential care facility", "To provide transportation services only"], "correct": 1}, {"question": "What does ILS stand for?", "options": ["Independent Living Services", "Integrated Life Support", "Individualized Learning System", "Inclusive Lifestyle Services"], "correct": 0}, {"question": "What is one of the main responsibilities of support staff?", "options": ["Creating consumer support plans independently", "Prescribing medications to consumers", "Assisting with Activities of Daily Living (ADLs)", "Managing the agency finances"], "correct": 2}, {"question": "Which of the following is an expected quality of a support staff?", "options": ["Assertive and dominant", "Compassionate and reliable", "Introverted and quiet", "Competitive and ambitious"], "correct": 1}, {"question": "What should you do if a consumer refuses medication?", "options": ["Force them to take it", "Skip the dose and say nothing", "Notify the physician immediately and document the incident", "Wait an hour and try again without telling anyone"], "correct": 2}, {"question": "Where should all medications be stored?", "options": ["In the consumer bedroom drawer", "In a safe, centrally located, locked site accessible only to DSPs", "In the bathroom cabinet", "In the kitchen on the counter"], "correct": 1}, {"question": "What is the first thing you should do in a fire emergency?", "options": ["Call your supervisor", "Pack your belongings", "Sound the alarm and get everyone out of the house", "Try to put out the fire yourself"], "correct": 2}, {"question": "During an earthquake while indoors, what should you do?", "options": ["Run outside immediately", "Drop, cover, and hold -- get under a table or desk", "Stand in a doorway and wait", "Get in your car and drive away"], "correct": 1}, {"question": "What is the policy on accepting gifts from consumers?", "options": ["Gifts are accepted if under $25", "Gifts are accepted during holidays only", "Do not accept, offer, or give gifts or gratuities to or from consumers", "Gifts are accepted if the consumer insists"], "correct": 2}, {"question": "How often are employees evaluated on their work performance?", "options": ["Every 30 days", "Every 6 months", "Annually", "Only during probation"], "correct": 2}]}),
    minDurationSec: 0,
    required: true,
  },
]

export function TrainingPage() {
  const navigate = useNavigate()
  const { clerkOrgId, isLoading } = useTenant()
  const completions = useQuery(api.platformTrainingCompletions.listMyCompletions, clerkOrgId ? { clerkOrgId } : 'skip')
  const completeTraining = useMutation(api.platformTrainingCompletions.completeForCandidate)
  const hasFullPlatform = useQuery(
    api.agencyConfig.hasProduct,
    clerkOrgId ? { clerkOrgId, productKey: 'full_platform' } : 'skip',
  )
  const trainingConfig = useQuery(
    api.agencyConfig.getTrainingConfig,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const steps = useMemo<TrainingStep[]>(() => {
    if (trainingConfig?.steps?.length) {
      return trainingConfig.steps as TrainingStep[]
    }
    return DEFAULT_STEPS
  }, [trainingConfig])

  const passingScore = trainingConfig?.passingScore ?? 70

  const completedIds = useMemo(() => {
    const ids = new Set<string>()
    completions?.forEach((c) => {
      if (isPlatformTrainingComplete([c]) || COMPLETE_STATUSES.includes(c.status)) {
        ids.add(c.trainingId)
      }
    })
    return ids
  }, [completions])

  const initialIndex = useMemo(() => {
    for (let i = 0; i < steps.length; i++) {
      if (!completedIds.has(steps[i].id)) return i
    }
    return 0
  }, [completedIds, steps])

  const [currentIndex, setCurrentIndex] = useState(() => {
    // Persist the step index in sessionStorage so the user doesn't lose
    // their place when a Clerk token refresh unmounts/remounts the page.
    const stored = typeof window !== 'undefined'
      ? window.sessionStorage.getItem('atria.training.stepIndex')
      : null
    const parsed = stored !== null ? parseInt(stored, 10) : NaN
    return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, steps.length - 1) : initialIndex
  })
  // After the user starts training, don't let the index jump back
  // when completions briefly refetches and becomes undefined
  const hasStarted = useRef(false)
  useEffect(() => {
    hasStarted.current = true
  }, [])
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('atria.training.stepIndex', String(currentIndex))
    }
  }, [currentIndex])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const step = steps[currentIndex]
  const isLast = currentIndex === steps.length - 1

  if (!step) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-atria-bg'>
        <div className='text-center'>
          <div className='mb-3 text-4xl'>🎉</div>
          <p className='text-sm text-atria-text-secondary'>Loading training...</p>
        </div>
      </div>
    )
  }
  const allTrainingComplete =
    completions !== undefined && completions !== null &&
    completions.length > 0 &&
    steps.every((s) => completedIds.has(s.id))

  if (allTrainingComplete) {
    markTrainingCompletedInSession()
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('atria.training.stepIndex')
    }
  }

  if (isLoading || !clerkOrgId) return null

  const handleComplete = async () => {
    setIsSubmitting(true)
    try {
      await completeTraining({
        clerkOrgId,
        trainingId: step.id,
        completedAt: new Date().toISOString(),
        status: 'complete',
      })
    } catch {
      setIsSubmitting(false)
      return
    }
    if (isLast) {
      setIsSubmitting(false)
    } else {
      setCurrentIndex((i) => i + 1)
      setIsSubmitting(false)
    }
  }

  const handleGoToDashboard = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('atria.training.stepIndex')
    }
    if (hasFullPlatform === false) {
      navigate('/onboarding/success', { replace: true })
    } else {
      navigate('/onboarding', { replace: true })
    }
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[640px]'>
        <CardContent className='p-8'>
          {allTrainingComplete ? (
            <button
              className='mb-4 text-sm text-atria-text-secondary hover:text-atria-ink'
              onClick={handleGoToDashboard}
            >
              {String.fromCharCode(8592)} Back to dashboard
            </button>
          ) : (
            <div className='training-animate-fade-up mb-6 rounded-[var(--radius-atria-md)] border border-atria-warning/40 bg-atria-warning-bg p-4' style={{ opacity: 0, animationDelay: '0.05s' }}>
              <div className='flex items-center gap-2'>
                <span className='text-lg'>🚧</span>
                <p className='text-sm font-semibold text-atria-warning'>
              Complete required training to continue. A quiz will follow — you must score at least {passingScore}% to pass.
            </p>
              </div>
            </div>
          )}

          <div className='mb-6 flex items-center gap-3'>
            <AtriaLogo />
            <div className='flex-1'>
              <p className='text-sm text-atria-text-secondary'>Required Training</p>
            </div>
            <div className='text-right'>
              <p className='text-sm font-medium text-atria-ink'>
                {Math.min(currentIndex + 1, steps.length)} / {steps.length}
              </p>
            </div>
          </div>

          <div className='mb-4 flex flex-wrap gap-2'>
            {steps.map((s, idx) => (
              <div
                key={s.id}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-all duration-300',
                  idx < currentIndex || completedIds.has(s.id)
                    ? 'bg-atria-accent'
                    : idx === currentIndex
                      ? 'bg-atria-warning'
                      : 'bg-atria-surface-3',
                )}
              />
            ))}
          </div>

          {allTrainingComplete ? (
            <div className='text-center'>
              <div className='mb-4 flex justify-center'>
                <div className='training-animate-celebrate flex h-16 w-16 items-center justify-center rounded-full bg-atria-success text-white'>
                  <svg className='h-8 w-8' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
                  </svg>
                </div>
              </div>
              <h2 className='training-animate-fade-up mb-2 text-xl font-semibold text-atria-ink' style={{ opacity: 0, animationDelay: '0.2s' }}>
                Training complete! 🎉
              </h2>
              <p className='training-animate-fade-up mb-6 text-sm text-atria-text-secondary' style={{ opacity: 0, animationDelay: '0.3s' }}>
                You have finished all required training modules.
              </p>
              <Button
                variant='primary'
                size='lg'
                className='w-full training-animate-glow'
                onClick={handleGoToDashboard}
              >
                {hasFullPlatform === false ? '🎉 Finish' : 'Go to dashboard →'}
              </Button>
            </div>
          ) : (
            <StepView
              key={step.id}
              step={step}
              isLast={isLast}
              isSubmitting={isSubmitting}
              onComplete={handleComplete}
              quizPassThreshold={passingScore}
              stepIndex={currentIndex}
              totalSteps={steps.length}
            />
          )}

          <p className='mt-4 text-center text-xs text-atria-text-muted'>
            Training completion is recorded securely and tied to your profile.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
