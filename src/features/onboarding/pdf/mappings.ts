export type PdfFieldMapping = {
  page: number
  fields: Array<{
    key: string
    x: number
    y: number
    fontSize: number
    maxWidth?: number
    page?: number
  }>
}

const PAGE_HEIGHT = 792

export function toPdfY(pymupdfY: number, fontSize: number): number {
  return PAGE_HEIGHT - pymupdfY - fontSize
}

const HEALTH_SCREEN_MAPPING: PdfFieldMapping = {
  page: 0,
  fields: [
    { key: 'facilityName', x: 330, y: toPdfY(105, 9), fontSize: 9, maxWidth: 185 },
    { key: 'personName', x: 85, y: toPdfY(155, 10), fontSize: 10, maxWidth: 200 },
    { key: 'age', x: 540, y: toPdfY(155, 10), fontSize: 10 },
    { key: 'positionTitle', x: 30, y: toPdfY(178, 9), fontSize: 9, maxWidth: 105 },
    { key: 'workDaysPerWeek', x: 455, y: toPdfY(178, 10), fontSize: 10, maxWidth: 35 },
    { key: 'workHoursPerDay', x: 525, y: toPdfY(178, 10), fontSize: 10, maxWidth: 35 },
    { key: 'applicantSignature', x: 46, y: toPdfY(359, 10), fontSize: 10, maxWidth: 135 },
    { key: 'applicantAddress', x: 252, y: toPdfY(359, 9), fontSize: 9, maxWidth: 260 },
    { key: 'date', x: 526, y: toPdfY(358, 9), fontSize: 9, maxWidth: 20 },
  ],
}

const LIVE_SCAN_MAPPING: PdfFieldMapping = {
  page: 0,
  fields: [
    { key: 'lastName', x: 198, y: toPdfY(312, 10), fontSize: 10, maxWidth: 150 },
    { key: 'firstName', x: 353, y: toPdfY(311, 10), fontSize: 10, maxWidth: 130 },
    { key: 'sexMale', x: 212, y: toPdfY(377, 12), fontSize: 12 },
    { key: 'sexFemale', x: 264, y: toPdfY(377, 12), fontSize: 12 },
    { key: 'dateOfBirth', x: 60, y: toPdfY(375, 10), fontSize: 10, maxWidth: 130 },
    { key: 'socialSecurityNumber', x: 70, y: toPdfY(491, 10), fontSize: 10, maxWidth: 160 },
    { key: 'homeAddressStreet', x: 353, y: toPdfY(461, 9), fontSize: 9, maxWidth: 220 },
    { key: 'homeAddressCityStateZip', x: 349, y: toPdfY(493, 9), fontSize: 9, maxWidth: 220 },
    { key: 'transactionDate', x: 440, y: toPdfY(706, 10), fontSize: 10, maxWidth: 100 },
  ],
}

const CRIMINAL_RECORD_MAPPING: PdfFieldMapping = {
  page: 0,
  fields: [
    { key: 'convictedCaliforniaYes', x: 490, y: toPdfY(162, 14), fontSize: 14 },
    { key: 'convictedCaliforniaNo', x: 538, y: toPdfY(162, 14), fontSize: 14 },
    { key: 'convictedOtherYes', x: 490, y: toPdfY(232, 14), fontSize: 14 },
    { key: 'convictedOtherNo', x: 538, y: toPdfY(232, 14), fontSize: 14 },
    // FACILITY NAME (y≈587): we don't have the facility name for the criminal
    // record form — leave blank. FACILITY NUMBER: no data, left blank.
    { key: 'name', x: 40, y: toPdfY(627, 10), fontSize: 10, maxWidth: 200 },
    { key: 'address', x: 260, y: toPdfY(627, 10), fontSize: 10, maxWidth: 135 },
    { key: 'city', x: 410, y: toPdfY(627, 10), fontSize: 10, maxWidth: 85 },
    { key: 'zip', x: 510, y: toPdfY(627, 10), fontSize: 10, maxWidth: 60 },
    { key: 'socialSecurityNumber', x: 40, y: toPdfY(672, 10), fontSize: 10, maxWidth: 200 },
    { key: 'dateOfBirth', x: 260, y: toPdfY(672, 10), fontSize: 10, maxWidth: 235 },
    { key: 'printedName', x: 40, y: toPdfY(699, 10), fontSize: 10, maxWidth: 350 },
    { key: 'printedDate', x: 410, y: toPdfY(699, 10), fontSize: 10, maxWidth: 160 },
    { key: 'offense', x: 188, y: toPdfY(98, 10), fontSize: 10, maxWidth: 380, page: 1 },
    { key: 'offenseLocation', x: 344, y: toPdfY(175, 10), fontSize: 10, maxWidth: 220, page: 1 },
    { key: 'offenseDate', x: 183, y: toPdfY(228, 10), fontSize: 10, maxWidth: 380, page: 1 },
    { key: 'offenseDescription', x: 424, y: toPdfY(286, 10), fontSize: 10, maxWidth: 140, page: 1 },
  ],
}

const W4_MAPPING: PdfFieldMapping = {
  page: 0,
  fields: [
    { key: 'firstName', x: 96, y: toPdfY(97, 10), fontSize: 10, maxWidth: 100 },
    { key: 'middleInitial', x: 200, y: toPdfY(97, 10), fontSize: 10, maxWidth: 40 },
    { key: 'lastName', x: 280, y: toPdfY(97, 10), fontSize: 10, maxWidth: 190 },
    { key: 'ssn', x: 480, y: toPdfY(97, 10), fontSize: 10, maxWidth: 90 },
    { key: 'address', x: 96, y: toPdfY(122, 10), fontSize: 10, maxWidth: 375 },
    { key: 'cityStateZip', x: 96, y: toPdfY(146, 10), fontSize: 10, maxWidth: 375 },
    { key: 'filingStatusSingle', x: 50, y: toPdfY(170, 12), fontSize: 12 },
    { key: 'filingStatusMarriedJointly', x: 50, y: toPdfY(180, 12), fontSize: 12 },
    { key: 'filingStatusMarriedSeparately', x: 250, y: toPdfY(170, 12), fontSize: 12 },
    { key: 'filingStatusHeadOfHousehold', x: 250, y: toPdfY(192, 12), fontSize: 12 },
    { key: 'signature', x: 116, y: toPdfY(658, 10), fontSize: 10, maxWidth: 340 },
    { key: 'date', x: 472, y: toPdfY(658, 10), fontSize: 10, maxWidth: 110 },
    { key: 'employerName', x: 95, y: toPdfY(720, 10), fontSize: 10, maxWidth: 290 },
    { key: 'firstDateOfEmployment', x: 390, y: toPdfY(720, 10), fontSize: 10, maxWidth: 75 },
    { key: 'ein', x: 469, y: toPdfY(720, 10), fontSize: 10, maxWidth: 105 },
  ],
}

const I9_MAPPING: PdfFieldMapping = {
  page: 0,
  fields: [
    { key: 'lastName', x: 34, y: toPdfY(112, 10), fontSize: 10, maxWidth: 140 },
    { key: 'firstName', x: 190, y: toPdfY(112, 10), fontSize: 10, maxWidth: 140 },
    { key: 'middleInitial', x: 340, y: toPdfY(112, 10), fontSize: 10, maxWidth: 40 },
    { key: 'otherLastNames', x: 34, y: toPdfY(138, 10), fontSize: 10, maxWidth: 360 },
    { key: 'address', x: 34, y: toPdfY(164, 10), fontSize: 10, maxWidth: 220 },
    { key: 'aptNumber', x: 260, y: toPdfY(164, 10), fontSize: 10, maxWidth: 80 },
    { key: 'city', x: 34, y: toPdfY(190, 10), fontSize: 10, maxWidth: 120 },
    { key: 'state', x: 160, y: toPdfY(190, 10), fontSize: 10, maxWidth: 40 },
    { key: 'zip', x: 210, y: toPdfY(190, 10), fontSize: 10, maxWidth: 80 },
    { key: 'dateOfBirth', x: 300, y: toPdfY(190, 10), fontSize: 10, maxWidth: 100 },
    { key: 'ssn', x: 34, y: toPdfY(216, 10), fontSize: 10, maxWidth: 120 },
    { key: 'email', x: 160, y: toPdfY(216, 10), fontSize: 10, maxWidth: 200 },
    { key: 'phone', x: 370, y: toPdfY(216, 10), fontSize: 10, maxWidth: 120 },
    { key: 'citizenshipStatus', x: 34, y: toPdfY(242, 10), fontSize: 10, maxWidth: 300 },
    { key: 'alienNumber', x: 34, y: toPdfY(268, 10), fontSize: 10, maxWidth: 200 },
    { key: 'signature', x: 34, y: toPdfY(650, 10), fontSize: 10, maxWidth: 260 },
    { key: 'date', x: 300, y: toPdfY(650, 10), fontSize: 10, maxWidth: 100 },
  ],
}

export const MAPPINGS: Record<
  'health_screen' | 'live_scan' | 'criminal_record' | 'w4' | 'i9',
  PdfFieldMapping
> = {
  health_screen: HEALTH_SCREEN_MAPPING,
  live_scan: LIVE_SCAN_MAPPING,
  criminal_record: CRIMINAL_RECORD_MAPPING,
  w4: W4_MAPPING,
  i9: I9_MAPPING,
}

export function getMapping(type: string): PdfFieldMapping | undefined {
  return MAPPINGS[type as keyof typeof MAPPINGS]
}

/**
 * Normalize a W-4 form data object into the key shape expected by W4_MAPPING.
 * Filing status is converted to checkbox booleans and the nested dependents
 * object is flattened.
 */
export function normalizeW4PdfData(w4: Record<string, unknown>): Record<string, unknown> {
  const filingStatus = String(w4.filingStatus ?? '')
  const dependents = (w4.dependents ?? {}) as Record<string, unknown>
  return {
    ...w4,
    filingStatusSingle: filingStatus === 'single' || filingStatus === 'married_separately',
    filingStatusMarriedJointly: filingStatus === 'married_jointly',
    filingStatusMarriedSeparately: false,
    filingStatusHeadOfHousehold: filingStatus === 'head_of_household',
    multipleJobs: w4.multipleJobs === true,
    qualifyingChildren: dependents.qualifyingChildren ?? '',
    otherDependents: dependents.otherDependents ?? '',
    otherCredits: dependents.otherCredits ?? '',
    totalDependents: dependents.total ?? '',
  }
}
