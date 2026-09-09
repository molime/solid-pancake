import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { cn } from '@/shared/lib/cn'
import type { TrainingStep } from '../model/courseTypes'
import { parseQuiz, parseSlides, youtubeEmbedUrl } from '../model/courseTypes'
import { QuizPlayer } from './QuizPlayer'
import { SlideDeck } from './SlideDeck'

function KeyTakeaway({
  children,
  icon = '💡',
}: {
  children: React.ReactNode
  icon?: string
}) {
  return (
    <div
      className="training-animate-fade-up mb-4 rounded-[var(--radius-atria-md)] border border-atria-warning/30 bg-atria-warning-bg p-4"
      style={{ opacity: 0, animationDelay: '0.3s' }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-atria-warning">
            Key Takeaway
          </p>
          <p className="text-sm text-atria-ink">{children}</p>
        </div>
      </div>
    </div>
  )
}

function InteractiveCards({
  step,
  onAllExpanded,
}: {
  step: TrainingStep
  onAllExpanded: () => void
}) {
  const blocks = step.content.split('\n\n').filter((b) => b.trim())
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())

  const toggleCard = (i: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const allExpanded = expandedCards.size === blocks.length

  useEffect(() => {
    if (allExpanded) {
      onAllExpanded()
    }
  }, [allExpanded, onAllExpanded])

  return (
    <div className="mb-4 max-h-[420px] overflow-y-auto rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4">
      {blocks.map((block, i) => {
        const trimmed = block.trim()
        const isHeading =
          /^[A-Z][A-Z\s]{2,}:/.test(trimmed) || /^\d+\./.test(trimmed)
        const isBullet = trimmed.startsWith('- ')
        const isExpanded = expandedCards.has(i)
        const headingMatch = trimmed.match(/^([A-Z][A-Z\s]{2,}:)/)
        const heading = headingMatch
          ? headingMatch[1].trim()
          : isHeading
            ? `${trimmed.split('.')[0]}.`
            : null
        const body = headingMatch
          ? trimmed.substring(headingMatch[0].length).trim()
          : heading
            ? trimmed.substring(heading.length).trim()
            : trimmed

        return (
          <div
            key={i}
            className={cn(
              'training-animate-fade-up mb-2 rounded-[var(--radius-atria-md)] border transition-all duration-300 cursor-pointer',
              isExpanded
                ? 'border-atria-accent/40 bg-atria-surface'
                : 'border-atria-border bg-atria-surface-2 hover:border-atria-border-strong',
            )}
            style={{
              animationDelay: `${Math.min(i * 0.06, 0.3)}s`,
              opacity: 0,
            }}
            onClick={() => toggleCard(i)}
          >
            <div className="flex items-start gap-3 p-3">
              <div
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs transition-all duration-300',
                  isExpanded
                    ? 'bg-atria-accent text-white'
                    : 'bg-atria-surface-3 text-atria-text-muted',
                )}
              >
                {isExpanded ? '✓' : i + 1}
              </div>
              <div className="flex-1">
                {heading && (
                  <p className="mb-1 text-sm font-bold text-atria-ink">
                    {heading}
                  </p>
                )}
                {isExpanded ? (
                  <div className="training-animate-fade-up">
                    {isBullet ? (
                      <ul className="space-y-1.5">
                        {body.split('\n').map((item, j) => (
                          <li
                            key={j}
                            className="flex items-start gap-2 text-sm leading-relaxed text-atria-text-secondary"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-atria-accent" />
                            {item.replace(/^- /, '').trim()}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm leading-relaxed text-atria-text-secondary">
                        {body}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-atria-text-muted">
                    {isBullet
                      ? `${body.split('\n').length} key points`
                      : `${body.substring(0, 60)}...`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {allExpanded && (
        <div className="training-animate-bounce-in mt-3 flex items-center gap-2 rounded-[var(--radius-atria-md)] border border-atria-success/30 bg-atria-success-bg p-3">
          <span className="text-lg">🎉</span>
          <p className="text-sm font-medium text-atria-success">
            All sections reviewed! Tap the checkbox below to continue.
          </p>
        </div>
      )}
    </div>
  )
}

function VideoPlayer({ step }: { step: TrainingStep }) {
  const embedUrl = youtubeEmbedUrl(step.content)
  return (
    <div className="mb-6 aspect-video overflow-hidden rounded-[var(--radius-atria-md)] border border-atria-border">
      <iframe
        src={embedUrl}
        title={step.title}
        className="h-full w-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  )
}

function EmbedPlayer({ step }: { step: TrainingStep }) {
  return (
    <div className="mb-6 overflow-hidden rounded-[var(--radius-atria-md)] border border-atria-border">
      <iframe
        src={step.content}
        title={step.title}
        className="h-[360px] w-full"
        allowFullScreen
      />
      {step.caption && (
        <p className="border-t border-atria-border bg-atria-surface-2 p-3 text-xs text-atria-text-secondary">
          {step.caption}
        </p>
      )}
    </div>
  )
}

function ImageWalkthrough({ step }: { step: TrainingStep }) {
  return (
    <div className="mb-6">
      <div className="relative overflow-hidden rounded-[var(--radius-atria-md)] border border-atria-border">
        <img
          src={step.content}
          alt={step.title}
          className="max-h-[320px] w-full object-contain bg-atria-surface-2"
        />
      </div>
      {step.caption && (
        <p className="mt-2 text-sm text-atria-text-secondary">{step.caption}</p>
      )}
    </div>
  )
}

function isDevSpeedrun(): boolean {
  if (typeof window === 'undefined') return false
  if (!import.meta.env.DEV) return false
  const params = new URLSearchParams(window.location.search)
  const speedrun = params.get('speedrun')
  return speedrun === '1' || speedrun === 'true'
}

export function StepPlayer({
  step,
  stepIndex: _stepIndex,
  totalSteps: _totalSteps,
  passingScore,
  isSubmitting,
  onComplete,
}: {
  step: TrainingStep
  stepIndex: number
  totalSteps: number
  passingScore: number
  isSubmitting: boolean
  onComplete: () => void
}) {
  const isSpeedrun = isDevSpeedrun()
  const rawMinDurationSec = isSpeedrun
    ? step.minDurationSec === undefined
      ? 0
      : Math.min(1, step.minDurationSec)
    : step.minDurationSec ?? 0
  // Never force a learner to wait more than one minute per step, even if a
  // legacy course record has a larger value.
  const minDurationSec = Math.min(rawMinDurationSec, 60)

  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(minDurationSec)

  // Reset timer when the step changes (including speed-run toggles).
  useEffect(() => {
    setSecondsRemaining(minDurationSec)
  }, [minDurationSec])

  useEffect(() => {
    if (secondsRemaining <= 0) return
    const id = window.setInterval(() => {
      setSecondsRemaining((s) => {
        if (s <= 1) {
          window.clearInterval(id)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [secondsRemaining])

  const needsScrollEnforcement =
    step.type === 'text' || step.type === 'policy' || step.type === 'slides'
  // Every non-quiz step requires the learner's acknowledgment checkbox so the
  // completion record is consistent across slides, text, and video steps.
  const canProceed =
    step.type === 'quiz'
      ? false // quiz calls onComplete when passed
      : needsScrollEnforcement
        ? scrolledToBottom && agreed && secondsRemaining === 0
        : agreed && secondsRemaining === 0

  const getBlocker = ():
    | { key: 'scroll'; message: string }
    | { key: 'timer'; message: string }
    | { key: 'checkbox'; message: string }
    | { key: 'ready'; message: string } => {
    if (needsScrollEnforcement && !scrolledToBottom) {
      return {
        key: 'scroll',
        message:
          step.type === 'slides'
            ? 'View all slides to continue'
            : 'Expand all cards to continue',
      }
    }
    if (secondsRemaining > 0) {
      return { key: 'timer', message: `⏳ ${secondsRemaining}s remaining` }
    }
    if (!agreed) {
      return {
        key: 'checkbox',
        message: 'Check the box above to continue',
      }
    }
    return {
      key: 'ready',
      message:
        step.type === 'slides'
          ? 'All slides viewed'
          : step.type === 'text' || step.type === 'policy'
            ? 'All cards reviewed'
            : 'Section acknowledged',
    }
  }

  const blocker = getBlocker()

  return (
    <>
      {step.type === 'quiz' && (
        <div
          className="training-animate-fade-up mb-4 rounded-[var(--radius-atria-md)] border border-atria-warning/40 bg-atria-warning-bg p-3"
          style={{ opacity: 0, animationDelay: '0.1s' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <p className="text-sm font-medium text-atria-warning">
              You must score at least {passingScore}% to pass. You can retake
              this quiz as many times as needed.
            </p>
          </div>
        </div>
      )}

      {(step.type === 'text' || step.type === 'policy') && (
        <div
          className="training-animate-fade-up mb-3 rounded-[var(--radius-atria-md)] border border-atria-info/30 bg-atria-info-bg p-3"
          style={{ opacity: 0, animationDelay: '0.05s' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg training-animate-float">👆</span>
            <p className="text-sm font-medium text-atria-info">
              Tap each card below to reveal the content. Expand all cards to
              continue.
            </p>
          </div>
        </div>
      )}

      {step.type === 'slides' && (
        <div
          className="training-animate-fade-up mb-3 rounded-[var(--radius-atria-md)] border border-atria-info/30 bg-atria-info-bg p-3"
          style={{ opacity: 0, animationDelay: '0.05s' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg training-animate-float">🎧</span>
            <p className="text-sm font-medium text-atria-info">
              View every slide to continue. Use the Listen button to hear the
              narration.
            </p>
          </div>
        </div>
      )}

      {step.type === 'text' && (
        <>
          <InteractiveCards
            step={step}
            onAllExpanded={() => setScrolledToBottom(true)}
          />
          <KeyTakeaway icon="🎯">
            Take your time with this material — it is part of your required
            training record.
          </KeyTakeaway>
        </>
      )}

      {step.type === 'policy' && (
        <>
          <InteractiveCards
            step={step}
            onAllExpanded={() => setScrolledToBottom(true)}
          />
          <KeyTakeaway icon="🛡️">
            Following these policies protects you, our clients, and the agency.
          </KeyTakeaway>
        </>
      )}

      {step.type === 'slides' && (
        <SlideDeck
          slides={parseSlides(step.content)}
          onAllViewed={() => setScrolledToBottom(true)}
        />
      )}

      {step.type === 'video' && <VideoPlayer step={step} />}
      {step.type === 'embed' && <EmbedPlayer step={step} />}
      {step.type === 'image' && <ImageWalkthrough step={step} />}

      {step.type === 'quiz' && (
        <QuizPlayer
          questions={parseQuiz(step.content)}
          passThreshold={passingScore}
          speedrun={isSpeedrun}
          onComplete={onComplete}
        />
      )}

      {step.type !== 'quiz' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p
              className={cn(
                'text-sm',
                blocker.key === 'ready'
                  ? 'training-animate-pop font-medium text-atria-success'
                  : blocker.key === 'checkbox'
                    ? 'font-medium text-atria-warning'
                    : blocker.key === 'timer'
                      ? 'text-atria-text-secondary'
                      : 'text-atria-warning',
              )}
            >
              {blocker.key === 'ready' ? `✓ ${blocker.message}!` : blocker.message}
            </p>
            {isSpeedrun && (
              <button
                type="button"
                onClick={onComplete}
                className="text-xs font-medium text-atria-accent hover:underline"
              >
                Dev: complete step
              </button>
            )}
          </div>

          <label className="mb-6 flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <span className="text-sm text-atria-text-secondary">
              I have read and understood this section.
            </span>
          </label>
        </>
      )}

      {step.type !== 'quiz' && (
        <Button
          variant="primary"
          size="lg"
          className={cn('w-full', canProceed && !isSubmitting && 'training-animate-glow')}
          disabled={!canProceed || isSubmitting}
          onClick={onComplete}
        >
          {isSubmitting
            ? 'Saving...'
            : _stepIndex === _totalSteps - 1
              ? '🎉 Finish course'
              : 'Complete & continue →'}
        </Button>
      )}
    </>
  )
}
