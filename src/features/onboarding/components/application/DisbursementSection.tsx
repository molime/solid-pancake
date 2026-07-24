import { useEffect } from 'react'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import {
  type DisbursementInfo,
  type IdType,
  ACCOUNT_TYPE_OPTIONS,
} from './types'

interface DisbursementSectionProps {
  value: DisbursementInfo
  onChange: (value: DisbursementInfo) => void
  idType: IdType | ''
  showErrors?: boolean
}

export function DisbursementSection({ value, onChange, idType, showErrors }: DisbursementSectionProps) {
  const update = <K extends keyof DisbursementInfo>(key: K, val: DisbursementInfo[K]) => {
    onChange({ ...value, [key]: val })
  }

  const required = (val: string) => (showErrors && !val.trim() ? 'This field is required' : undefined)

  useEffect(() => {
    if (idType === 'itin' && value.method === 'direct_deposit') {
      onChange({ ...value, method: 'check' })
    }
  }, [idType, value, onChange])

  const isDirectDeposit = value.method === 'direct_deposit'

  return (
    <div className='flex flex-col gap-5'>
      {idType === 'itin' && (
        <div className='rounded-[var(--radius-atria-md)] border border-atria-warning/40 bg-atria-warning-bg p-4 text-sm text-atria-ink'>
          <span className='font-semibold text-atria-warning'>Notice:</span> ITIN employees can
          only receive checks. Direct deposit has been disabled.
        </div>
      )}

      <FieldGroup
        label='Payment method'
        htmlFor='disbursementMethod'
        required
        error={showErrors && !value.method ? 'Select a payment method' : undefined}
      >
        <Select
          id='disbursementMethod'
          value={value.method}
          onChange={(e) => update('method', e.target.value as DisbursementInfo['method'])}
        >
          <option value='' disabled>Select method</option>
          <option value='direct_deposit'>Direct deposit</option>
          <option value='check'>Check</option>
        </Select>
      </FieldGroup>

      {isDirectDeposit && (
        <div className='flex flex-col gap-5 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'>
          <FieldGroup
            label='Bank name'
            htmlFor='bankName'
            required
            error={required(value.bankName)}
          >
            <Input
              id='bankName'
              value={value.bankName}
              onChange={(e) => update('bankName', e.target.value)}
            />
          </FieldGroup>

          <FieldGroup
            label='Routing number'
            htmlFor='routingNumber'
            required
            error={required(value.routingNumber)}
          >
            <Input
              id='routingNumber'
              value={value.routingNumber}
              onChange={(e) => update('routingNumber', e.target.value)}
            />
          </FieldGroup>

          <FieldGroup
            label='Account number'
            htmlFor='accountNumber'
            required
            error={required(value.accountNumber)}
          >
            <Input
              id='accountNumber'
              value={value.accountNumber}
              onChange={(e) => update('accountNumber', e.target.value)}
            />
          </FieldGroup>

          <FieldGroup
            label='Account type'
            htmlFor='accountType'
            required
            error={showErrors && !value.accountType ? 'Select account type' : undefined}
          >
            <Select
              id='accountType'
              value={value.accountType}
              onChange={(e) => update('accountType', e.target.value as DisbursementInfo['accountType'])}
            >
              <option value='' disabled>Select account type</option>
              {ACCOUNT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </FieldGroup>
        </div>
      )}
    </div>
  )
}
