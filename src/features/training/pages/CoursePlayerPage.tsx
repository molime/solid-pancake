import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/react'
import { clearSessionData } from '@/shared/lib/clearSession'
import { getStoredClerkOrgId, useTenant } from '@/app/useTenant'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { AppLoader } from '@/shared/ui/AppLoader'
import { cn } from '@/shared/lib/cn'
import { StepPlayer } from '../components/StepPlayer'
import type { CourseDetail, TrainingStep } from '../model/courseTypes'
import { Award, CheckCircle2, ChevronLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

export function CoursePlayerPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { clerkOrgId } = useTenant()
  const effectiveClerkOrgId = clerkOrgId ?? getStoredClerkOrgId() ?? undefined
  const [outlineOpen, setOutlineOpen] = useState(true)

  const handleSignOut = () => {
    clearSessionData()
    signOut(() => navigate('/sign-in'))
  }

  const courseData = useQuery(
    api.training.getCourse,
    effectiveClerkOrgId && courseId
      ? { clerkOrgId: effectiveClerkOrgId, courseId: courseId as Id<'trainingCourses'> }
      : 'skip',
  )

  const completeStep = useMutation(api.training.completeStep)
  const completeCourse = useMutation(api.training.completeCourse)

  const course = courseData as CourseDetail | undefined
  const steps = useMemo<TrainingStep[]>(() => course?.steps ?? [], [course])

  const completedIds = useMemo(
    () => new Set(course?.completedStepIds ?? []),
    [course],
  )

  const initialIndex = useMemo(() => {
    for (let i = 0; i < steps.length; i++) {
      if (!completedIds.has(steps[i].id)) return i
    }
    return 0
  }, [completedIds, steps])

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  useEffect(() => {
    // Auto-advance to the next incomplete step whenever completion state
    // refreshes. This mirrors the behavior of the onboarding TrainingPage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentIndex(initialIndex)
  }, [initialIndex])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const step = steps[currentIndex]
  const isLast = currentIndex === steps.length - 1
  // Trust the backend completion record; local completedIds are only used for
  // progress indicators while the user is mid-course.
  const allComplete = course?.isCompleted ?? false

  if (!effectiveClerkOrgId || !courseId) {
    return <AppLoader fullScreen label="Opening course..." />
  }

  if (courseData === undefined) {
    return <AppLoader fullScreen label="Loading course..." />
  }

  if (!course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h1 className="mb-2 text-xl font-bold text-atria-ink">
              Course not found
            </h1>
            <p className="mb-6 text-sm text-atria-text-secondary">
              The course you are looking for does not exist or is not available.
            </p>
            <Button variant="primary" onClick={() => navigate('/training')}>
              Back to Training
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleStepComplete = async () => {
    if (!effectiveClerkOrgId) return
    setIsSubmitting(true)
    try {
      await completeStep({
        clerkOrgId: effectiveClerkOrgId,
        courseId: course._id as Id<'trainingCourses'>,
        stepId: step.id,
      })

      if (isLast) {
        await completeCourse({
          clerkOrgId: effectiveClerkOrgId,
          courseId: course._id as Id<'trainingCourses'>,
        })
      }
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

  const handleBackToHub = () => {
    navigate('/training')
  }

  const progressPercent = Math.round(
    ((currentIndex + (allComplete ? 1 : 0)) / steps.length) * 100,
  )

  return (
    <div className="flex min-h-screen flex-col bg-atria-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-atria-border bg-atria-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToHub}
              className="flex items-center gap-1.5 text-sm text-atria-text-secondary hover:text-atria-ink"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to training</span>
            </button>
          </div>

          <div className="flex flex-col items-center">
            <AtriaLogo className="h-10 w-auto" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-atria-text-muted">
              {course.title}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-atria-text-muted hover:text-atria-ink hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main workspace */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 p-4 lg:p-6">
        {/* Outline sidebar */}
        <aside
          className={cn(
            'hidden shrink-0 flex-col gap-4 transition-all duration-300 lg:flex',
            outlineOpen ? 'w-72' : 'w-14',
          )}
        >
          <div className="flex items-center justify-between">
            {outlineOpen && (
              <h2 className="text-sm font-semibold text-atria-ink">Course outline</h2>
            )}
            <button
              type="button"
              onClick={() => setOutlineOpen((o) => !o)}
              className="rounded-md p-1.5 text-atria-text-muted hover:bg-atria-surface-2 hover:text-atria-ink"
              aria-label={outlineOpen ? 'Collapse outline' : 'Expand outline'}
            >
              {outlineOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
          </div>

          {outlineOpen && (
            <div className="space-y-1">
              {steps.map((s, idx) => {
                const isCompleted = completedIds.has(s.id)
                const isCurrent = idx === currentIndex
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (isCompleted || idx <= currentIndex) {
                        setCurrentIndex(idx)
                      }
                    }}
                    disabled={!isCompleted && idx > currentIndex}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      isCurrent
                        ? 'bg-atria-accent/10 text-atria-accent'
                        : isCompleted
                          ? 'text-atria-text-secondary hover:bg-atria-surface-2'
                          : 'cursor-not-allowed text-atria-text-muted',
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-atria-success" />
                    ) : (
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]',
                          isCurrent
                            ? 'bg-atria-accent text-white'
                            : 'bg-atria-surface-3 text-atria-text-muted',
                        )}
                      >
                        {idx + 1}
                      </span>
                    )}
                    <span className="line-clamp-2">{s.title}</span>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        {/* Player card */}
        <section className="flex min-w-0 flex-1 flex-col">
          <Card className="flex flex-1 flex-col">
            <CardContent className="flex flex-1 flex-col p-6 lg:p-8">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-atria-text-muted">
                    Step {currentIndex + 1} of {steps.length}
                  </p>
                  <h1 className="text-lg font-bold text-atria-ink lg:text-xl">
                    {step?.title}
                  </h1>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-atria-surface-3 lg:w-32">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-atria-accent to-atria-info transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-atria-ink">
                    {progressPercent}%
                  </span>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
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

              <div className="flex-1">
                {allComplete ? (
                  <div className="text-center">
                    <div className="mb-4 flex justify-center">
                      <div className="training-animate-celebrate flex h-16 w-16 items-center justify-center rounded-full bg-atria-success text-white">
                        <svg
                          className="h-8 w-8"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    </div>
                    <h2
                      className="training-animate-fade-up mb-2 text-xl font-semibold text-atria-ink"
                      style={{ opacity: 0, animationDelay: '0.2s' }}
                    >
                      Course complete! 🎉
                    </h2>
                    <p
                      className="training-animate-fade-up mb-6 text-sm text-atria-text-secondary"
                      style={{ opacity: 0, animationDelay: '0.3s' }}
                    >
                      You have finished <strong>{course.title}</strong>.
                    </p>
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full training-animate-glow"
                      onClick={handleBackToHub}
                    >
                      Back to training hub →
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      className="mt-3 w-full"
                      onClick={() => navigate(`/training/certificate/${course._id}`)}
                    >
                      <Award className="h-4 w-4" />
                      View certificate
                    </Button>
                  </div>
                ) : (
                  <StepPlayer
                    key={step.id}
                    step={step}
                    stepIndex={currentIndex}
                    totalSteps={steps.length}
                    passingScore={course.passingScore}
                    isSubmitting={isSubmitting}
                    onComplete={handleStepComplete}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-xs text-atria-text-muted">
              Powered by ATRIA-X Digital Solutions
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
