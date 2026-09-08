import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'
import { type CriminalRecord } from './types'

interface CriminalRecordSectionProps {
  value: CriminalRecord
  onChange: (value: CriminalRecord) => void
  showErrors?: boolean
  isGoldenAges?: boolean
}

function YesNoField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <FieldGroup label={label} htmlFor={`${id}-yes`} required>
      <div className='flex gap-6'>
        <label htmlFor={`${id}-yes`} className='flex items-center gap-2'>
          <input
            id={`${id}-yes`}
            type='radio'
            name={id}
            checked={value === true}
            onChange={() => onChange(true)}
            className='h-4 w-4 accent-atria-accent'
          />
          <span className='text-sm text-atria-text-secondary'>Yes</span>
        </label>
        <label htmlFor={`${id}-no`} className='flex items-center gap-2'>
          <input
            id={`${id}-no`}
            type='radio'
            name={id}
            checked={value === false}
            onChange={() => onChange(false)}
            className='h-4 w-4 accent-atria-accent'
          />
          <span className='text-sm text-atria-text-secondary'>No</span>
        </label>
      </div>
    </FieldGroup>
  )
}

export function CriminalRecordSection({ value, onChange, showErrors, isGoldenAges }: CriminalRecordSectionProps) {
  const update = <K extends keyof CriminalRecord>(key: K, val: CriminalRecord[K]) => {
    onChange({ ...value, [key]: val })
  }

  const hasConviction = value.convictedCalifornia || value.convictedOther

  return (
    <div className='flex flex-col gap-5'>
      <YesNoField
        id='convictedCalifornia'
        label='Have you ever been convicted of a crime in California?'
        value={value.convictedCalifornia}
        onChange={(val) => update('convictedCalifornia', val)}
      />

      <YesNoField
        id='convictedOther'
        label='Have you ever been convicted of a crime in any other state or jurisdiction?'
        value={value.convictedOther}
        onChange={(val) => update('convictedOther', val)}
      />

      <FieldGroup
        label='Conviction details'
        htmlFor='convictedDetails'
        required={hasConviction}
        error={showErrors && hasConviction && !value.convictedDetails.trim() ? 'Please provide details' : undefined}
      >
        <Textarea
          id='convictedDetails'
          value={value.convictedDetails}
          onChange={(e) => update('convictedDetails', e.target.value)}
          placeholder='Include dates, charges, and disposition'
          disabled={!hasConviction}
        />
      </FieldGroup>

      <YesNoField
        id='convictedUnderAlias'
        label='Have you ever been convicted under an alias?'
        value={value.convictedUnderAlias}
        onChange={(val) => update('convictedUnderAlias', val)}
      />

      {isGoldenAges && (
        <YesNoField
          id='livedOutsideCalifornia'
          label='Have you lived in a state other than California within the last five years?'
          value={value.livedOutsideCalifornia ?? false}
          onChange={(val) => update('livedOutsideCalifornia', val)}
        />
      )}

      <FieldGroup
        label='Alias names used'
        htmlFor='aliasNames'
        required={value.convictedUnderAlias}
        error={showErrors && value.convictedUnderAlias && !value.aliasNames.trim() ? 'Please provide alias names' : undefined}
      >
        <Input
          id='aliasNames'
          value={value.aliasNames}
          onChange={(e) => update('aliasNames', e.target.value)}
          disabled={!value.convictedUnderAlias}
        />
      </FieldGroup>
    </div>
  )
}
