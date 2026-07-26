import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenant } from '@/app/useTenant'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { USDateInput } from '@/shared/ui/USDateInput'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { cn } from '@/shared/lib/cn'
import {
  EMPLOYEE_CONTRACT_TEXT,
  EMPLOYEE_RIGHTS_TEXT,
  HIPAA_TEXT,
  ABUSE_NOTICE_TEXT,
  LEGAL_VALIDITY_TEXT,
} from '../components/application/legalText'

type AgreementKey = 'employeeContract' | 'employeeRights' | 'hipaa' | 'abuseNotice'

type AgreementState = {
  agreed: boolean
  initials: string
  date: string
}

const AGREEMENTS: Record<AgreementKey, { title: string; body: string }> = {
  employeeContract: {
    title: 'Employee Contract',
    body: EMPLOYEE_CONTRACT_TEXT,
  },
  employeeRights: {
    title: 'Employee Rights (LIC 9052)',
    body: EMPLOYEE_RIGHTS_TEXT,
  },
  hipaa: {
    title: 'HIPAA Confidentiality Notice',
    body: HIPAA_TEXT,
  },
  abuseNotice: {
    title: 'Abuse Notice (SOC 341A)',
    body: ABUSE_NOTICE_TEXT,
  },
}

export function EmploymentAgreementPage() {
  const navigate = useNavigate()
  const { clerkOrgId, isLoading } = useTenant()
  const acknowledge = useMutation(api.candidates.acknowledgeBackgroundCheck)

  const today = new Date().toISOString().split('T')[0]
  const [agreements, setAgreements] = useState<Record<AgreementKey, AgreementState>>({
    employeeContract: { agreed: false, initials: '', date: today },
    employeeRights: { agreed: false, initials: '', date: today },
    hipaa: { agreed: false, initials: '', date: today },
    abuseNotice: { agreed: false, initials: '', date: today },
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [legalValidityAccepted, setLegalValidityAccepted] = useState(false)

  if (isLoading || !clerkOrgId) return null

  const updateAgreement = (key: AgreementKey, patch: Partial<AgreementState>) => {
    setAgreements((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }))
  }

  const allComplete =
    legalValidityAccepted &&
    Object.values(agreements).every(
      (a) => a.agreed && a.initials.trim().length > 0 && a.date,
    )

  const handleSubmit = async () => {
    if (!allComplete) {
      setError('Please complete all agreements with initials and date.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      await acknowledge({ clerkOrgId })
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit agreements. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[640px]'>
        <CardContent className='p-8'>
          <button
            className='mb-4 text-sm text-atria-accent hover:text-atria-accent-hover'
            onClick={() => navigate('/onboarding/checklist')}
          >
            ← Back to checklist
          </button>

          <div className='mb-6 flex items-center gap-3'>
            <AtriaLogo />
            <div>
              <p className='text-sm text-atria-text-secondary'>Caregiver Portal</p>
            </div>
          </div>

          <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>Employment agreements</h1>
          <p className='mb-6 text-base text-atria-text-secondary'>
            Read each section, enter your initials, and confirm.
          </p>

          <label className='mb-6 flex cursor-pointer items-start gap-3 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'>
            <Checkbox
              checked={legalValidityAccepted}
              onChange={(e) => setLegalValidityAccepted(e.target.checked)}
              className='mt-0.5 shrink-0'
            />
            <span className='text-sm text-atria-text-secondary'>{LEGAL_VALIDITY_TEXT}</span>
          </label>

          <div className='space-y-6'>
            {(Object.keys(AGREEMENTS) as AgreementKey[]).map((key) => {
              const agreement = AGREEMENTS[key]
              const state = agreements[key]
              const isComplete = state.agreed && state.initials.trim() && state.date
              return (
                <div
                  key={key}
                  className={cn(
                    'rounded-[var(--radius-atria-md)] border p-5 transition-colors',
                    isComplete
                      ? 'border-atria-success/40 bg-atria-success/5'
                      : 'border-atria-border bg-atria-surface-2',
                  )}
                >
                  <h2 className='mb-2 text-base font-semibold text-atria-ink'>{agreement.title}</h2>
                  <p className='mb-4 max-h-[240px] overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface p-4 text-sm leading-relaxed text-atria-text-secondary'>
                    {agreement.body}
                  </p>

                  <label className='mb-4 flex cursor-pointer items-start gap-3'>
                    <Checkbox
                      checked={state.agreed}
                      onChange={(e) => updateAgreement(key, { agreed: e.target.checked })}
                      className='mt-0.5 shrink-0'
                    />
                    <span className='text-sm text-atria-text-secondary'>
                      I have read and agree to the {agreement.title.toLowerCase()}
                    </span>
                  </label>

                  <div className='grid grid-cols-2 gap-4'>
                    <FieldGroup label='INITIALS' htmlFor={`${key}-initials`} required>
                      <Input
                        id={`${key}-initials`}
                        value={state.initials}
                        onChange={(e) => updateAgreement(key, { initials: e.target.value })}
                        placeholder='JD'
                      />
                    </FieldGroup>
                    <FieldGroup label='DATE' htmlFor={`${key}-date`} required>
                      <USDateInput
                        id={`${key}-date`}
                        value={state.date}
                        onChange={(iso) => updateAgreement(key, { date: iso })}
                      />
                    </FieldGroup>
                  </div>
                </div>
              )
            })}
          </div>

          {error && (
            <p className='mt-6 text-sm text-atria-danger'>{error}</p>
          )}

          <Button
            variant='primary'
            size='lg'
            className='mt-6 w-full'
            disabled={!allComplete || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Submitting...' : 'Confirm and continue →'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
