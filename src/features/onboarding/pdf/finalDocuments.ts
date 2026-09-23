/**
 * Data builders for documents we issue as FINAL prefilled PDFs (no
 * download-fill-reupload step): LIC 501 (Personnel Record) and SOC 341A
 * (Abuse Reporting Statement). Used at application submit time and by the
 * HR-side "generate missing documents" action for people who applied before
 * these documents were generated. The typed full name serves as the
 * signature, consistent with the W-4/I-9/acknowledgment flows.
 */

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
