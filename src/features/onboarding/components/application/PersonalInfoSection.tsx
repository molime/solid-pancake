import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Input } from '@/shared/ui/Input'
import { USDateInput } from '@/shared/ui/USDateInput'
import { Select } from '@/shared/ui/Select'
import { Checkbox } from '@/shared/ui/Checkbox'
import {
  type PersonalInfo,
  type Shift,
  AVAILABILITY_OPTIONS,
  ID_TYPE_OPTIONS,
  STATE_OPTIONS,
  SHIFT_OPTIONS,
  PART_TIME_SHIFT_OPTIONS,
  DAYS_OF_WEEK_OPTIONS,
} from './types'
import { formatPhone, isValidEmail, isValidPhone } from '@/shared/validation'

interface PersonalInfoSectionProps {
  value: PersonalInfo
  onChange: (value: PersonalInfo) => void
  branchType?: string
  showErrors?: boolean
}

export function PersonalInfoSection({ value, onChange, showErrors }: PersonalInfoSectionProps) {
  const update = <K extends keyof PersonalInfo>(key: K, val: PersonalInfo[K]) => {
    onChange({ ...value, [key]: val })
  }

  const updateAddress = (key: keyof PersonalInfo['address'], val: string) => {
    onChange({ ...value, address: { ...value.address, [key]: val } })
  }

  const toggleDay = (day: string) => {
    const days = value.daysOfWeek.includes(day)
      ? value.daysOfWeek.filter((d) => d !== day)
      : [...value.daysOfWeek, day]
    update('daysOfWeek', days)
  }

  const required = (val: string) => (showErrors && !val.trim() ? 'This field is required' : undefined)

  const phoneError = (val: string) =>
    showErrors && val.trim() && !isValidPhone(val) ? 'Enter a valid 10-digit phone number' : undefined

  const emailError = (val: string) =>
    showErrors && val.trim() && !isValidEmail(val) ? 'Enter a valid email address' : undefined

  const shiftOptions = value.availability === 'part_time' ? PART_TIME_SHIFT_OPTIONS : SHIFT_OPTIONS

  return (
    <div className='flex flex-col gap-5'>
      <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
        <FieldGroup label='First name' htmlFor='firstName' required error={required(value.firstName)}>
          <Input
            id='firstName'
            value={value.firstName}
            onChange={(e) => update('firstName', e.target.value)}
          />
        </FieldGroup>

        <FieldGroup label='Last name' htmlFor='lastName' required error={required(value.lastName)}>
          <Input
            id='lastName'
            value={value.lastName}
            onChange={(e) => update('lastName', e.target.value)}
          />
        </FieldGroup>
      </div>

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-3'>
        <FieldGroup
          label='Middle initial'
          htmlFor='middleInitial'
          className='sm:col-span-1'
        >
          <Input
            id='middleInitial'
            value={value.middleInitial}
            onChange={(e) => update('middleInitial', e.target.value)}
          />
        </FieldGroup>

        <FieldGroup label='ID type' htmlFor='idType' required error={required(value.idType)}>
          <Select
            id='idType'
            value={value.idType}
            onChange={(e) => update('idType', e.target.value as PersonalInfo['idType'])}
          >
            <option value='' disabled>Select ID type</option>
            {ID_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FieldGroup>

        <FieldGroup label={value.idType ? value.idType.toUpperCase() : 'SSN / ITIN'} htmlFor='ssn' required error={required(value.ssn)}>
          <Input
            id='ssn'
            value={value.ssn}
            onChange={(e) => update('ssn', e.target.value)}
          />
        </FieldGroup>
      </div>

      <div className='flex flex-col gap-5'>
        <FieldGroup label='Street address' htmlFor='street' required error={required(value.address.street)}>
          <Input
            id='street'
            value={value.address.street}
            onChange={(e) => updateAddress('street', e.target.value)}
          />
        </FieldGroup>

        <FieldGroup label='Apt / suite' htmlFor='apt'>
          <Input
            id='apt'
            value={value.address.apt}
            onChange={(e) => updateAddress('apt', e.target.value)}
          />
        </FieldGroup>

        <div className='grid grid-cols-1 gap-5 sm:grid-cols-3'>
          <FieldGroup label='City' htmlFor='city' required error={required(value.address.city)}>
            <Input
              id='city'
              value={value.address.city}
              onChange={(e) => updateAddress('city', e.target.value)}
            />
          </FieldGroup>

          <FieldGroup label='State' htmlFor='state' required error={required(value.address.state)}>
            <Select
              id='state'
              value={value.address.state}
              onChange={(e) => updateAddress('state', e.target.value)}
            >
              <option value='' disabled>Select state</option>
              {STATE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup label='ZIP' htmlFor='zip' required error={required(value.address.zip)}>
            <Input
              id='zip'
              value={value.address.zip}
              onChange={(e) => updateAddress('zip', e.target.value)}
            />
          </FieldGroup>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-3'>
        <FieldGroup label='Home phone' htmlFor='homePhone' required error={required(value.homePhone) ?? phoneError(value.homePhone)}>
          <Input
            id='homePhone'
            type='tel'
            inputMode='numeric'
            maxLength={14}
            value={value.homePhone}
            onChange={(e) => update('homePhone', formatPhone(e.target.value))}
          />
        </FieldGroup>

        <FieldGroup label='Cell phone' htmlFor='cellPhone' required error={required(value.cellPhone) ?? phoneError(value.cellPhone)}>
          <Input
            id='cellPhone'
            type='tel'
            inputMode='numeric'
            maxLength={14}
            value={value.cellPhone}
            onChange={(e) => update('cellPhone', formatPhone(e.target.value))}
          />
        </FieldGroup>

        <FieldGroup label='Email' htmlFor='email' required error={required(value.email) ?? emailError(value.email)}>
          <Input
            id='email'
            type='email'
            value={value.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </FieldGroup>
      </div>

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
        <FieldGroup label='Date of birth' htmlFor='dateOfBirth' required error={required(value.dateOfBirth)}>
          <USDateInput
            id='dateOfBirth'
            value={value.dateOfBirth}
            onChange={(iso) => update('dateOfBirth', iso)}
          />
        </FieldGroup>

        <FieldGroup label='Gender' htmlFor='gender' required error={required(value.gender)}>
          <Select
            id='gender'
            value={value.gender}
            onChange={(e) => update('gender', e.target.value as PersonalInfo['gender'])}
          >
            <option value='' disabled>Select gender</option>
            <option value='male'>Male</option>
            <option value='female'>Female</option>
          </Select>
        </FieldGroup>

        <FieldGroup label='Availability' htmlFor='availability' required error={required(value.availability)}>
          <Select
            id='availability'
            value={value.availability}
            onChange={(e) => {
              const availability = e.target.value as PersonalInfo['availability']
              onChange({
                ...value,
                availability,
                // Overnight is only available for full-time; reset the shift when it becomes invalid
                shift: availability === 'part_time' && value.shift === 'overnight' ? '' : value.shift,
              })
            }}
          >
            <option value='' disabled>Select availability</option>
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FieldGroup>
      </div>

      {value.availability && (
        <div className='flex flex-col gap-5 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'>
          <FieldGroup
            label='Shift'
            htmlFor='shift-morning'
            required
            error={showErrors && !value.shift ? 'Please select a shift' : undefined}
          >
            <div className='flex flex-col gap-2'>
              {shiftOptions.map((o) => (
                <label key={o.value} htmlFor={`shift-${o.value}`} className='flex items-center gap-2'>
                  <input
                    id={`shift-${o.value}`}
                    type='radio'
                    name='shift'
                    checked={value.shift === o.value}
                    onChange={() => update('shift', o.value as Shift)}
                    className='h-4 w-4 accent-atria-accent'
                  />
                  <span className='text-sm text-atria-text-secondary'>{o.label}</span>
                </label>
              ))}
            </div>
          </FieldGroup>

          {value.availability === 'part_time' && (
            <FieldGroup
              label='Custom hours per day'
              htmlFor='customHours'
              required
              error={required(value.customHours)}
            >
              <Input
                id='customHours'
                value={value.customHours}
                onChange={(e) => update('customHours', e.target.value)}
                placeholder='e.g. 4'
              />
            </FieldGroup>
          )}

          <FieldGroup
            label='Days of the week'
            htmlFor='day-monday'
            required
            error={showErrors && value.daysOfWeek.length === 0 ? 'Please select at least one day' : undefined}
          >
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
              {DAYS_OF_WEEK_OPTIONS.map((day) => (
                <label key={day} htmlFor={`day-${day.toLowerCase()}`} className='flex items-center gap-2'>
                  <Checkbox
                    id={`day-${day.toLowerCase()}`}
                    checked={value.daysOfWeek.includes(day)}
                    onChange={() => toggleDay(day)}
                  />
                  <span className='text-sm text-atria-text-secondary'>{day}</span>
                </label>
              ))}
            </div>
          </FieldGroup>
        </div>
      )}

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
        <FieldGroup label='Skills' htmlFor='skills'>
          <Input
            id='skills'
            value={value.skills}
            onChange={(e) => update('skills', e.target.value)}
            placeholder='e.g. CNA, HHA, dementia care'
          />
        </FieldGroup>

        <FieldGroup label='Languages spoken' htmlFor='languages'>
          <Input
            id='languages'
            value={value.languages}
            onChange={(e) => update('languages', e.target.value)}
            placeholder='e.g. English, Spanish'
          />
        </FieldGroup>
      </div>

      <FieldGroup
        label='I am 18 years of age or older'
        htmlFor='is18OrOlder'
        required
        error={showErrors && !value.is18OrOlder ? 'You must be 18 or older to apply' : undefined}
      >
        <label htmlFor='is18OrOlder' className='flex items-start gap-2'>
          <Checkbox
            id='is18OrOlder'
            checked={value.is18OrOlder}
            onChange={(e) => update('is18OrOlder', e.target.checked)}
          />
          <span className='text-sm text-atria-text-secondary'>Yes, I confirm I am 18 or older</span>
        </label>
      </FieldGroup>

      <FieldGroup label='Sign language proficient' htmlFor='signLanguage'>
        <label htmlFor='signLanguage' className='flex items-start gap-2'>
          <Checkbox
            id='signLanguage'
            checked={value.signLanguage}
            onChange={(e) => update('signLanguage', e.target.checked)}
          />
          <span className='text-sm text-atria-text-secondary'>I am proficient in sign language</span>
        </label>
      </FieldGroup>

      <FieldGroup
        label='Do you plan to use your personal vehicle to transport clients?'
        htmlFor='canTransportClients-yes'
        helperText='Optional — your answer does not affect your application.'
      >
        <div className='flex flex-col gap-2'>
          <label htmlFor='canTransportClients-yes' className='flex items-center gap-2'>
            <input
              id='canTransportClients-yes'
              type='radio'
              name='canTransportClients'
              checked={value.canTransportClients === true}
              onChange={() => update('canTransportClients', true)}
              className='h-4 w-4 accent-atria-accent'
            />
            <span className='text-sm text-atria-text-secondary'>Yes</span>
          </label>
          <label htmlFor='canTransportClients-no' className='flex items-center gap-2'>
            <input
              id='canTransportClients-no'
              type='radio'
              name='canTransportClients'
              checked={value.canTransportClients === false}
              onChange={() => update('canTransportClients', false)}
              className='h-4 w-4 accent-atria-accent'
            />
            <span className='text-sm text-atria-text-secondary'>No</span>
          </label>
        </div>
      </FieldGroup>

      {value.canTransportClients === true && (
        <div className='rounded-[var(--radius-atria-md)] border border-atria-info/30 bg-atria-info/10 p-4'>
          <p className='text-sm text-atria-ink'>
            Please note: You will be reimbursed for mileage when transporting clients in your
            personal vehicle. You will need to provide a valid car insurance policy.
          </p>
        </div>
      )}
    </div>
  )
}
