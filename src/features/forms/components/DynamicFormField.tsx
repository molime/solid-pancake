import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'
import { Select } from '@/shared/ui/Select'
import { Checkbox } from '@/shared/ui/Checkbox'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import {
  type FormFieldDefinition,
  normalizeOptions,
} from '../model/formFieldTypes'

interface DynamicFormFieldProps {
  field: FormFieldDefinition
  value: unknown
  error?: string
  onChange: (id: string, value: unknown) => void
}

export function DynamicFormField({ field, value, error, onChange }: DynamicFormFieldProps) {
  const inputId = `field-${field.id}`

  switch (field.type) {
    case 'date':
      return (
        <FieldGroup
          label={field.label}
          htmlFor={inputId}
          required={field.required}
          helperText={field.helperText}
          error={error}
        >
          <Input
            id={inputId}
            type="date"
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.id, e.target.value)}
            hasError={!!error}
          />
        </FieldGroup>
      )

    case 'textarea':
      return (
        <FieldGroup
          label={field.label}
          htmlFor={inputId}
          required={field.required}
          helperText={field.helperText}
          error={error}
        >
          <Textarea
            id={inputId}
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.id, e.target.value)}
            hasError={!!error}
          />
        </FieldGroup>
      )

    case 'select':
      return (
        <FieldGroup
          label={field.label}
          htmlFor={inputId}
          required={field.required}
          helperText={field.helperText}
          error={error}
        >
          <Select
            id={inputId}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            hasError={!!error}
          >
            <option value="" disabled>
              Select an option
            </option>
            {normalizeOptions(field.options).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FieldGroup>
      )

    case 'checkbox':
      return (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={inputId}
            className="flex cursor-pointer items-start gap-3 text-base font-medium text-atria-ink"
          >
            <Checkbox
              id={inputId}
              checked={value === true}
              onChange={(e) => onChange(field.id, e.target.checked)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
            <span className="text-base font-normal text-atria-ink">
              {field.label}
              {field.required && <span className="ml-1 text-atria-danger">*</span>}
            </span>
          </label>
          {field.helperText && !error && (
            <span id={`${inputId}-helper`} className="pl-7 text-sm text-atria-text-secondary">
              {field.helperText}
            </span>
          )}
          {error && (
            <span id={`${inputId}-error`} className="pl-7 text-sm text-atria-danger">
              {error}
            </span>
          )}
        </div>
      )

    case 'text':
    default:
      return (
        <FieldGroup
          label={field.label}
          htmlFor={inputId}
          required={field.required}
          helperText={field.helperText}
          error={error}
        >
          <Input
            id={inputId}
            type="text"
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.id, e.target.value)}
            hasError={!!error}
          />
        </FieldGroup>
      )
  }
}
