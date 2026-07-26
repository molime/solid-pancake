import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Input } from '@/shared/ui/Input'
import { USDateInput } from '@/shared/ui/USDateInput'
import { Checkbox } from '@/shared/ui/Checkbox'
import { type Acknowledgments } from './types'
import { ACKNOWLEDGMENT_DOCUMENTS, jobDescriptionForBranch } from './legalText'

interface AcknowledgmentsSectionProps {
  value: Acknowledgments
  onChange: (value: Acknowledgments) => void
  agencyName: string
  branchType?: string
  showErrors?: boolean
}

export function AcknowledgmentsSection({ value, onChange, branchType, showErrors }: AcknowledgmentsSectionProps) {
  const updateDoc = <K extends keyof Acknowledgments>(key: K, val: Acknowledgments[K]) => {
    onChange({ ...value, [key]: val })
  }

  return (
    <div className='flex flex-col gap-6'>
      {ACKNOWLEDGMENT_DOCUMENTS.map((doc) => {
        const item = value[doc.key]
        const text = doc.key === 'jobDescription' ? jobDescriptionForBranch(branchType) : doc.text

        return (
          <div
            key={doc.key}
            className='flex flex-col gap-4 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'
          >
            <p className='text-base font-semibold text-atria-ink'>{doc.title}</p>

            <div className='max-h-[240px] overflow-y-auto rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface p-4 text-sm leading-relaxed text-atria-text-secondary whitespace-pre-wrap'>
              {text}
            </div>

            <FieldGroup
              label={`I have read and agree to the ${doc.title}`}
              htmlFor={`${doc.key}-agreed`}
              required
              error={showErrors && !item.agreed ? 'You must agree to continue' : undefined}
            >
              <label htmlFor={`${doc.key}-agreed`} className='flex items-start gap-2'>
                <Checkbox
                  id={`${doc.key}-agreed`}
                  checked={item.agreed}
                  onChange={(e) =>
                    updateDoc(doc.key, { ...item, agreed: e.target.checked })
                  }
                />
                <span className='text-sm text-atria-text-secondary'>I agree</span>
              </label>
            </FieldGroup>

            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <FieldGroup
                label='Initials'
                htmlFor={`${doc.key}-initials`}
                required
                error={showErrors && !item.initials.trim() ? 'Initials are required' : undefined}
              >
                <Input
                  id={`${doc.key}-initials`}
                  value={item.initials}
                  onChange={(e) =>
                    updateDoc(doc.key, { ...item, initials: e.target.value })
                  }
                />
              </FieldGroup>

              <FieldGroup
                label='Date'
                htmlFor={`${doc.key}-date`}
                required
                error={showErrors && !item.date ? 'Date is required' : undefined}
              >
                <USDateInput
                  id={`${doc.key}-date`}
                  value={item.date}
                  onChange={(iso) =>
                    updateDoc(doc.key, { ...item, date: iso })
                  }
                />
              </FieldGroup>
            </div>
          </div>
        )
      })}
    </div>
  )
}
