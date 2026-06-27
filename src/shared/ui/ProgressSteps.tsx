import { cn } from '@/shared/lib/cn'

export type ProgressStep = {
  id: string
  label: string
  description?: string
  accentClass?: string
}

type StepAccent = {
  text: string
  border: string
  bg: string
  connector: string
}

const defaultAccent: StepAccent = {
  text: 'text-atria-accent',
  border: 'border-atria-accent',
  bg: 'bg-atria-accent',
  connector: 'bg-atria-accent',
}

const stepAccentMap: Record<string, StepAccent> = {
  when: {
    text: 'text-atria-step-when',
    border: 'border-atria-step-when',
    bg: 'bg-atria-step-when',
    connector: 'bg-atria-step-when',
  },
  what: {
    text: 'text-atria-step-what',
    border: 'border-atria-step-what',
    bg: 'bg-atria-step-what',
    connector: 'bg-atria-step-what',
  },
  how: {
    text: 'text-atria-step-how',
    border: 'border-atria-step-how',
    bg: 'bg-atria-step-how',
    connector: 'bg-atria-step-how',
  },
  goal: {
    text: 'text-atria-step-goal',
    border: 'border-atria-step-goal',
    bg: 'bg-atria-step-goal',
    connector: 'bg-atria-step-goal',
  },
  issues: {
    text: 'text-atria-step-issues',
    border: 'border-atria-step-issues',
    bg: 'bg-atria-step-issues',
    connector: 'bg-atria-step-issues',
  },
  done: {
    text: 'text-atria-step-done',
    border: 'border-atria-step-done',
    bg: 'bg-atria-step-done',
    connector: 'bg-atria-step-done',
  },
}

function accentFor(stepId: string): StepAccent {
  return stepAccentMap[stepId] ?? defaultAccent
}

interface ProgressStepsProps {
  steps: ProgressStep[]
  currentStep: number
  className?: string
}

export function ProgressSteps({ steps, currentStep, className }: ProgressStepsProps) {
  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <ol className="flex items-start gap-2">
        {steps.map((step, index) => {
          const isComplete = index < currentStep
          const isActive = index === currentStep
          const isUpcoming = index > currentStep
          const accent = accentFor(step.id)
          const activeTextClass = step.accentClass ?? accent.text

          return (
            <li
              key={step.id}
              className="relative flex flex-1 flex-col items-center text-center"
              aria-current={isActive ? 'step' : undefined}
            >
              <div className="flex w-full items-center">
                {index > 0 && (
                  <div
                    className={cn(
                      'hidden sm:block flex-1 h-0.5 -mr-2',
                      isComplete ? accent.connector : 'bg-atria-border',
                    )}
                  />
                )}
                <div
                  className={cn(
                    'z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold',
                    isComplete && `${accent.border} ${accent.bg} text-white`,
                    isActive && `${accent.border} bg-atria-accent-quiet ${activeTextClass}`,
                    isUpcoming && 'border-atria-border bg-atria-surface text-atria-text-muted',
                  )}
                >
                  {isComplete ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'hidden sm:block flex-1 h-0.5 -ml-2',
                      isComplete ? accent.connector : 'bg-atria-border',
                    )}
                  />
                )}
              </div>
              <div className="mt-2 px-1">
                <p
                  className={cn(
                    'text-sm font-medium',
                    isUpcoming ? 'text-atria-text-muted' : 'text-atria-ink',
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="mt-0.5 text-xs text-atria-text-secondary">
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
