import { useMemo, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { DynamicFormField } from './DynamicFormField'
import {
  type FormDefinition,
  type FormAnswers,
  validateForm,
} from '../model/formFieldTypes'

interface DynamicFormProps {
  form: FormDefinition
  initialAnswers?: FormAnswers
  onSubmit: (answers: FormAnswers) => void | Promise<void>
  onChange?: (answers: FormAnswers) => void
  submitLabel?: string
  disabled?: boolean
}

export function DynamicForm({
  form,
  initialAnswers = {},
  onSubmit,
  onChange,
  submitLabel = 'Submit',
  disabled = false,
}: DynamicFormProps) {
  const [answers, setAnswers] = useState<FormAnswers>(initialAnswers)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (id: string, value: unknown) => {
    const next = { ...answers, [id]: value }
    setAnswers(next)
    if (errors[id]) {
      setErrors((prev) => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
    }
    onChange?.(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validateForm(form, answers)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setIsSubmitting(true)
    try {
      await onSubmit(answers)
    } finally {
      setIsSubmitting(false)
    }
  }

  const fieldList = useMemo(() => form.fields ?? [], [form.fields])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{form.name}</CardTitle>
        {form.description && (
          <p className="mt-1 text-sm text-atria-text-secondary">{form.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {fieldList.map((field) => (
            <DynamicFormField
              key={field.id}
              field={field}
              value={answers[field.id]}
              error={errors[field.id]}
              onChange={handleChange}
            />
          ))}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={disabled || isSubmitting}
            >
              {isSubmitting ? 'Submitting…' : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
