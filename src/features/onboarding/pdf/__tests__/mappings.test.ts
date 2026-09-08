import { describe, it, expect } from 'vitest'
import { MAPPINGS, getMapping, toPdfY, type PdfFieldMapping } from '../mappings'

const LETTER_WIDTH = 612
const LETTER_HEIGHT = 792

describe('PDF coordinate mappings', () => {
  it('converts PyMuPDF top-left origin to pdf-lib bottom-left origin', () => {
    expect(toPdfY(105, 10)).toBe(792 - 105 - 10)
    expect(toPdfY(358, 9)).toBe(792 - 358 - 9)
  })

  it('exposes mappings for all document types', () => {
    expect(Object.keys(MAPPINGS).sort()).toEqual([
      'bcia_8016',
      'criminal_record',
      'de_34',
      'golden_ages_health_screen',
      'hcs_501',
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
    expect(getMapping('de_34')).toBe(MAPPINGS.de_34)
    expect(getMapping('bcia_8016')).toBe(MAPPINGS.bcia_8016)
    expect(getMapping('hcs_501')).toBe(MAPPINGS.hcs_501)
    expect(getMapping('unknown')).toBeUndefined()
  })

  it('has mapping keys that match the data produced by the form flows', () => {
    const expectedKeys: Record<string, string[]> = {
      health_screen: [
        'facilityName',
        'facilityAddress',
        'personName',
        'age',
        'positionTitle',
        'workDaysPerWeek',
        'workHoursPerDay',
        'applicantSignature',
        'applicantAddress',
        'date',
      ],
      golden_ages_health_screen: [
        'address',
        'date',
        'date',
        'dateOfBirth',
        'dateOfBirth',
        'email',
        'firstName',
        'lastName',
        'personName',
        'personName',
        'personName',
        'personName',
        'personName',
        'phone',
        'phone',
        'positionTitle',
        'positionTitle',
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
        'livedOtherStateYes',
        'livedOtherStateNo',
        'otherStatesLived',
        'facilityName',
        'facilityNumber',
        'name',
        'address',
        'socialSecurityNumber',
        'driversLicense',
        'dateOfBirth',
        'signature',
        'date',
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
      de_34: [
        'date',
        'caEmployerAccountNumber',
        'federalIdNumber',
        'businessName',
        'contactPerson',
        'contactPhone',
        'businessAddress',
        'employeeFirstName',
        'employeeMiddleInitial',
        'employeeLastName',
        'socialSecurityNumber',
        'streetNumber',
        'streetName',
        'unitApt',
        'city',
        'state',
        'zip',
        'startOfWorkDate',
      ],
      bcia_8016: [
        'ori',
        'authorizedApplicantType',
        'typeOfLicense',
        'agencyAuthorized',
        'agencyMailCode',
        'agencyStreetAddress',
        'agencyCity',
        'agencyZip',
        'agencyContactName',
        'agencyPhone',
        'applicantLastName',
        'applicantFirstName',
        'applicantSuffix',
        'aliasLastName',
        'aliasFirstName',
        'aliasSuffix',
        'dateOfBirth',
        'sexMale',
        'sexFemale',
        'sexNonbinary',
        'driverLicenseNumber',
        'height',
        'weight',
        'eyeColor',
        'hairColor',
        'placeOfBirth',
        'socialSecurityNumber',
        'homeAddressStreet',
        'homeAddressCity',
        'homeAddressZip',
        'billingNumber',
        'miscNumber',
        'dojChecked',
        'fbiChecked',
        'employerName',
        'employerAddress',
        'employerCity',
        'employerZip',
        'employerMailCode',
        'employerPhone',
        'applicantSignatureDate',
      ],
      hcs_501: [
        'agencyName',
        'agencyAddress',
        'agencyNumber',
        'dateOfEmployment',
        'name',
        'areaCode',
        'phone',
        'address',
        'dateOfBirth',
        'socialSecurityNumber',
        'lastTbTestDate',
        'lastTbTestResults',
        'cdlNumber',
        'positionTitle',
        'timeBase',
        'employer1NameAddress',
        'employer1PhoneArea',
        'employer1Phone',
        'employer1JobTitle',
        'employer1Reason',
        'employer1From',
        'employer1To',
        'signatureDate',
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
