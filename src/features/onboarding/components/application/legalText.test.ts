import { describe, it, expect } from 'vitest'
import {
  ILS_JOB_DESCRIPTION,
  SLS_JOB_DESCRIPTION,
  JOB_DESCRIPTION_TEXT,
  EMPLOYEE_CONTRACT_TEXT,
  EMPLOYEE_RIGHTS_TEXT,
  HIPAA_TEXT,
  ABUSE_NOTICE_TEXT,
  LEGAL_VALIDITY_TEXT,
  ACKNOWLEDGMENT_DOCUMENTS,
  jobDescriptionForBranch,
} from './legalText'
import { positionOptionsForBranch } from './types'

describe('job descriptions', () => {
  it('returns the ILS Instructor description for the ILS branch', () => {
    expect(jobDescriptionForBranch('ILS')).toBe(ILS_JOB_DESCRIPTION)
  })

  it('contains the word-for-word ILS Instructor job description', () => {
    expect(ILS_JOB_DESCRIPTION).toContain('ILS Instructor Job Description')
    expect(ILS_JOB_DESCRIPTION).toContain('Independent Living Skills Services')
    expect(ILS_JOB_DESCRIPTION).toContain('Reports to: ILS Program Director')
    expect(ILS_JOB_DESCRIPTION).toContain(
      'ILS Instructors are responsible for providing skill training to individual participants as per their Individual Service Plan (ISP) and Individual Program Plan (IPP) goals and objectives.',
    )
    // Typos below exist in the original document and must be preserved verbatim
    expect(ILS_JOB_DESCRIPTION).toContain(
      'Assists participants in meeting their ISP/IPP goals and objectives thorugh best practice instructional techinques',
    )
    expect(ILS_JOB_DESCRIPTION).toContain(
      'updates the Program Dirctor regarding all contacts with Regional Center Staff',
    )
    expect(ILS_JOB_DESCRIPTION).toContain(
      'maintains confidentiality of informaiton obtained in the course of providing professional services',
    )
  })

  it('returns the SLS Support staff description for the SLS branch', () => {
    expect(jobDescriptionForBranch('SLS')).toBe(SLS_JOB_DESCRIPTION)
  })

  it('contains the word-for-word SLS Support staff job description', () => {
    expect(SLS_JOB_DESCRIPTION).toContain('SLS Support staff Job Description')
    expect(SLS_JOB_DESCRIPTION).toContain('Supported Living Services')
    expect(SLS_JOB_DESCRIPTION).toContain('Minimum Requirements Per Title 17')
    expect(SLS_JOB_DESCRIPTION).toContain(
      'SLS Support staffs are responsible for providing support to consumers as per their Individual Service Plan (ISP) and Individual Program Plan (IPP) goals and objectives.',
    )
    expect(SLS_JOB_DESCRIPTION).toContain(
      'Report any unusual occurrences or suspected abuse within 24 hours to SARC, and Program Director.',
    )
  })

  it('falls back to the generic description when no branch is selected', () => {
    expect(jobDescriptionForBranch(undefined)).toBe(JOB_DESCRIPTION_TEXT)
    expect(jobDescriptionForBranch('Daycare')).toBe(JOB_DESCRIPTION_TEXT)
  })

  it('uses Individuals Choice, Inc (not LLC) in the job descriptions', () => {
    expect(ILS_JOB_DESCRIPTION).toContain('Individuals Choice, Inc')
    expect(SLS_JOB_DESCRIPTION).toContain('Individuals Choice, Inc')
    expect(ILS_JOB_DESCRIPTION).not.toContain('LLC')
    expect(SLS_JOB_DESCRIPTION).not.toContain('LLC')
  })
})

describe('acknowledgment texts', () => {
  it('contains the word-for-word Employee Contract text', () => {
    expect(EMPLOYEE_CONTRACT_TEXT).toContain('EMPLOYEE CONTRACT')
    expect(EMPLOYEE_CONTRACT_TEXT).toContain('Standard of Conduct')
    expect(EMPLOYEE_CONTRACT_TEXT).toContain(
      'The Individuals Choice, Inc (IC) conduct policy is that all employees will observe certain standards of behavior while at work.',
    )
    expect(EMPLOYEE_CONTRACT_TEXT).toContain(
      'Excessive Tardiness: 4 times within a one-months period or one time a month for four consecutive months may result to termination.',
    )
    expect(EMPLOYEE_CONTRACT_TEXT).toContain(
      'employment at Individuals Choice, Inc (IC) is employment at-will',
    )
    expect(EMPLOYEE_CONTRACT_TEXT).toContain(
      'I have read, understood and agree to the above guidelines while under the employment of Individuals Choice, Inc (IC).',
    )
  })

  it('contains the word-for-word Employee Rights (LIC 9052) text', () => {
    expect(EMPLOYEE_RIGHTS_TEXT).toContain('EMPLOYEE RIGHTS')
    expect(EMPLOYEE_RIGHTS_TEXT).toContain('Health and Safety Code Sections 1596.881 and 1596.882')
    expect(EMPLOYEE_RIGHTS_TEXT).toContain(
      'File a claim with the Division of Labor Standards Enforcement no later than 90 days after the employer takes any of the above described actions against the employee.',
    )
    expect(EMPLOYEE_RIGHTS_TEXT).toContain('LIC 9052 (3/03)')
  })

  it('contains the word-for-word HIPAA text', () => {
    expect(HIPAA_TEXT).toContain('HIPPA and CONFIDENTIALITY CLAUSE')
    expect(HIPAA_TEXT).toContain('To: All Individuals Choice, Inc Employees')
    // 'HIPPA' and 'ACOUNTABILITY' are typos in the original document, preserved verbatim
    expect(HIPAA_TEXT).toContain('THE HEALTH INSURANCE PORTABILITY AND ACOUNTABILITY ACT (HIPPA)')
    expect(HIPAA_TEXT).toContain(
      'This Act was created to provide protection for personal health information. The Privacy Rule is a federal law which allows AN INDIVIDUAL certain RIGHTS over HIS/HER personal health information.',
    )
    expect(HIPAA_TEXT).toContain(
      'I will protect and refrain from disseminating any and/or all information regarding the health and well-being of the consumers entrusted in my care.',
    )
  })

  it('contains the word-for-word Abuse Notice (SOC 341A) text', () => {
    expect(ABUSE_NOTICE_TEXT).toContain('SOC 341A (3/03)')
    expect(ABUSE_NOTICE_TEXT).toContain('STATEMENT ACKNOWLEDGING REQUIREMENT TO REPORT')
    expect(ABUSE_NOTICE_TEXT).toContain('mandated reporter')
    expect(ABUSE_NOTICE_TEXT).toContain(
      'This must be done BY TELEPHONE IMMEDIATELY or as soon as practically possible, and BY WRITTEN REPORT WITHIN TWO (2) WORKING DAYS.',
    )
    expect(ABUSE_NOTICE_TEXT).toContain(
      'Failure to report abuse of an elder or dependent adult is a MISDEMEANOR CRIME, punishable by jail time, fine or both.',
    )
  })

  it('uses Individuals Choice, Inc (not LLC) in all acknowledgment texts', () => {
    for (const text of [EMPLOYEE_CONTRACT_TEXT, EMPLOYEE_RIGHTS_TEXT, HIPAA_TEXT, ABUSE_NOTICE_TEXT]) {
      expect(text).not.toContain('LLC')
    }
  })

  it('exposes all five acknowledgment documents with non-empty text', () => {
    expect(ACKNOWLEDGMENT_DOCUMENTS.map((d) => d.key)).toEqual([
      'jobDescription',
      'employeeContract',
      'employeeRights',
      'hipaa',
      'abuseNotice',
    ])
    for (const doc of ACKNOWLEDGMENT_DOCUMENTS) {
      expect(doc.title.trim().length).toBeGreaterThan(0)
      expect(doc.text.trim().length).toBeGreaterThan(0)
    }
  })

  it('states the legal validity of typed signatures', () => {
    expect(LEGAL_VALIDITY_TEXT).toContain('typing my name and/or initials')
    expect(LEGAL_VALIDITY_TEXT).toContain('same legal validity as a handwritten signature')
  })
})

describe('position options', () => {
  it('offers Caregiver, Coordinator, and Day Program Assistant by default', () => {
    expect(positionOptionsForBranch('SLS').map((o) => o.value)).toEqual([
      'Caregiver',
      'Coordinator',
      'Day Program Assistant',
    ])
  })

  it('replaces Caregiver with ILS Instructor for the ILS branch', () => {
    expect(positionOptionsForBranch('ILS').map((o) => o.value)).toEqual([
      'ILS Instructor',
      'Coordinator',
      'Day Program Assistant',
    ])
  })
})
