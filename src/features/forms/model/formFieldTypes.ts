export type FormFieldType = 'text' | 'date' | 'textarea' | 'select' | 'checkbox'

export interface FormFieldOption {
  label: string
  value: string
}

export interface FormFieldDefinition {
  id: string
  type: FormFieldType
  label: string
  required?: boolean
  placeholder?: string
  helperText?: string
  options?: string[] | FormFieldOption[]
}

export interface FormDefinition {
  _id?: string
  _creationTime?: number
  key?: string
  name: string
  description?: string
  category?: string
  order?: number
  active?: boolean
  fields: FormFieldDefinition[]
}

export type FormAnswers = Record<string, unknown>

export function normalizeOptions(options?: string[] | FormFieldOption[]): FormFieldOption[] {
  if (!options) return []
  return options.map((opt) =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt,
  )
}

export function validateForm(
  form: Pick<FormDefinition, 'fields'>,
  answers: FormAnswers,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of form.fields) {
    if (field.required) {
      const value = answers[field.id]
      const missing =
        value === undefined || value === null || value === '' || value === false
      if (missing) {
        errors[field.id] = `${field.label} is required`
      }
    }
  }
  return errors
}
