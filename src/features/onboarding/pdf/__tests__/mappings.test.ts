import { describe, it, expect } from 'vitest'
import { MAPPINGS, getMapping, toPdfY, type PdfFieldMapping } from '../mappings'

const LETTER_WIDTH = 612
const LETTER_HEIGHT = 792

describe('PDF coordinate mappings', () => {
  it('converts PyMuPDF top-left origin to pdf-lib bottom-left origin', () => {
    expect(toPdfY(105, 10)).toBe(792 - 105 - 10)
    expect(toPdfY(358, 9)).toBe(792 - 358 - 9)
  })

  it('exposes mappings for all five document types', () => {
    expect(Object.keys(MAPPINGS).sort()).toEqual([
      'criminal_record',
      'health_screen',
      'i9',
      'live_scan',
      'w4',
    ])
  })

  it('returns the correct mapping via getMapping', () => {
    expect(getMapping('health_screen')).toBe(MAPPINGS.health_screen)
    expect(getMapping('live_scan')).toBe(MAPPINGS.live_scan)
    expect(getMapping('criminal_record')).toBe(MAPPINGS.criminal_record)
    expect(getMapping('w4')).toBe(MAPPINGS.w4)
    expect(getMapping('i9')).toBe(MAPPINGS.i9)
    expect(getMapping('unknown')).toBeUndefined()
  })

  it('has mapping keys that match the data produced by the form flows', () => {
    const expectedKeys: Record<string, string[]> = {
      health_screen: [
        'facilityName',
        'personName',
        'age',
        'positionTitle',
        'workDaysPerWeek',
        'workHoursPerDay',
        'applicantSignature',
        'applicantAddress',
        'date',
      ],
      live_scan: [
        'lastName',
        'firstName',
        'sexMale',
        'sexFemale',
        'dateOfBirth',
        'socialSecurityNumber',
        'homeAddressStreet',
        'homeAddressCityStateZip',
        'transactionDate',
      ],
      criminal_record: [
        'convictedCaliforniaYes',
        'convictedCaliforniaNo',
        'convictedOtherYes',
        'convictedOtherNo',
        'name',
        'address',
        'city',
        'zip',
        'socialSecurityNumber',
        'dateOfBirth',
        'printedName',
        'printedDate',
        'offense',
        'offenseLocation',
        'offenseDate',
        'offenseDescription',
      ],
      w4: [
        'firstName',
        'middleInitial',
        'lastName',
        'ssn',
        'address',
        'cityStateZip',
        'date',
        'signature',
        'filingStatusSingle',
        'filingStatusMarriedJointly',
        'filingStatusMarriedSeparately',
        'filingStatusHeadOfHousehold',
        'employerName',
        'firstDateOfEmployment',
        'ein',
      ],
      i9: [
        'lastName',
        'firstName',
        'middleInitial',
        'otherLastNames',
        'address',
        'aptNumber',
        'city',
        'state',
        'zip',
        'dateOfBirth',
        'ssn',
        'email',
        'phone',
        'citizenshipStatus',
        'alienNumber',
        'date',
        'signature',
      ],
    }

    for (const [type, mapping] of Object.entries(MAPPINGS) as Array<
      [string, PdfFieldMapping]
    >) {
      const keys = mapping.fields.map((f) => f.key).sort()
      expect(keys).toEqual(expectedKeys[type].sort())
    }
  })

  it('has fields with coordinates within US Letter bounds', () => {
    for (const [type, mapping] of Object.entries(MAPPINGS) as Array<
      [string, PdfFieldMapping]
    >) {
      expect(mapping.fields.length, `${type} should have fields`).toBeGreaterThan(0)
      for (const field of mapping.fields) {
        expect(field.x, `${type}.${field.key} x`).toBeGreaterThanOrEqual(0)
        expect(field.x, `${type}.${field.key} x`).toBeLessThanOrEqual(LETTER_WIDTH)
        expect(field.y, `${type}.${field.key} y`).toBeGreaterThanOrEqual(0)
        expect(field.y, `${type}.${field.key} y`).toBeLessThanOrEqual(LETTER_HEIGHT)
        expect(field.fontSize, `${type}.${field.key} fontSize`).toBeGreaterThan(0)
      }
    }
  })
})
