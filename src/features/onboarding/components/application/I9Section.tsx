import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Input } from '@/shared/ui/Input'
import { USDateInput } from '@/shared/ui/USDateInput'
import { Select } from '@/shared/ui/Select'
import { Checkbox } from '@/shared/ui/Checkbox'
import { type I9Info, CITIZENSHIP_OPTIONS, STATE_OPTIONS } from './types'

interface I9SectionProps {
  value: I9Info
  onChange: (value: I9Info) => void
  showErrors?: boolean
}

export function I9Section({ value, onChange, showErrors }: I9SectionProps) {
  const update = <K extends keyof I9Info>(key: K, val: I9Info[K]) => {
    onChange({ ...value, [key]: val })
  }

  const required = (val: string) => (showErrors && !val.trim() ? 'This field is required' : undefined)

  return (
    <div className='flex flex-col gap-5'>
      <p className='text-sm text-atria-text-secondary'>
        Enter your I-9 information exactly as it appears on your identity documents.
      </p>

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-3'>
        <FieldGroup label='Last name' htmlFor='i9LastName' required error={required(value.lastName)}>
          <Input
            id='i9LastName'
            value={value.lastName}
            onChange={(e) => update('lastName', e.target.value)}
          />
        </FieldGroup>

        <FieldGroup label='First name' htmlFor='i9FirstName' required error={required(value.firstName)}>
          <Input
            id='i9FirstName'
            value={value.firstName}
            onChange={(e) => update('firstName', e.target.value)}
          />
        </FieldGroup>

        <FieldGroup label='Middle initial' htmlFor='i9MiddleInitial'>
          <Input
            id='i9MiddleInitial'
            value={value.middleInitial}
            onChange={(e) => update('middleInitial', e.target.value)}
          />
        </FieldGroup>
      </div>

      <FieldGroup label='Other last names used' htmlFor='otherLastNames'>
        <Input
          id='otherLastNames'
          value={value.otherLastNames}
          onChange={(e) => update('otherLastNames', e.target.value)}
        />
      </FieldGroup>

      <div className='flex flex-col gap-5'>
        <FieldGroup label='Address' htmlFor='i9Address' required error={required(value.address)}>
          <Input
            id='i9Address'
            value={value.address}
            onChange={(e) => update('address', e.target.value)}
          />
        </FieldGroup>

        <FieldGroup label='Apt number' htmlFor='aptNumber'>
          <Input
            id='aptNumber'
            value={value.aptNumber}
            onChange={(e) => update('aptNumber', e.target.value)}
          />
        </FieldGroup>

        <div className='grid grid-cols-1 gap-5 sm:grid-cols-3'>
          <FieldGroup label='City' htmlFor='i9City' required error={required(value.city)}>
            <Input
              id='i9City'
              value={value.city}
              onChange={(e) => update('city', e.target.value)}
            />
          </FieldGroup>

          <FieldGroup label='State' htmlFor='i9State' required error={required(value.state)}>
            <Select
              id='i9State'
              value={value.state}
              onChange={(e) => update('state', e.target.value)}
            >
              <option value='' disabled>Select state</option>
              {STATE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup label='ZIP' htmlFor='i9Zip' required error={required(value.zip)}>
            <Input
              id='i9Zip'
              value={value.zip}
              onChange={(e) => update('zip', e.target.value)}
            />
          </FieldGroup>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-3'>
        <FieldGroup label='Date of birth' htmlFor='i9DateOfBirth' required error={required(value.dateOfBirth)}>
          <USDateInput
            id='i9DateOfBirth'
            value={value.dateOfBirth}
            onChange={(iso) => update('dateOfBirth', iso)}
          />
        </FieldGroup>

        <FieldGroup label='SSN' htmlFor='i9Ssn' required error={required(value.ssn)}>
          <Input
            id='i9Ssn'
            value={value.ssn}
            onChange={(e) => update('ssn', e.target.value)}
          />
        </FieldGroup>

        <FieldGroup label='Phone' htmlFor='i9Phone'>
          <Input
            id='i9Phone'
            type='tel'
            value={value.phone}
            onChange={(e) => update('phone', e.target.value)}
          />
        </FieldGroup>
      </div>

      <FieldGroup label='Email' htmlFor='i9Email'>
        <Input
          id='i9Email'
          type='email'
          value={value.email}
          onChange={(e) => update('email', e.target.value)}
        />
      </FieldGroup>

      <FieldGroup label='Citizenship status' htmlFor='citizenshipStatus' required error={required(value.citizenshipStatus)}>
        <Select
          id='citizenshipStatus'
          value={value.citizenshipStatus}
          onChange={(e) => update('citizenshipStatus', e.target.value as I9Info['citizenshipStatus'])}
        >
          <option value='' disabled>Select status</option>
          {CITIZENSHIP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </FieldGroup>

      {value.citizenshipStatus === 'alien_authorized' && (
        <FieldGroup
          label='Alien authorization number'
          htmlFor='alienNumber'
          required
          error={showErrors && !value.alienNumber.trim() ? 'This field is required' : undefined}
        >
          <Input
            id='alienNumber'
            value={value.alienNumber}
            onChange={(e) => update('alienNumber', e.target.value)}
          />
        </FieldGroup>
      )}

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
        <FieldGroup label='Signature' htmlFor='i9Signature' required error={required(value.signature)}>
          <Input
            id='i9Signature'
            value={value.signature}
            onChange={(e) => update('signature', e.target.value)}
            placeholder='Type your full name'
          />
        </FieldGroup>

        <FieldGroup label='Date' htmlFor='i9Date' required error={required(value.date)}>
          <USDateInput
            id='i9Date'
            value={value.date}
            onChange={(iso) => update('date', iso)}
          />
        </FieldGroup>
      </div>

      <FieldGroup label='Preparer / translator' htmlFor='preparer'>
        <label htmlFor='preparer' className='flex items-start gap-2'>
          <Checkbox id='preparer' />
          <span className='text-sm text-atria-text-secondary'>
            I used a preparer or translator (optional)
          </span>
        </label>
      </FieldGroup>
    </div>
  )
}
