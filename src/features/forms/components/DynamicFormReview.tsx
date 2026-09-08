import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  type FormDefinition,
  type FormAnswers,
  normalizeOptions,
} from '../model/formFieldTypes'

interface DynamicFormReviewProps {
  form: FormDefinition
  answers: FormAnswers
}

function formatValue(value: unknown, type?: string): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (type === 'date' && typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
  }
  return String(value)
}

export function DynamicFormReview({ form, answers }: DynamicFormReviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{form.name}</CardTitle>
        {form.description && (
          <p className="mt-1 text-sm text-atria-text-secondary">{form.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {form.fields.map((field) => {
            const rawValue = answers[field.id]
            let displayValue = formatValue(rawValue, field.type)
            if (field.type === 'select' && typeof rawValue === 'string') {
              const option = normalizeOptions(field.options).find(
                (opt) => opt.value === rawValue,
              )
              if (option) displayValue = option.label
            }
            return (
              <div key={field.id} className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-atria-text-secondary">
                  {field.label}
                  {field.required && <span className="ml-1 text-atria-danger">*</span>}
                </dt>
                <dd className="text-base text-atria-ink whitespace-pre-wrap">
                  {displayValue}
                </dd>
              </div>
            )
          })}
        </dl>
      </CardContent>
    </Card>
  )
}
