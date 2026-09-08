export type IdType = 'ssn' | 'itin'
export type Availability = 'full_time' | 'part_time'
export type Shift = string
export type CitizenshipStatus =
  | 'citizen'
  | 'noncitizen_national'
  | 'lawful_permanent_resident'
  | 'alien_authorized'
export type FilingStatus =
  | 'single'
  | 'married_separately'
  | 'married_jointly'
  | 'head_of_household'
export type DisbursementMethod = 'direct_deposit' | 'check'
export type AccountType = 'checking' | 'savings'

export interface Address {
  street: string
  apt: string
  city: string
  state: string
  zip: string
}

export interface PersonalInfo {
  firstName: string
  lastName: string
  middleInitial: string
  ssn: string
  idType: IdType | ''
  address: Address
  homePhone: string
  cellPhone: string
  email: string
  dateOfBirth: string
  gender: 'male' | 'female' | ''
  is18OrOlder: boolean
  positionApplyingFor: string
  availability: Availability | ''
  shift: Shift | ''
  customHours: string
  daysOfWeek: string[]
  skills: string
  languages: string
  signLanguage: boolean
  canTransportClients: boolean | undefined // undefined = not yet answered
}

export interface EmploymentEntry {
  companyName: string
  position: string
  fromMoYr: string
  toMoYr: string
  supervisorContact: string
  jobDuties: string
  reasonForLeaving: string
}

export interface ReferenceEntry {
  name: string
  phone: string
  relationship: string
  address: string
}

export interface CriminalRecord {
  convictedCalifornia: boolean
  convictedOther: boolean
  convictedDetails: string
  convictedUnderAlias: boolean
  aliasNames: string
  // LIC 508 asks whether the applicant lived outside California in the past
  // five years. Only asked in the Golden Ages flow; undefined means the
  // applicant was never asked and the form boxes stay blank.
  livedOutsideCalifornia?: boolean
}

export interface DriversLicense {
  hasLicense: boolean
  cdlNumber: string
  suspended: boolean
}

export interface I9Info {
  lastName: string
  firstName: string
  middleInitial: string
  otherLastNames: string
  address: string
  aptNumber: string
  city: string
  state: string
  zip: string
  dateOfBirth: string
  ssn: string
  email: string
  phone: string
  citizenshipStatus: CitizenshipStatus | ''
  alienNumber: string
  signature: string
  date: string
}

export interface W4Dependents {
  qualifyingChildren: string
  otherDependents: string
  otherCredits: string
  total: string
}

export interface W4Info {
  firstName: string
  middleInitial: string
  lastName: string
  address: string
  cityStateZip: string
  ssn: string
  filingStatus: FilingStatus | ''
  multipleJobs: boolean
  dependents: W4Dependents
  otherIncome: string
  deductions: string
  extraWithholding: string
  signature: string
  date: string
}

export interface DisbursementInfo {
  method: DisbursementMethod | ''
  bankName: string
  routingNumber: string
  accountNumber: string
  accountType: AccountType | ''
}

export interface AcknowledgmentItem {
  agreed: boolean
  initials: string
  date: string
}

export interface Acknowledgments {
  jobDescription: AcknowledgmentItem
  employeeContract: AcknowledgmentItem
  employeeRights: AcknowledgmentItem
  hipaa: AcknowledgmentItem
  abuseNotice: AcknowledgmentItem
}

export interface ApplicationFormData {
  personal: PersonalInfo
  employment: EmploymentEntry[]
  currentlyEmployed: boolean
  mayContactEmployer: boolean
  references: ReferenceEntry[]
  criminalRecord: CriminalRecord
  driversLicense: DriversLicense
  i9: I9Info
  w4: W4Info
  disbursement: DisbursementInfo
  acknowledgments: Acknowledgments
  legalValidityAccepted: boolean
  branchType: string
  agencyName: string
}

export interface EmploymentSectionValue {
  employment: EmploymentEntry[]
  currentlyEmployed: boolean
  mayContactEmployer: boolean
}

export const POSITION_OPTIONS = [
  { value: 'Caregiver', label: 'Caregiver' },
  { value: 'Coordinator', label: 'Coordinator' },
  { value: 'Support Coordinator', label: 'Support Coordinator' },
  { value: 'Day Program Assistant', label: 'Day Program Assistant' },
]

export const GOLDEN_AGES_POSITION_OPTIONS = [
  { value: 'Affiliated Home Care Aide (HCA)', label: 'Affiliated Home Care Aide (HCA)' },
  { value: 'Supervisor', label: 'Supervisor' },
  { value: 'Administrator', label: 'Administrator' },
  { value: 'Human Resource (HR) Manager', label: 'Human Resource (HR) Manager' },
  { value: 'Office Manager', label: 'Office Manager' },
  { value: 'Payroll Manager', label: 'Payroll Manager' },
  { value: 'CFO / Vice President of Finance', label: 'CFO / Vice President of Finance' },
]

export function positionOptionsForBranch(branchType?: string) {
  if (branchType === 'ILS') {
    return POSITION_OPTIONS.map((o) =>
      o.value === 'Caregiver' ? { value: 'ILS Instructor', label: 'ILS Instructor' } : o,
    )
  }
  return POSITION_OPTIONS
}

export function positionOptionsForAgency(agencyName?: string, branchType?: string) {
  if ((agencyName ?? '').toLowerCase().includes('golden')) {
    return GOLDEN_AGES_POSITION_OPTIONS
  }
  return positionOptionsForBranch(branchType)
}

export const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Morning (7am-3pm)' },
  { value: 'evening', label: 'Evening (3pm-11pm)' },
  { value: 'overnight', label: 'Overnight (11pm-7am)' },
] as const

export const PART_TIME_SHIFT_OPTIONS = SHIFT_OPTIONS.filter((o) => o.value !== 'overnight')

export const DAYS_OF_WEEK_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export const AVAILABILITY_OPTIONS = [
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
]

export const ID_TYPE_OPTIONS = [
  { value: 'ssn', label: 'Social Security Number (SSN)' },
  { value: 'itin', label: 'Individual Taxpayer Identification Number (ITIN)' },
]

export const STATE_OPTIONS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]

export const CITIZENSHIP_OPTIONS = [
  { value: 'citizen', label: 'U.S. citizen' },
  { value: 'noncitizen_national', label: 'U.S. noncitizen national' },
  { value: 'lawful_permanent_resident', label: 'Lawful permanent resident' },
  { value: 'alien_authorized', label: 'Alien authorized to work' },
]

export const FILING_STATUS_OPTIONS = [
  { value: 'single', label: 'Single or married filing separately' },
  { value: 'married_separately', label: 'Married filing separately' },
  { value: 'married_jointly', label: 'Married filing jointly' },
  { value: 'head_of_household', label: 'Head of household' },
]

export const ACCOUNT_TYPE_OPTIONS = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
]

const emptyAddress = (): Address => ({
  street: '',
  apt: '',
  city: '',
  state: '',
  zip: '',
})

const emptyEmploymentEntry = (): EmploymentEntry => ({
  companyName: '',
  position: '',
  fromMoYr: '',
  toMoYr: '',
  supervisorContact: '',
  jobDuties: '',
  reasonForLeaving: '',
})

const emptyReferenceEntry = (): ReferenceEntry => ({
  name: '',
  phone: '',
  relationship: '',
  address: '',
})

const emptyAcknowledgmentItem = (): AcknowledgmentItem => ({
  agreed: false,
  initials: '',
  date: new Date().toISOString().split('T')[0],
})

export function createDefaultApplicationFormData(
  prefs: {
    firstName?: string
    lastName?: string
    middleInitial?: string
    email?: string
    phone?: string
    agencyName?: string
    branchType?: string
  } = {},
): ApplicationFormData {
  const today = new Date().toISOString().split('T')[0]
  return {
    personal: {
      firstName: prefs.firstName || '',
      lastName: prefs.lastName || '',
      middleInitial: prefs.middleInitial || '',
      ssn: '',
      idType: '',
      address: emptyAddress(),
      homePhone: prefs.phone || '',
      cellPhone: '',
      email: prefs.email || '',
      dateOfBirth: '',
      gender: '',
      is18OrOlder: false,
      positionApplyingFor: '',
      availability: '',
      shift: '',
      customHours: '',
      daysOfWeek: [],
      skills: '',
      languages: '',
      signLanguage: false,
      canTransportClients: undefined,
    },
    employment: [emptyEmploymentEntry()],
    currentlyEmployed: false,
    mayContactEmployer: true,
    references: [emptyReferenceEntry()],
    criminalRecord: {
      convictedCalifornia: false,
      convictedOther: false,
      convictedDetails: '',
      convictedUnderAlias: false,
      aliasNames: '',
    },
    driversLicense: {
      hasLicense: false,
      cdlNumber: '',
      suspended: false,
    },
    i9: {
      lastName: prefs.lastName || '',
      firstName: prefs.firstName || '',
      middleInitial: '',
      otherLastNames: '',
      address: '',
      aptNumber: '',
      city: '',
      state: '',
      zip: '',
      dateOfBirth: '',
      ssn: '',
      email: prefs.email || '',
      phone: prefs.phone || '',
      citizenshipStatus: '',
      alienNumber: '',
      signature: '',
      date: today,
    },
    w4: {
      firstName: prefs.firstName || '',
      middleInitial: prefs.middleInitial || '',
      lastName: prefs.lastName || '',
      address: '',
      cityStateZip: '',
      ssn: '',
      filingStatus: '',
      multipleJobs: false,
      dependents: {
        qualifyingChildren: '',
        otherDependents: '',
        otherCredits: '',
        total: '',
      },
      otherIncome: '',
      deductions: '',
      extraWithholding: '',
      signature: '',
      date: today,
    },
    disbursement: {
      method: '',
      bankName: '',
      routingNumber: '',
      accountNumber: '',
      accountType: '',
    },
    acknowledgments: {
      jobDescription: emptyAcknowledgmentItem(),
      employeeContract: emptyAcknowledgmentItem(),
      employeeRights: emptyAcknowledgmentItem(),
      hipaa: emptyAcknowledgmentItem(),
      abuseNotice: emptyAcknowledgmentItem(),
    },
    legalValidityAccepted: false,
    branchType: prefs.branchType || 'main',
    agencyName: prefs.agencyName || '',
  }
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}
