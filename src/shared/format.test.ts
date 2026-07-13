import { describe, it, expect } from 'vitest'
import { formatDocumentCategoryLabel, formatStatusLabel } from './format'

describe('formatDocumentCategoryLabel', () => {
  it('maps known document categories to human-readable labels', () => {
    expect(formatDocumentCategoryLabel('photo_id')).toBe('Photo identification')
    expect(formatDocumentCategoryLabel('cpr_certificate')).toBe('CPR certificate')
    expect(formatDocumentCategoryLabel('background_check')).toBe('Background check')
    expect(formatDocumentCategoryLabel('employment_agreement')).toBe('Employment agreement')
    expect(formatDocumentCategoryLabel('form_submission')).toBe('Application form')
  })

  it('falls back to formatStatusLabel for unknown categories', () => {
    expect(formatDocumentCategoryLabel('unknown_thing')).toBe(formatStatusLabel('unknown_thing'))
  })
})
