import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Input } from '@/shared/ui/Input'
import { USDateInput } from '@/shared/ui/USDateInput'
import { Select } from '@/shared/ui/Select'
import { Checkbox } from '@/shared/ui/Checkbox'
import { type W4Info, FILING_STATUS_OPTIONS } from './types'

interface W4SectionProps {
  value: W4Info
  onChange: (value: W4Info) => void
  showErrors?: boolean
}

export function W4Section({ value, onChange, showErrors }: W4SectionProps) {
  const update = <K extends keyof W4Info>(key: K, val: W4Info[K]) => {
    onChange({ ...value, [key]: val })
  }

  const updateDependent = (key: keyof W4Info['dependents'], val: string) => {
    onChange({ ...value, dependents: { ...value.dependents, [key]: val } })
  }

  const required = (val: string) => (showErrors && !val.trim() ? 'This field is required' : undefined)

  return (
    <div className='flex flex-col gap-5'>
      <p className='text-sm text-atria-text-secondary'>
        Complete your federal W-4 withholding information.
      </p>

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-3'>
        <FieldGroup label='First name' htmlFor='w4FirstName' required error={required(value.firstName)}>
          <Input
            id='w4FirstName'
            value={value.firstName}
            onChange={(e) => update('firstName', e.target.value)}
          />
        </FieldGroup>

        <FieldGroup label='Middle initial' htmlFor='w4MiddleInitial'>
          <Input
            id='w4MiddleInitial'
            value={value.middleInitial}
            onChange={(e) => update('middleInitial', e.target.value)}
          />
        </FieldGroup>

        <FieldGroup label='Last name' htmlFor='w4LastName' required error={required(value.lastName)}>
          <Input
            id='w4LastName'
            value={value.lastName}
            onChange={(e) => update('lastName', e.target.value)}
          />
        </FieldGroup>
      </div>

      <FieldGroup label='Address' htmlFor='w4Address' required error={required(value.address)}>
        <Input
          id='w4Address'
          value={value.address}
          onChange={(e) => update('address', e.target.value)}
        />
      </FieldGroup>

      <FieldGroup label='City, state, ZIP' htmlFor='cityStateZip' required error={required(value.cityStateZip)}>
        <Input
          id='cityStateZip'
          value={value.cityStateZip}
          onChange={(e) => update('cityStateZip', e.target.value)}
        />
      </FieldGroup>

      <FieldGroup label='SSN' htmlFor='w4Ssn' required error={required(value.ssn)}>
        <Input
          id='w4Ssn'
          value={value.ssn}
          onChange={(e) => update('ssn', e.target.value)}
        />
      </FieldGroup>

      <FieldGroup label='Filing status' htmlFor='filingStatus' required error={required(value.filingStatus)}>
        <Select
          id='filingStatus'
          value={value.filingStatus}
          onChange={(e) => update('filingStatus', e.target.value as W4Info['filingStatus'])}
        >
          <option value='' disabled>Select filing status</option>
          {FILING_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </FieldGroup>

      <FieldGroup label='Multiple jobs or spouse works' htmlFor='multipleJobs'>
        <label htmlFor='multipleJobs' className='flex items-start gap-2'>
          <Checkbox
            id='multipleJobs'
            checked={value.multipleJobs}
            onChange={(e) => update('multipleJobs', e.target.checked)}
          />
          <span className='text-sm text-atria-text-secondary'>Check here if applicable</span>
        </label>
      </FieldGroup>

      <div className='rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'>
        <p className='mb-3 text-sm font-semibold text-atria-ink'>Dependents (Step 3)</p>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <FieldGroup label='Qualifying children' htmlFor='qualifyingChildren'>
            <Input
              id='qualifyingChildren'
              type='number'
              value={value.dependents.qualifyingChildren}
              onChange={(e) => updateDependent('qualifyingChildren', e.target.value)}
            />
          </FieldGroup>

          <FieldGroup label='Other dependents' htmlFor='otherDependents'>
            <Input
              id='otherDependents'
              type='number'
              value={value.dependents.otherDependents}
              onChange={(e) => updateDependent('otherDependents', e.target.value)}
            />
          </FieldGroup>

          <FieldGroup label='Other credits' htmlFor='otherCredits'>
            <Input
              id='otherCredits'
              type='number'
              value={value.dependents.otherCredits}
              onChange={(e) => updateDependent('otherCredits', e.target.value)}
            />
          </FieldGroup>

          <FieldGroup label='Total' htmlFor='dependentsTotal'>
            <Input
              id='dependentsTotal'
              type='number'
              value={value.dependents.total}
              onChange={(e) => updateDependent('total', e.target.value)}
            />
          </FieldGroup>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-3'>
        <FieldGroup label='Other income' htmlFor='otherIncome'>
          <Input
            id='otherIncome'
            type='number'
            value={value.otherIncome}
            onChange={(e) => update('otherIncome', e.target.value)}
          />
        </FieldGroup>

        <FieldGroup label='Deductions' htmlFor='deductions'>
          <Input
            id='deductions'
            type='number'
            value={value.deductions}
            onChange={(e) => update('deductions', e.target.value)}
          />
        </FieldGroup>

        <FieldGroup label='Extra withholding' htmlFor='extraWithholding'>
          <Input
            id='extraWithholding'
            type='number'
            value={value.extraWithholding}
            onChange={(e) => update('extraWithholding', e.target.value)}
          />
        </FieldGroup>
      </div>

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
        <FieldGroup label='Signature' htmlFor='w4Signature' required error={required(value.signature)}>
          <Input
            id='w4Signature'
            value={value.signature}
            onChange={(e) => update('signature', e.target.value)}
            placeholder='Type your full name'
          />
        </FieldGroup>

        <FieldGroup label='Date' htmlFor='w4Date' required error={required(value.date)}>
          <USDateInput
            id='w4Date'
            value={value.date}
            onChange={(iso) => update('date', iso)}
          />
        </FieldGroup>
      </div>
    </div>
  )
}
