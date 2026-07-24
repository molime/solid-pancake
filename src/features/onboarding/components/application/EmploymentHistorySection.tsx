import { Button } from '@/shared/ui/Button'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'
import { Checkbox } from '@/shared/ui/Checkbox'
import { type EmploymentSectionValue, type EmploymentEntry } from './types'

interface EmploymentHistorySectionProps {
  value: EmploymentSectionValue
  onChange: (value: EmploymentSectionValue) => void
  showErrors?: boolean
}

const emptyEntry = (): EmploymentEntry => ({
  companyName: '',
  position: '',
  fromMoYr: '',
  toMoYr: '',
  supervisorContact: '',
  jobDuties: '',
  reasonForLeaving: '',
})

export function EmploymentHistorySection({ value, onChange, showErrors }: EmploymentHistorySectionProps) {
  const updateTop = <K extends keyof EmploymentSectionValue>(key: K, val: EmploymentSectionValue[K]) => {
    onChange({ ...value, [key]: val })
  }

  const updateEntry = (index: number, key: keyof EmploymentEntry, val: string) => {
    const next = [...value.employment]
    next[index] = { ...next[index], [key]: val }
    onChange({ ...value, employment: next })
  }

  const addEntry = () => {
    onChange({ ...value, employment: [...value.employment, emptyEntry()] })
  }

  const removeEntry = (index: number) => {
    const next = value.employment.filter((_, i) => i !== index)
    onChange({ ...value, employment: next.length ? next : [emptyEntry()] })
  }

  const required = (val: string) => (showErrors && !val.trim() ? 'This field is required' : undefined)

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-4'>
        {value.employment.map((entry, index) => (
          <div
            key={index}
            className='rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'
          >
            <div className='mb-3 flex items-center justify-between'>
              <p className='text-sm font-semibold text-atria-ink'>Employer {index + 1}</p>
              {value.employment.length > 1 && (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => removeEntry(index)}
                >
                  Remove
                </Button>
              )}
            </div>

            <div className='flex flex-col gap-4'>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <FieldGroup
                  label='Company name'
                  htmlFor={`companyName-${index}`}
                  required
                  error={required(entry.companyName)}
                >
                  <Input
                    id={`companyName-${index}`}
                    value={entry.companyName}
                    onChange={(e) => updateEntry(index, 'companyName', e.target.value)}
                  />
                </FieldGroup>

                <FieldGroup
                  label='Position'
                  htmlFor={`position-${index}`}
                  required
                  error={required(entry.position)}
                >
                  <Input
                    id={`position-${index}`}
                    value={entry.position}
                    onChange={(e) => updateEntry(index, 'position', e.target.value)}
                  />
                </FieldGroup>
              </div>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <FieldGroup
                  label='From (MM/YYYY)'
                  htmlFor={`fromMoYr-${index}`}
                  required
                  error={required(entry.fromMoYr)}
                >
                  <Input
                    id={`fromMoYr-${index}`}
                    value={entry.fromMoYr}
                    onChange={(e) => updateEntry(index, 'fromMoYr', e.target.value)}
                    placeholder='MM/YYYY'
                  />
                </FieldGroup>

                <FieldGroup
                  label='To (MM/YYYY)'
                  htmlFor={`toMoYr-${index}`}
                >
                  <Input
                    id={`toMoYr-${index}`}
                    value={entry.toMoYr}
                    onChange={(e) => updateEntry(index, 'toMoYr', e.target.value)}
                    placeholder='MM/YYYY or Present'
                  />
                </FieldGroup>
              </div>

              <FieldGroup
                label='Supervisor contact'
                htmlFor={`supervisorContact-${index}`}
              >
                <Input
                  id={`supervisorContact-${index}`}
                  value={entry.supervisorContact}
                  onChange={(e) => updateEntry(index, 'supervisorContact', e.target.value)}
                />
              </FieldGroup>

              <FieldGroup
                label='Job duties'
                htmlFor={`jobDuties-${index}`}
                required
                error={required(entry.jobDuties)}
              >
                <Textarea
                  id={`jobDuties-${index}`}
                  value={entry.jobDuties}
                  onChange={(e) => updateEntry(index, 'jobDuties', e.target.value)}
                />
              </FieldGroup>

              <FieldGroup
                label='Reason for leaving'
                htmlFor={`reasonForLeaving-${index}`}
              >
                <Input
                  id={`reasonForLeaving-${index}`}
                  value={entry.reasonForLeaving}
                  onChange={(e) => updateEntry(index, 'reasonForLeaving', e.target.value)}
                />
              </FieldGroup>
            </div>
          </div>
        ))}

        <Button type='button' variant='secondary' size='md' onClick={addEntry}>
          + Add another employer
        </Button>
      </div>

      <div className='flex flex-col gap-4 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'>
        <FieldGroup label='Current employment' htmlFor='currentlyEmployed'>
          <label htmlFor='currentlyEmployed' className='flex items-start gap-2'>
            <Checkbox
              id='currentlyEmployed'
              checked={value.currentlyEmployed}
              onChange={(e) => updateTop('currentlyEmployed', e.target.checked)}
            />
            <span className='text-sm text-atria-text-secondary'>I am currently employed</span>
          </label>
        </FieldGroup>

        <FieldGroup label='Employer contact' htmlFor='mayContactEmployer'>
          <label htmlFor='mayContactEmployer' className='flex items-start gap-2'>
            <Checkbox
              id='mayContactEmployer'
              checked={value.mayContactEmployer}
              onChange={(e) => updateTop('mayContactEmployer', e.target.checked)}
            />
            <span className='text-sm text-atria-text-secondary'>
              We may contact your current/previous employers
            </span>
          </label>
        </FieldGroup>
      </div>
    </div>
  )
}
