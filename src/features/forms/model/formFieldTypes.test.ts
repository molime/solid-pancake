import { describe, it, expect } from 'vitest'
import { normalizeOptions, validateForm } from './formFieldTypes'

describe('formFieldTypes utilities', () => {
  describe('normalizeOptions', () => {
    it('converts string options to labeled options', () => {
      expect(normalizeOptions(['Yes', 'No'])).toEqual([
        { label: 'Yes', value: 'Yes' },
        { label: 'No', value: 'No' },
      ])
    })

    it('leaves object options unchanged', () => {
      expect(normalizeOptions([{ label: 'Yes', value: 'yes' }])).toEqual([
        { label: 'Yes', value: 'yes' },
      ])
    })

    it('returns empty array for undefined', () => {
      expect(normalizeOptions(undefined)).toEqual([])
    })
  })

  describe('validateForm', () => {
    it('returns errors for missing required fields', () => {
      const errors = validateForm(
        {
          fields: [
            { id: 'name', type: 'text', label: 'Name', required: true },
            { id: 'email', type: 'text', label: 'Email', required: false },
          ],
        },
        {},
      )
      expect(errors.name).toBe('Name is required')
      expect(errors.email).toBeUndefined()
    })

    it('accepts filled required fields', () => {
      const errors = validateForm(
        {
          fields: [{ id: 'name', type: 'text', label: 'Name', required: true }],
        },
        { name: 'Sofia' },
      )
      expect(Object.keys(errors)).toHaveLength(0)
    })

    it('flags unchecked required checkbox', () => {
      const errors = validateForm(
        {
          fields: [
            { id: 'agree', type: 'checkbox', label: 'I agree', required: true },
          ],
        },
        { agree: false },
      )
      expect(errors.agree).toBe('I agree is required')
    })
  })
})
