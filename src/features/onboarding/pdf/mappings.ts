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
    { key: 'facilityAddress', x: 330, y: toPdfY(127, 9), fontSize: 9, maxWidth: 250 },
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

// Golden Ages Home Care health documents (Health Questionnaire, TB screening,
// Hepatitis B, Employee Health Statement, Influenza Vaccine, COVID-19 religious
// exemption). The template has small placeholder labels inside each blank line;
// we white them out and overlay the applicant's data.
const GOLDEN_AGES_HEALTH_SCREEN_MAPPING: PdfFieldMapping = {
  page: 0,
  fields: [
    // Page 2 — Health Questionnaire / Medical History.
    { key: 'personName', x: 108.75, y: toPdfY(74.65, 10), fontSize: 10, maxWidth: 330 },
    { key: 'date', x: 465.75, y: toPdfY(76.9, 10), fontSize: 10, maxWidth: 95 },
    { key: 'address', x: 121.5, y: toPdfY(105.4, 10), fontSize: 10, maxWidth: 310 },
    { key: 'phone', x: 453.75, y: toPdfY(103.9, 10), fontSize: 10, maxWidth: 110 },
    { key: 'dateOfBirth', x: 141.75, y: toPdfY(133.15, 10), fontSize: 10, maxWidth: 90 },
    // Page 3 — Tuberculosis Screening Questionnaire.
    { key: 'personName', x: 131.25, y: toPdfY(95.65, 10), fontSize: 10, maxWidth: 410, page: 2 },
    { key: 'date', x: 498.75, y: toPdfY(120.4, 10), fontSize: 10, maxWidth: 70, page: 2 },
    // Page 5 — Employee Health Statement.
    { key: 'personName', x: 113.25, y: toPdfY(159.4, 10), fontSize: 10, maxWidth: 430, page: 4 },
    { key: 'dateOfBirth', x: 108, y: toPdfY(191.65, 10), fontSize: 10, maxWidth: 160, page: 4 },
    // Page 6 — Influenza Vaccine.
    { key: 'personName', x: 185.25, y: toPdfY(352.9, 10), fontSize: 10, maxWidth: 340, page: 5 },
    // Page 7 — Employee Flu Vaccine Tracking Form.
    { key: 'personName', x: 205.5, y: toPdfY(118.9, 10), fontSize: 10, maxWidth: 270, page: 6 },
    { key: 'positionTitle', x: 293.25, y: toPdfY(139.15, 8), fontSize: 8, maxWidth: 220, page: 6 },
    // Page 8 — COVID-19 Vaccination Religious Exemption.
    { key: 'firstName', x: 141.75, y: toPdfY(241.15, 10), fontSize: 10, maxWidth: 180, page: 7 },
    { key: 'lastName', x: 136.5, y: toPdfY(256.15, 10), fontSize: 10, maxWidth: 180, page: 7 },
    { key: 'positionTitle', x: 122.25, y: toPdfY(273.4, 10), fontSize: 10, maxWidth: 180, page: 7 },
    { key: 'phone', x: 156, y: toPdfY(305.65, 10), fontSize: 10, maxWidth: 180, page: 7 },
    { key: 'email', x: 153.75, y: toPdfY(322.15, 10), fontSize: 10, maxWidth: 180, page: 7 },
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

// LIC 508 — Criminal Record Statement & Out-of-State Disclosure (CDSS 7/21).
// Coordinates were taken from the AcroForm widget rectangles of the official
// form (the boxes the agency annotated in CA Form_HHS_Criminal Record
// Disclosure_LIC508.pdf); x/y use PyMuPDF top-left origin via toPdfY.
const CRIMINAL_RECORD_MAPPING: PdfFieldMapping = {
  page: 0,
  fields: [
    // Form page 1: three YES/NO checkbox pairs — draw "X" centered in each box.
    { key: 'convictedCaliforniaYes', x: 494, y: toPdfY(156, 14), fontSize: 14 },
    { key: 'convictedCaliforniaNo', x: 545, y: toPdfY(156, 14), fontSize: 14 },
    { key: 'convictedOtherYes', x: 493, y: toPdfY(226, 14), fontSize: 14 },
    { key: 'convictedOtherNo', x: 545, y: toPdfY(226, 14), fontSize: 14 },
    { key: 'livedOtherStateYes', x: 493, y: toPdfY(374, 14), fontSize: 14 },
    { key: 'livedOtherStateNo', x: 545, y: toPdfY(374, 14), fontSize: 14 },
    // "If yes, list each state below" area on form page 1.
    { key: 'otherStatesLived', x: 42, y: toPdfY(591, 10), fontSize: 10, maxWidth: 528 },
    // Form page 2: affidavit block.
    { key: 'facilityName', x: 40, y: toPdfY(307, 10), fontSize: 10, maxWidth: 275, page: 1 },
    { key: 'facilityNumber', x: 324, y: toPdfY(307, 10), fontSize: 10, maxWidth: 248, page: 1 },
    { key: 'name', x: 40, y: toPdfY(354, 10), fontSize: 10, maxWidth: 532, page: 1 },
    { key: 'address', x: 40, y: toPdfY(396, 10), fontSize: 10, maxWidth: 532, page: 1 },
    { key: 'socialSecurityNumber', x: 40, y: toPdfY(452, 10), fontSize: 10, maxWidth: 203, page: 1 },
    { key: 'driversLicense', x: 254, y: toPdfY(452, 10), fontSize: 10, maxWidth: 203, page: 1 },
    { key: 'dateOfBirth', x: 465, y: toPdfY(452, 10), fontSize: 10, maxWidth: 107, page: 1 },
    { key: 'signature', x: 40, y: toPdfY(496, 10), fontSize: 10, maxWidth: 420, page: 1 },
    { key: 'date', x: 480, y: toPdfY(497, 10), fontSize: 10, maxWidth: 92, page: 1 },
  ],
}

// DE 34 — Report of New Employee(s). Only the first employee row is prefilled.
// y coordinates align with the form's AcroForm widget rectangles (CA
// Form_New Hire Report_de34.pdf); branch code is left blank (no data source).
const DE_34_MAPPING: PdfFieldMapping = {
  page: 0,
  fields: [
    { key: 'date', x: 49, y: toPdfY(95, 10), fontSize: 10, maxWidth: 80 },
    { key: 'caEmployerAccountNumber', x: 186, y: toPdfY(95, 10), fontSize: 10, maxWidth: 104 },
    { key: 'federalIdNumber', x: 371, y: toPdfY(95, 10), fontSize: 10, maxWidth: 121 },
    { key: 'businessName', x: 41, y: toPdfY(132, 10), fontSize: 10, maxWidth: 229 },
    { key: 'contactPerson', x: 270, y: toPdfY(132, 10), fontSize: 10, maxWidth: 198 },
    { key: 'contactPhone', x: 468, y: toPdfY(132, 10), fontSize: 10, maxWidth: 113 },
    { key: 'businessAddress', x: 41, y: toPdfY(155, 9), fontSize: 9, maxWidth: 540 },
    { key: 'employeeFirstName', x: 48, y: toPdfY(190, 10), fontSize: 10, maxWidth: 202 },
    { key: 'employeeMiddleInitial', x: 262, y: toPdfY(190, 10), fontSize: 10, maxWidth: 13 },
    { key: 'employeeLastName', x: 288, y: toPdfY(190, 10), fontSize: 10, maxWidth: 282 },
    { key: 'socialSecurityNumber', x: 49, y: toPdfY(214, 10), fontSize: 10, maxWidth: 118 },
    { key: 'streetNumber', x: 182, y: toPdfY(214, 10), fontSize: 10, maxWidth: 67 },
    { key: 'streetName', x: 262, y: toPdfY(214, 10), fontSize: 10, maxWidth: 240 },
    { key: 'unitApt', x: 518, y: toPdfY(214, 10), fontSize: 10, maxWidth: 53 },
    { key: 'city', x: 49, y: toPdfY(239, 10), fontSize: 10, maxWidth: 306 },
    { key: 'state', x: 369, y: toPdfY(239, 10), fontSize: 10, maxWidth: 26 },
    { key: 'zip', x: 411, y: toPdfY(239, 10), fontSize: 10, maxWidth: 67 },
    { key: 'startOfWorkDate', x: 491, y: toPdfY(239, 10), fontSize: 10, maxWidth: 79 },
  ],
}

// BCIA 8016 — Request for Live Scan Service (CA DOJ official form).
// Coordinates rebuilt from the form's AcroForm widget rectangles (CA
// ReqForLiveScan BCIA-8016.pdf).
const BCIA_8016_MAPPING: PdfFieldMapping = {
  page: 0,
  fields: [
    { key: 'ori', x: 30, y: toPdfY(109, 10), fontSize: 10, maxWidth: 263 },
    { key: 'authorizedApplicantType', x: 319, y: toPdfY(108, 10), fontSize: 10, maxWidth: 263 },
    { key: 'typeOfLicense', x: 30, y: toPdfY(136, 10), fontSize: 10, maxWidth: 551 },
    { key: 'agencyAuthorized', x: 31, y: toPdfY(181, 10), fontSize: 10, maxWidth: 260 },
    { key: 'agencyMailCode', x: 319, y: toPdfY(180, 10), fontSize: 10, maxWidth: 261 },
    { key: 'agencyStreetAddress', x: 31, y: toPdfY(208, 10), fontSize: 10, maxWidth: 260 },
    { key: 'agencyContactName', x: 319, y: toPdfY(208, 10), fontSize: 10, maxWidth: 261 },
    { key: 'agencyCity', x: 31, y: toPdfY(235, 10), fontSize: 10, maxWidth: 164 },
    { key: 'agencyZip', x: 244, y: toPdfY(235, 10), fontSize: 10, maxWidth: 49 },
    { key: 'agencyPhone', x: 319, y: toPdfY(235, 10), fontSize: 10, maxWidth: 261 },
    { key: 'applicantLastName', x: 30, y: toPdfY(279, 10), fontSize: 10, maxWidth: 262 },
    { key: 'applicantFirstName', x: 318, y: toPdfY(279, 10), fontSize: 10, maxWidth: 235 },
    { key: 'applicantSuffix', x: 562, y: toPdfY(279, 10), fontSize: 10, maxWidth: 19 },
    { key: 'aliasLastName', x: 30, y: toPdfY(320, 10), fontSize: 10, maxWidth: 262 },
    { key: 'aliasFirstName', x: 318, y: toPdfY(320, 10), fontSize: 10, maxWidth: 235 },
    { key: 'aliasSuffix', x: 562, y: toPdfY(320, 10), fontSize: 10, maxWidth: 19 },
    { key: 'dateOfBirth', x: 30, y: toPdfY(352, 10), fontSize: 10, maxWidth: 73 },
    { key: 'sexMale', x: 129, y: toPdfY(352, 12), fontSize: 12 },
    { key: 'sexFemale', x: 162, y: toPdfY(352, 12), fontSize: 12 },
    { key: 'sexNonbinary', x: 204, y: toPdfY(352, 12), fontSize: 12 },
    { key: 'driverLicenseNumber', x: 318, y: toPdfY(352, 10), fontSize: 10, maxWidth: 261 },
    { key: 'height', x: 30, y: toPdfY(379, 10), fontSize: 10, maxWidth: 53 },
    { key: 'weight', x: 102, y: toPdfY(379, 10), fontSize: 10, maxWidth: 53 },
    { key: 'eyeColor', x: 172, y: toPdfY(379, 10), fontSize: 10, maxWidth: 53 },
    { key: 'hairColor', x: 241, y: toPdfY(379, 10), fontSize: 10, maxWidth: 51 },
    { key: 'billingNumber', x: 350, y: toPdfY(386, 10), fontSize: 10, maxWidth: 231 },
    { key: 'placeOfBirth', x: 30, y: toPdfY(405, 10), fontSize: 10, maxWidth: 122 },
    { key: 'socialSecurityNumber', x: 172, y: toPdfY(405, 10), fontSize: 10, maxWidth: 120 },
    { key: 'miscNumber', x: 350, y: toPdfY(415, 10), fontSize: 10, maxWidth: 231 },
    { key: 'homeAddressStreet', x: 67, y: toPdfY(441, 10), fontSize: 10, maxWidth: 225 },
    { key: 'homeAddressCity', x: 318, y: toPdfY(441, 10), fontSize: 10, maxWidth: 165 },
    { key: 'homeAddressZip', x: 531, y: toPdfY(441, 10), fontSize: 10, maxWidth: 49 },
    { key: 'dojChecked', x: 406, y: toPdfY(522, 12), fontSize: 12 },
    { key: 'fbiChecked', x: 458, y: toPdfY(522, 12), fontSize: 12 },
    { key: 'applicantSignatureDate', x: 385, y: toPdfY(496, 10), fontSize: 10, maxWidth: 158 },
    { key: 'employerName', x: 30, y: toPdfY(615, 10), fontSize: 10, maxWidth: 550 },
    { key: 'employerAddress', x: 30, y: toPdfY(643, 10), fontSize: 10, maxWidth: 345 },
    { key: 'employerPhone', x: 384, y: toPdfY(643, 10), fontSize: 10, maxWidth: 196 },
    { key: 'employerCity', x: 30, y: toPdfY(670, 10), fontSize: 10, maxWidth: 228 },
    { key: 'employerZip', x: 314, y: toPdfY(670, 10), fontSize: 10, maxWidth: 61 },
    { key: 'employerMailCode', x: 384, y: toPdfY(670, 10), fontSize: 10, maxWidth: 196 },
  ],
}

// LIC 501 (3/99) — CDSS Personnel Record ("Form to be completed by employee").
// Coordinates come from the agency-annotated FreeText boxes in
// personnel-record2.pdf (converted to PyMuPDF top-left origin via toPdfY).
// Only fields we have data for at application time are prefilled; position
// details (supervisor/salary/hours/start date), education, and the signature
// are completed by the employee by hand.
const LIC_501_MAPPING: PdfFieldMapping = {
  page: 0,
  fields: [
    { key: 'date', x: 427.5, y: toPdfY(54.75, 9), fontSize: 9, maxWidth: 60 },
    { key: 'facilityName', x: 447, y: toPdfY(79.5, 9), fontSize: 9, maxWidth: 140 },
    { key: 'facilityAddress', x: 418.5, y: toPdfY(103.5, 8), fontSize: 8, maxWidth: 190 },
    { key: 'lastName', x: 34.5, y: toPdfY(167.25, 10), fontSize: 10, maxWidth: 105 },
    { key: 'firstName', x: 145.5, y: toPdfY(167.25, 10), fontSize: 10, maxWidth: 62 },
    { key: 'middleName', x: 213, y: toPdfY(167.25, 10), fontSize: 10, maxWidth: 65 },
    { key: 'phone', x: 437.25, y: toPdfY(170.25, 10), fontSize: 10, maxWidth: 135 },
    { key: 'address', x: 27.75, y: toPdfY(196.5, 10), fontSize: 10, maxWidth: 400 },
    { key: 'socialSecurityNumber', x: 33, y: toPdfY(230.25, 10), fontSize: 10, maxWidth: 200 },
    { key: 'positionTitle', x: 36.75, y: toPdfY(369, 10), fontSize: 10, maxWidth: 270 },
  ],
}

// HCS 501 — Home Care Organization Personnel Record.
const HCS_501_MAPPING: PdfFieldMapping = {
  page: 0,
  fields: [
    { key: 'agencyName', x: 343, y: toPdfY(90, 9), fontSize: 9, maxWidth: 232 },
    { key: 'agencyAddress', x: 343, y: toPdfY(117, 9), fontSize: 9, maxWidth: 232 },
    { key: 'agencyNumber', x: 343, y: toPdfY(135, 9), fontSize: 9, maxWidth: 232 },
    { key: 'dateOfEmployment', x: 343, y: toPdfY(153, 9), fontSize: 9, maxWidth: 232 },
    { key: 'name', x: 36, y: toPdfY(220, 10), fontSize: 10, maxWidth: 428 },
    { key: 'areaCode', x: 469, y: toPdfY(221, 10), fontSize: 10, maxWidth: 37 },
    { key: 'phone', x: 510, y: toPdfY(221, 10), fontSize: 10, maxWidth: 67 },
    { key: 'address', x: 35, y: toPdfY(243, 10), fontSize: 10, maxWidth: 427 },
    { key: 'dateOfBirth', x: 466, y: toPdfY(243, 10), fontSize: 10, maxWidth: 111 },
    { key: 'socialSecurityNumber', x: 38, y: toPdfY(265, 10), fontSize: 10, maxWidth: 320 },
    { key: 'lastTbTestDate', x: 359, y: toPdfY(265, 10), fontSize: 10, maxWidth: 106 },
    { key: 'lastTbTestResults', x: 466, y: toPdfY(265, 10), fontSize: 10, maxWidth: 110 },
    { key: 'cdlNumber', x: 415, y: toPdfY(311, 10), fontSize: 10, maxWidth: 151 },
    { key: 'positionTitle', x: 35, y: toPdfY(353, 10), fontSize: 10, maxWidth: 429 },
    { key: 'timeBase', x: 467, y: toPdfY(353, 10), fontSize: 10, maxWidth: 108 },
    { key: 'employer1NameAddress', x: 36, y: toPdfY(430, 9), fontSize: 9, maxWidth: 192 },
    { key: 'employer1PhoneArea', x: 231, y: toPdfY(421, 9), fontSize: 9, maxWidth: 26 },
    { key: 'employer1Phone', x: 259, y: toPdfY(421, 9), fontSize: 9, maxWidth: 47 },
    { key: 'employer1JobTitle', x: 307, y: toPdfY(430, 9), fontSize: 9, maxWidth: 90 },
    { key: 'employer1Reason', x: 399, y: toPdfY(430, 9), fontSize: 9, maxWidth: 78 },
    { key: 'employer1From', x: 476, y: toPdfY(430, 9), fontSize: 9, maxWidth: 52 },
    { key: 'employer1To', x: 526, y: toPdfY(430, 9), fontSize: 9, maxWidth: 50 },
    { key: 'signatureDate', x: 467, y: toPdfY(750, 10), fontSize: 10, maxWidth: 108 },
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
    // Section 1 — employee information (coordinates from the agency-annotated
    // boxes in i9Document.pdf, converted to PyMuPDF top-left origin).
    { key: 'lastName', x: 46.5, y: toPdfY(172.5, 10), fontSize: 10, maxWidth: 135 },
    { key: 'firstName', x: 209.25, y: toPdfY(172.5, 10), fontSize: 10, maxWidth: 105 },
    { key: 'middleInitial', x: 475, y: toPdfY(172.5, 10), fontSize: 10, maxWidth: 30 },
    { key: 'otherLastNames', x: 565, y: toPdfY(172.5, 10), fontSize: 10, maxWidth: 195 },
    { key: 'address', x: 45.75, y: toPdfY(198, 10), fontSize: 10, maxWidth: 255 },
    { key: 'aptNumber', x: 285, y: toPdfY(198, 10), fontSize: 10, maxWidth: 24 },
    { key: 'city', x: 312, y: toPdfY(198, 10), fontSize: 10, maxWidth: 145 },
    { key: 'state', x: 464.25, y: toPdfY(197.25, 10), fontSize: 10, maxWidth: 50 },
    { key: 'zip', x: 520.5, y: toPdfY(197.25, 10), fontSize: 10, maxWidth: 60 },
    { key: 'dateOfBirth', x: 48.75, y: toPdfY(227.25, 10), fontSize: 10, maxWidth: 100 },
    { key: 'ssn', x: 156, y: toPdfY(224.25, 10), fontSize: 10, maxWidth: 105 },
    { key: 'email', x: 267.75, y: toPdfY(223.5, 9), fontSize: 9, maxWidth: 185 },
    { key: 'phone', x: 461.25, y: toPdfY(224.25, 10), fontSize: 10, maxWidth: 115 },
    // Citizenship/immigration status checkboxes (X marks), top to bottom:
    // citizen, noncitizen national, lawful permanent resident, alien authorized.
    { key: 'citizenYes', x: 183.75, y: toPdfY(257.25, 12), fontSize: 12 },
    { key: 'noncitizenNationalYes', x: 183.75, y: toPdfY(270.75, 12), fontSize: 12 },
    { key: 'permanentResidentYes', x: 183.75, y: toPdfY(283.5, 12), fontSize: 12 },
    { key: 'alienAuthorizedYes', x: 183.75, y: toPdfY(296.25, 12), fontSize: 12 },
    { key: 'alienNumber', x: 210, y: toPdfY(296.25, 10), fontSize: 10, maxWidth: 200 },
    { key: 'signature', x: 47.25, y: toPdfY(357.75, 10), fontSize: 10, maxWidth: 300 },
    { key: 'date', x: 377.25, y: toPdfY(357, 10), fontSize: 10, maxWidth: 90 },
    // Section 2 — employer verification (first document slot positions measured
    // from the form's label text; employer block from the annotated boxes).
    { key: 'documentTitle', x: 38, y: toPdfY(442, 10), fontSize: 10, maxWidth: 325 },
    { key: 'issuingAuthority', x: 38, y: toPdfY(460, 10), fontSize: 10, maxWidth: 325 },
    { key: 'documentNumber', x: 38, y: toPdfY(478, 10), fontSize: 10, maxWidth: 325 },
    { key: 'expirationDate', x: 38, y: toPdfY(497, 10), fontSize: 10, maxWidth: 100 },
    { key: 'firstDateOfEmployment', x: 469.5, y: toPdfY(666, 10), fontSize: 10, maxWidth: 105 },
    { key: 'employerRepName', x: 47.25, y: toPdfY(695.25, 10), fontSize: 10, maxWidth: 240 },
    { key: 'employerSignature', x: 300, y: toPdfY(696.75, 10), fontSize: 10, maxWidth: 185 },
    { key: 'employerDate', x: 495.75, y: toPdfY(697.5, 10), fontSize: 10, maxWidth: 85 },
    { key: 'employerName', x: 46.5, y: toPdfY(726, 10), fontSize: 10, maxWidth: 195 },
    { key: 'employerAddress', x: 249, y: toPdfY(724.5, 9), fontSize: 9, maxWidth: 325 },
  ],
}

export const MAPPINGS: Record<
  | 'health_screen'
  | 'golden_ages_health_screen'
  | 'live_scan'
  | 'criminal_record'
  | 'w4'
  | 'i9'
  | 'de_34'
  | 'bcia_8016'
  | 'hcs_501'
  | 'lic_501',
  PdfFieldMapping
> = {
  health_screen: HEALTH_SCREEN_MAPPING,
  golden_ages_health_screen: GOLDEN_AGES_HEALTH_SCREEN_MAPPING,
  live_scan: LIVE_SCAN_MAPPING,
  criminal_record: CRIMINAL_RECORD_MAPPING,
  w4: W4_MAPPING,
  i9: I9_MAPPING,
  de_34: DE_34_MAPPING,
  bcia_8016: BCIA_8016_MAPPING,
  hcs_501: HCS_501_MAPPING,
  lic_501: LIC_501_MAPPING,
}

/**
 * Normalize I-9 form data into the key shape expected by I9_MAPPING.
 * citizenshipStatus is expanded into the four checkbox X marks; signature and
 * date are only drawn when present (the checklist I-9 download leaves them
 * blank for a handwritten signature).
 */
export function normalizeI9PdfData(i9: Record<string, unknown>): Record<string, unknown> {
  const status = String(i9.citizenshipStatus ?? '')
  return {
    ...i9,
    citizenYes: status === 'citizen' ? 'X' : '',
    noncitizenNationalYes: status === 'noncitizen_national' ? 'X' : '',
    permanentResidentYes: status === 'lawful_permanent_resident' ? 'X' : '',
    alienAuthorizedYes: status === 'alien_authorized' ? 'X' : '',
  }
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
