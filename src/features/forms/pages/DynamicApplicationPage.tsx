import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/react'
import { useTenant } from '@/app/useTenant'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { AppLoader } from '@/shared/ui/AppLoader'
import { ProgressSteps } from '@/shared/ui/ProgressSteps'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { clearSessionData } from '@/shared/lib/clearSession'
import { DynamicForm } from '../components/DynamicForm'
import { DynamicFormReview } from '../components/DynamicFormReview'
import { type FormAnswers, type FormDefinition } from '../model/formFieldTypes'

export function DynamicApplicationPage() {
  const navigate = useNavigate()
  const { clerkOrgId, isLoading: tenantLoading } = useTenant()
  const clerk = useClerk()

  const forms = useQuery(
    api.forms.getApplicationForms,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const submit = useMutation(api.forms.submitApplicationForms)

  const [step, setStep] = useState(0)
  const [answersByForm, setAnswersByForm] = useState<Record<number, FormAnswers>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formList = useMemo(() => forms ?? [], [forms])
  const totalSteps = formList.length + 1 // +1 for review
  const currentForm: FormDefinition | undefined = formList[step]
  const isReviewStep = step === formList.length

  useEffect(() => {
    if (forms && forms.length === 0) {
      navigate('/onboarding/application', { replace: true })
    }
  }, [forms, navigate])

  const handleFormSubmit = async (answers: FormAnswers) => {
    setAnswersByForm((prev) => ({ ...prev, [step]: answers }))
    setStep((s) => s + 1)
  }

  const handleBack = () => {
    setStep((s) => Math.max(0, s - 1))
  }

  const handleFinalSubmit = async () => {
    if (!clerkOrgId) return
    setIsSubmitting(true)
    setError(null)
    try {
      const submissions = formList.map((form, index) => ({
        formDefinitionId: form._id as Id<'formDefinitions'>,
        answers: answersByForm[index] ?? {},
      }))
      await submit({ clerkOrgId, submissions })
      navigate('/onboarding/status', { replace: true })
    } catch (err) {
      setError(sanitizeConvexError(err instanceof Error ? err.message : String(err)))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    clearSessionData()
    await clerk.signOut()
  }

  if (tenantLoading || !clerkOrgId) return <AppLoader fullScreen />
  if (!forms) return <AppLoader fullScreen />

  const steps = [
    ...formList.map((form, index) => ({
      id: form.key ?? String(index),
      label: form.name,
    })),
    { id: 'review', label: 'Review & submit' },
  ]

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8">
      <Card className="w-full max-w-4xl">
        <CardContent className="p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <AtriaLogo />
            <p className="mt-2 text-sm text-atria-text-secondary">Candidate Portal</p>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-2 text-xs text-atria-text-muted hover:text-atria-ink hover:underline"
            >
              Sign out
            </button>
          </div>

          <h1 className="mb-1 text-2xl font-semibold text-atria-ink">Job application</h1>
          <p className="mb-6 text-base text-atria-text-secondary">
            Step {step + 1} of {totalSteps}: {isReviewStep ? 'Review & submit' : currentForm?.name}
          </p>

          <ProgressSteps steps={steps} currentStep={step} className="mb-8" />

          {isReviewStep ? (
            <div className="flex flex-col gap-6">
              {formList.map((form, index) => (
                <DynamicFormReview
                  key={form._id ?? index}
                  form={form}
                  answers={answersByForm[index] ?? {}}
                />
              ))}

              {error && <p className="text-sm text-atria-danger">{error}</p>}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button type="button" variant="secondary" size="lg" onClick={handleBack}>
                  ← Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit application →'}
                </Button>
              </div>
            </div>
          ) : (
            <DynamicForm
              form={currentForm}
              initialAnswers={answersByForm[step]}
              onSubmit={handleFormSubmit}
              submitLabel="Save and continue →"
            />
          )}

          <button
            className="mt-6 block w-full text-center text-sm text-atria-text-secondary hover:text-atria-ink"
            onClick={() => navigate('/onboarding/status')}
          >
            Already applied? Check your status →
          </button>
        </CardContent>
      </Card>
      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-xs text-atria-text-muted">Powered by ATRIA-X Digital Solutions</p>
      </div>
    </div>
  )
}
