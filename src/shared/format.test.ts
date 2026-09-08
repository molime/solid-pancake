import { describe, it, expect } from 'vitest'
import { formatDocumentCategoryLabel, formatStatusLabel, formatDateUS, calculateAge, formatIncidentCategoryLabel, formatIncidentStatusLabel, formatAgencyNotifiedLabel } from './format'

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

describe('formatIncidentCategoryLabel', () => {
  it('maps known incident categories to human-readable labels', () => {
    expect(formatIncidentCategoryLabel('death')).toBe('Death')
    expect(formatIncidentCategoryLabel('serious_injury')).toBe('Serious injury')
    expect(formatIncidentCategoryLabel('hospitalization')).toBe('Hospitalization')
    expect(formatIncidentCategoryLabel('emergency_room_visit')).toBe('Emergency room visit')
    expect(formatIncidentCategoryLabel('medication_error')).toBe('Medication error')
    expect(formatIncidentCategoryLabel('suspected_abuse')).toBe('Suspected abuse')
    expect(formatIncidentCategoryLabel('suspected_exploitation')).toBe('Suspected exploitation')
    expect(formatIncidentCategoryLabel('suspected_neglect')).toBe('Suspected neglect')
    expect(formatIncidentCategoryLabel('victim_of_crime')).toBe('Victim of crime')
    expect(formatIncidentCategoryLabel('missing_person')).toBe('Missing person')
    expect(formatIncidentCategoryLabel('unauthorized_absence')).toBe('Unauthorized absence')
    expect(formatIncidentCategoryLabel('aggressive_act')).toBe('Aggressive act')
    expect(formatIncidentCategoryLabel('rights_violation')).toBe('Rights violation')
    expect(formatIncidentCategoryLabel('other')).toBe('Other')
  })

  it('falls back to formatStatusLabel for unknown categories', () => {
    expect(formatIncidentCategoryLabel('unknown_thing')).toBe(formatStatusLabel('unknown_thing'))
  })
})

describe('formatIncidentStatusLabel', () => {
  it('maps known incident statuses to human-readable labels', () => {
    expect(formatIncidentStatusLabel('draft')).toBe('Report pending')
    expect(formatIncidentStatusLabel('verbal_reported')).toBe('Verbal reported')
    expect(formatIncidentStatusLabel('written_submitted')).toBe('Written submitted')
    expect(formatIncidentStatusLabel('closed')).toBe('Closed')
  })

  it('falls back to formatStatusLabel for unknown statuses', () => {
    expect(formatIncidentStatusLabel('unknown_status')).toBe(formatStatusLabel('unknown_status'))
  })
})

describe('formatAgencyNotifiedLabel', () => {
  it('maps known agency codes to human-readable labels', () => {
    expect(formatAgencyNotifiedLabel('aps')).toBe('Adult Protective Services')
    expect(formatAgencyNotifiedLabel('cps')).toBe('Child Protective Services')
    expect(formatAgencyNotifiedLabel('ccl')).toBe('Community Care Licensing')
    expect(formatAgencyNotifiedLabel('law_enforcement')).toBe('Law enforcement')
    expect(formatAgencyNotifiedLabel('ombudsman')).toBe('Ombudsman')
    expect(formatAgencyNotifiedLabel('dph')).toBe('Dept. of Public Health')
    expect(formatAgencyNotifiedLabel('other')).toBe('Other')
  })

  it('falls back to formatStatusLabel for unknown agencies', () => {
    expect(formatAgencyNotifiedLabel('unknown_agency')).toBe(formatStatusLabel('unknown_agency'))
  })
})

describe('formatDateUS', () => {
  it('formats Date objects as mm/dd/yyyy', () => {
    expect(formatDateUS(new Date(2026, 6, 21))).toBe('07/21/2026')
    expect(formatDateUS(new Date(2026, 0, 5))).toBe('01/05/2026')
    expect(formatDateUS(new Date(2026, 11, 31))).toBe('12/31/2026')
  })

  it('handles ISO date-only strings without timezone shift', () => {
    expect(formatDateUS('2026-07-21')).toBe('07/21/2026')
    expect(formatDateUS('2026-01-05')).toBe('01/05/2026')
  })

  it('handles ISO strings with explicit local time', () => {
    expect(formatDateUS('2026-07-21T12:00:00')).toBe('07/21/2026')
  })

  it('returns an empty string for null/undefined', () => {
    expect(formatDateUS(null)).toBe('')
    expect(formatDateUS(undefined)).toBe('')
  })
})

describe('calculateAge', () => {
  it('returns the correct age for a past birthday this year', () => {
    const today = new Date()
    const birth = new Date(today.getFullYear() - 30, 0, 1)
    expect(calculateAge(birth.toISOString().slice(0, 10))).toBe(30)
  })

  it('subtracts one year when the birthday has not occurred yet this year', () => {
    const today = new Date()
    const birth = new Date(today.getFullYear() - 30, 11, 31)
    const expected = today < new Date(today.getFullYear(), 11, 31) ? 29 : 30
    expect(calculateAge(birth.toISOString().slice(0, 10))).toBe(expected)
  })

  it('returns undefined for undefined input', () => {
    expect(calculateAge(undefined)).toBeUndefined()
  })

  it('returns undefined for an invalid date string', () => {
    expect(calculateAge('not-a-date')).toBeUndefined()
  })

  it('handles leap day birthdays without crashing', () => {
    expect(calculateAge('2000-02-29')).toBeTypeOf('number')
  })
})
