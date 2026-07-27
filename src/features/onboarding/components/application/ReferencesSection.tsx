import { Button } from '@/shared/ui/Button'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Input } from '@/shared/ui/Input'
import { type ReferenceEntry } from './types'
import { formatPhone, isValidPhone } from '@/shared/validation'

interface ReferencesSectionProps {
  value: ReferenceEntry[]
  onChange: (value: ReferenceEntry[]) => void
  showErrors?: boolean
}

const emptyEntry = (): ReferenceEntry => ({
  name: '',
  phone: '',
  relationship: '',
  address: '',
})

export function ReferencesSection({ value, onChange, showErrors }: ReferencesSectionProps) {
  const updateEntry = (index: number, key: keyof ReferenceEntry, val: string) => {
    const next = [...value]
    next[index] = { ...next[index], [key]: val }
    onChange(next)
  }

  const addEntry = () => {
    onChange([...value, emptyEntry()])
  }

  const removeEntry = (index: number) => {
    const next = value.filter((_, i) => i !== index)
    onChange(next.length ? next : [emptyEntry()])
  }

  const required = (val: string) => (showErrors && !val.trim() ? 'This field is required' : undefined)

  const phoneError = (val: string) =>
    showErrors && val.trim() && !isValidPhone(val) ? 'Enter a valid 10-digit phone number' : undefined

  return (
    <div className='flex flex-col gap-4'>
      {value.map((entry, index) => (
        <div
          key={index}
          className='rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'
        >
          <div className='mb-3 flex items-center justify-between'>
            <p className='text-sm font-semibold text-atria-ink'>Reference {index + 1}</p>
            {value.length > 1 && (
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
            <FieldGroup
              label='Full name'
              htmlFor={`refName-${index}`}
              required
              error={required(entry.name)}
            >
              <Input
                id={`refName-${index}`}
                value={entry.name}
                onChange={(e) => updateEntry(index, 'name', e.target.value)}
              />
            </FieldGroup>

            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <FieldGroup
                label='Phone'
                htmlFor={`refPhone-${index}`}
                required
                error={required(entry.phone) ?? phoneError(entry.phone)}
              >
                <Input
                  id={`refPhone-${index}`}
                  type='tel'
                  inputMode='numeric'
                  maxLength={14}
                  value={entry.phone}
                  onChange={(e) => updateEntry(index, 'phone', formatPhone(e.target.value))}
                />
              </FieldGroup>

              <FieldGroup
                label='Relationship'
                htmlFor={`refRelationship-${index}`}
                required
                error={required(entry.relationship)}
              >
                <Input
                  id={`refRelationship-${index}`}
                  value={entry.relationship}
                  onChange={(e) => updateEntry(index, 'relationship', e.target.value)}
                />
              </FieldGroup>
            </div>

            <FieldGroup
              label='Address'
              htmlFor={`refAddress-${index}`}
            >
              <Input
                id={`refAddress-${index}`}
                value={entry.address}
                onChange={(e) => updateEntry(index, 'address', e.target.value)}
              />
            </FieldGroup>
          </div>
        </div>
      ))}

      <Button type='button' variant='secondary' size='md' onClick={addEntry}>
        + Add another reference
      </Button>
    </div>
  )
}
