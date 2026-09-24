/**
 * Data builders for documents we issue as FINAL prefilled PDFs (no
 * download-fill-reupload step): LIC 501 (Personnel Record) and SOC 341A
 * (Abuse Reporting Statement). Used at application submit time and by the
 * HR-side "generate missing documents" action for people who applied before
 * these documents were generated. The typed full name serves as the
 * signature, consistent with the W-4/I-9/acknowledgment flows.
 */
import { formatDateUS } from '@/shared/format'
import type { ApplicationFormData } from '../components/application/types'

export type EmployerInfoData = {
  legalName?: string
  address?: string
  phone?: string
  ein?: string
  caEmployerAccountNumber?: string
  homeCareOrganizationNumber?: string
  liveScanOri?: string
  liveScanMailCode?: string
}

function splitStreet(street = '') {
  const trimmed = street.trim()
  const parts = trimmed.split(/\s+/)
  const maybeNumber = parts[0] ?? ''
  const startsWithNumber = /^\d/.test(maybeNumber)
  const streetNumber = startsWithNumber ? maybeNumber : ''
  const streetName = startsWithNumber ? parts.slice(1).join(' ') : trimmed
  return { streetNumber, streetName }
}

function parsePhoneParts(phone = '') {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return { areaCode: digits.slice(0, 3), phone: digits.slice(3) }
  }
  return { areaCode: '', phone }
}

/** Golden Ages agency forms: DE 34 (new-hire report) and BCIA 8016 (Live Scan). */
export function buildGoldenAgesPrefilledData(
  data: ApplicationFormData,
  employerInfo?: EmployerInfoData,
) {
  const todayUs = new Date().toLocaleDateString('en-US')
  const personal = data.personal
  const address = personal.address
  const { streetNumber, streetName } = splitStreet(address.street)
  const employerName = employerInfo?.legalName ?? data.agencyName ?? ''
  const employerAddress = employerInfo?.address ?? ''
  const employerPhone = employerInfo?.phone ?? ''
  const employerPhoneParts = parsePhoneParts(employerPhone)

  // Simple employer address split: last two comma-separated parts are city/state+zip
  const employerAddressParts = employerAddress.split(',').map((s) => s.trim())
  const employerCity = employerAddressParts[employerAddressParts.length - 2] ?? ''
  const employerStateZip = employerAddressParts[employerAddressParts.length - 1] ?? ''
  const employerStateZipParts = employerStateZip.split(/\s+/)
  const employerZip = employerStateZipParts.slice(-1)[0] ?? ''

  const de34 = {
    // The top strip (report date, CA employer account number, branch code,
    // federal ID) is intentionally left blank — Golden Ages asked that
    // nothing be filled in those fields; HR completes them when filing.
    date: '',
    caEmployerAccountNumber: '',
    federalIdNumber: '',
    businessName: employerName,
    contactPerson: '',
    contactPhone: employerPhoneParts.phone ? `(${employerPhoneParts.areaCode}) ${employerPhoneParts.phone}` : employerPhone,
    businessAddress: employerAddress,
    employeeFirstName: personal.firstName,
    employeeMiddleInitial: personal.middleInitial,
    employeeLastName: personal.lastName,
    socialSecurityNumber: personal.ssn,
    streetNumber,
    streetName,
    unitApt: address.apt,
    city: address.city,
    state: address.state,
    zip: address.zip,
    startOfWorkDate: '',
  }

  const bcia8016 = {
    ori: employerInfo?.liveScanOri ?? '',
    authorizedApplicantType: 'Applicant',
    typeOfLicense: 'Home Care Aide',
    agencyAuthorized: employerName,
    agencyMailCode: employerInfo?.liveScanMailCode ?? '',
    agencyStreetAddress: employerAddress,
    agencyCity: employerCity,
    agencyZip: employerZip,
    agencyContactName: '',
    agencyPhone: employerPhoneParts.phone ? `(${employerPhoneParts.areaCode}) ${employerPhoneParts.phone}` : employerPhone,
    applicantLastName: personal.lastName,
    applicantFirstName: personal.firstName,
    applicantSuffix: '',
    aliasLastName: personal.middleInitial ? '' : '',
    aliasFirstName: '',
    aliasSuffix: '',
    dateOfBirth: formatDateUS(personal.dateOfBirth),
    sexMale: personal.gender === 'male' ? 'X' : '',
    sexFemale: personal.gender === 'female' ? 'X' : '',
    sexNonbinary: '',
    driverLicenseNumber: '',
    height: '',
    weight: '',
    eyeColor: '',
    hairColor: '',
    placeOfBirth: '',
    socialSecurityNumber: personal.ssn,
    homeAddressStreet: address.street,
    homeAddressCity: address.city,
    homeAddressZip: address.zip,
    billingNumber: '',
    miscNumber: '',
    dojChecked: 'X',
    fbiChecked: 'X',
    employerName,
    employerAddress,
    employerCity,
    employerZip,
    employerMailCode: employerInfo?.liveScanMailCode ?? '',
    employerPhone: employerPhoneParts.phone ? `(${employerPhoneParts.areaCode}) ${employerPhoneParts.phone}` : employerPhone,
    applicantSignatureDate: todayUs,
  }

  return { de34, bcia8016 }
}

export interface FinalDocPersonal {
  firstName?: string
  lastName?: string
  middleInitial?: string
  homePhone?: string
  cellPhone?: string
  ssn?: string
  positionApplyingFor?: string
  address?: {
    street?: string
    apt?: string
    city?: string
    state?: string
    zip?: string
  }
}

export interface FinalDocSources {
  personal: FinalDocPersonal
  i9?: { ssn?: string }
  w4?: { ssn?: string }
  agencyName: string
  agencyAddress?: string
  todayUs: string
}

function fullNameOf(personal: FinalDocPersonal): string {
  return `${personal.firstName ?? ''} ${personal.lastName ?? ''}`.trim()
}

function fullAddressOf(personal: FinalDocPersonal): string {
  const address = personal.address ?? {}
  return [address.street, address.apt, address.city, address.state, address.zip]
    .filter(Boolean)
    .join(', ')
}

export function buildLic501FinalData(args: FinalDocSources): Record<string, unknown> {
  const { personal, i9, w4, agencyName, agencyAddress, todayUs } = args
  return {
    date: todayUs,
    facilityName: agencyName,
    facilityAddress: agencyAddress ?? '',
    lastName: personal.lastName ?? '',
    firstName: personal.firstName ?? '',
    middleName: personal.middleInitial ?? '',
    phone: personal.cellPhone || personal.homePhone || '',
    address: fullAddressOf(personal),
    socialSecurityNumber: personal.ssn ?? w4?.ssn ?? i9?.ssn ?? '',
    positionTitle: personal.positionApplyingFor ?? '',
    signature: fullNameOf(personal),
    signatureDate: todayUs,
  }
}

export function buildSoc341aFinalData(args: FinalDocSources): Record<string, unknown> {
  const { personal, agencyName, todayUs } = args
  return {
    employeeName: fullNameOf(personal),
    positionTitle: personal.positionApplyingFor ?? '',
    facilityName: agencyName,
    signature: fullNameOf(personal),
    date: todayUs,
  }
}
