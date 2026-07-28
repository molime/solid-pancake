import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, useClerk } from '@clerk/react'
import { useTenant } from '@/app/useTenant'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Select } from '@/shared/ui/Select'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Card, CardContent } from '@/shared/ui/Card'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { ProgressSteps } from '@/shared/ui/ProgressSteps'
import { generatePrefilledPdf, saveAndDownload, saveAndUpload } from '../pdf/generatePrefilledPdf'
import { getMapping, normalizeW4PdfData } from '../pdf/mappings'
import { PersonalInfoSection } from '../components/application/PersonalInfoSection'
import { EmploymentHistorySection } from '../components/application/EmploymentHistorySection'
import { ReferencesSection } from '../components/application/ReferencesSection'
import { CriminalRecordSection } from '../components/application/CriminalRecordSection'
import { I9Section } from '../components/application/I9Section'
import { W4Section } from '../components/application/W4Section'
import { DisbursementSection } from '../components/application/DisbursementSection'
import { AcknowledgmentsSection } from '../components/application/AcknowledgmentsSection'
import {
  type ApplicationFormData,
  type DisbursementInfo,
  createDefaultApplicationFormData,
  isNonEmptyString,
  positionOptionsForBranch,
} from '../components/application/types'
import { prefilledI9FromPersonal, prefilledW4FromPersonal, mergeDraft } from './applicationUtils'
import { jobDescriptionForPosition, LEGAL_VALIDITY_TEXT } from '../components/application/legalText'
import { formatDateUS } from '@/shared/format'



const STEPS = [
  { id: 'jobDescription', label: 'Job description' },
  { id: 'personal', label: 'Personal info' },
  { id: 'employment', label: 'Employment & references' },
  { id: 'criminal', label: 'Criminal record' },
  { id: 'tax', label: 'I-9 & W-4' },
  { id: 'disbursement', label: 'Disbursement' },
  { id: 'acknowledgments', label: 'Acknowledgments' },
  { id: 'review', label: 'Review & submit' },
]

function splitName(full = '') {
  const parts = full.trim().split(/\s+/)
  const firstName = parts[0] || ''
  const lastName = parts.length > 1 ? parts[parts.length - 1] : ''
  const middleInitial = parts.length === 3 ? parts[1][0] : ''
  return { firstName, lastName, middleInitial }
}

function validatePersonal(personal: ApplicationFormData['personal']) {
  return (
    isNonEmptyString(personal.firstName) &&
    isNonEmptyString(personal.lastName) &&
    isNonEmptyString(personal.ssn) &&
    isNonEmptyString(personal.idType) &&
    isNonEmptyString(personal.address.street) &&
    isNonEmptyString(personal.address.city) &&
    isNonEmptyString(personal.address.state) &&
    isNonEmptyString(personal.address.zip) &&
    isNonEmptyString(personal.homePhone) &&
    isNonEmptyString(personal.cellPhone) &&
    isNonEmptyString(personal.email) &&
    isNonEmptyString(personal.dateOfBirth) &&
    isNonEmptyString(personal.gender) &&
    personal.is18OrOlder &&
    isNonEmptyString(personal.positionApplyingFor) &&
    isNonEmptyString(personal.availability) &&
    isNonEmptyString(personal.shift) &&
    personal.daysOfWeek.length > 0 &&
    (personal.availability !== 'part_time' || isNonEmptyString(personal.customHours))
  )
}

function validateEmployment(data: ApplicationFormData) {
  const validEmployment =
    data.employment.length > 0 &&
    data.employment.every(
      (e) =>
        isNonEmptyString(e.companyName) &&
        isNonEmptyString(e.position) &&
        isNonEmptyString(e.fromMoYr) &&
        isNonEmptyString(e.jobDuties),
    )
  const validReferences =
    data.references.length > 0 &&
    data.references.every(
      (r) =>
        isNonEmptyString(r.name) &&
        isNonEmptyString(r.phone) &&
        isNonEmptyString(r.relationship),
    )
  return validEmployment && validReferences
}

function validateCriminal(record: ApplicationFormData['criminalRecord']) {
  const hasConviction = record.convictedCalifornia || record.convictedOther
  if (hasConviction && !isNonEmptyString(record.convictedDetails)) return false
  if (record.convictedUnderAlias && !isNonEmptyString(record.aliasNames)) return false
  return true
}

function validateI9(i9: ApplicationFormData['i9']) {
  return (
    isNonEmptyString(i9.lastName) &&
    isNonEmptyString(i9.firstName) &&
    isNonEmptyString(i9.address) &&
    isNonEmptyString(i9.city) &&
    isNonEmptyString(i9.state) &&
    isNonEmptyString(i9.zip) &&
    isNonEmptyString(i9.dateOfBirth) &&
    isNonEmptyString(i9.ssn) &&
    isNonEmptyString(i9.citizenshipStatus) &&
    (i9.citizenshipStatus !== 'alien_authorized' || isNonEmptyString(i9.alienNumber)) &&
    isNonEmptyString(i9.signature) &&
    isNonEmptyString(i9.date)
  )
}

function validateW4(w4: ApplicationFormData['w4']) {
  return (
    isNonEmptyString(w4.firstName) &&
    isNonEmptyString(w4.lastName) &&
    isNonEmptyString(w4.address) &&
    isNonEmptyString(w4.cityStateZip) &&
    isNonEmptyString(w4.ssn) &&
    isNonEmptyString(w4.filingStatus) &&
    isNonEmptyString(w4.signature) &&
    isNonEmptyString(w4.date)
  )
}

function validateDisbursement(data: ApplicationFormData) {
  const { disbursement, personal } = data
  if (!disbursement.method) return false
  if (disbursement.method === 'direct_deposit') {
    return (
      personal.idType !== 'itin' &&
      isNonEmptyString(disbursement.bankName) &&
      isNonEmptyString(disbursement.routingNumber) &&
      isNonEmptyString(disbursement.accountNumber) &&
      isNonEmptyString(disbursement.accountType)
    )
  }
  return true
}

function validateAcknowledgments(ack: ApplicationFormData['acknowledgments']) {
  return Object.values(ack).every(
    (item) => item.agreed && isNonEmptyString(item.initials) && isNonEmptyString(item.date),
  )
}

function validateStep(step: number, data: ApplicationFormData, jdAgreed?: boolean) {
  switch (step) {
    case 0:
      return jdAgreed === true && data.legalValidityAccepted
    case 1:
      return validatePersonal(data.personal)
    case 2:
      return validateEmployment(data)
    case 3:
      return validateCriminal(data.criminalRecord)
    case 4:
      return validateI9(data.i9) && validateW4(data.w4)
    case 5:
      return validateDisbursement(data)
    case 6:
      return data.legalValidityAccepted && validateAcknowledgments(data.acknowledgments)
    case 7:
      return true
    default:
      return false
  }
}

function validateAll(data: ApplicationFormData) {
  return (
    data.legalValidityAccepted &&
    validatePersonal(data.personal) &&
    validateEmployment(data) &&
    validateCriminal(data.criminalRecord) &&
    validateI9(data.i9) &&
    validateW4(data.w4) &&
    validateDisbursement(data) &&
    validateAcknowledgments(data.acknowledgments)
  )
}

function formatValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string' && value.trim()) return value
  return '—'
}

// Health screen (LIC 503) schedule values derived from the availability step:
// days per week come from the selected days of week, hours per day from the
// selected shift (all full-time shifts are 8 hours) or the part-time custom hours.
function healthScreenSchedule(personal: ApplicationFormData['personal']) {
  const workDaysPerWeek = personal.daysOfWeek.length > 0 ? String(personal.daysOfWeek.length) : '5'
  const workHoursPerDay =
    personal.availability === 'part_time' ? personal.customHours || '8' : '8'
  return { workDaysPerWeek, workHoursPerDay }
}

function ReviewSection({ data }: { data: ApplicationFormData }) {
  return (
    <div className='flex flex-col gap-6 text-sm'>
      <section>
        <h3 className='mb-2 text-base font-semibold text-atria-ink'>Personal information</h3>
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
          <p><span className='text-atria-text-secondary'>Name:</span> {data.personal.firstName} {data.personal.middleInitial} {data.personal.lastName}</p>
          <p><span className='text-atria-text-secondary'>Email:</span> {data.personal.email}</p>
          <p><span className='text-atria-text-secondary'>Phone:</span> {data.personal.homePhone}</p>
          <p><span className='text-atria-text-secondary'>Position:</span> {data.personal.positionApplyingFor}</p>
        </div>
      </section>

      <section>
        <h3 className='mb-2 text-base font-semibold text-atria-ink'>Employment history</h3>
        <ul className='flex flex-col gap-2'>
          {data.employment.map((e, i) => (
            <li key={i} className='rounded-[var(--radius-atria-md)] bg-atria-surface-2 p-3'>
              {e.companyName} — {e.position} ({e.fromMoYr} to {e.toMoYr || 'Present'})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className='mb-2 text-base font-semibold text-atria-ink'>References</h3>
        <ul className='flex flex-col gap-2'>
          {data.references.map((r, i) => (
            <li key={i} className='rounded-[var(--radius-atria-md)] bg-atria-surface-2 p-3'>
              {r.name} — {r.relationship} ({r.phone})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className='mb-2 text-base font-semibold text-atria-ink'>I-9 & W-4</h3>
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
          <p><span className='text-atria-text-secondary'>I-9 status:</span> {formatValue(data.i9.citizenshipStatus)}</p>
          <p><span className='text-atria-text-secondary'>W-4 status:</span> {formatValue(data.w4.filingStatus)}</p>
        </div>
      </section>

      <section>
        <h3 className='mb-2 text-base font-semibold text-atria-ink'>Disbursement</h3>
        <p className='capitalize'>{data.disbursement.method.replace('_', ' ')}</p>
      </section>

      <section>
        <h3 className='mb-2 text-base font-semibold text-atria-ink'>Acknowledgments</h3>
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
          {Object.entries(data.acknowledgments).map(([key, item]) => (
            <p key={key}>
              <span className='text-atria-text-secondary'>{key}:</span>{' '}
              {item.agreed ? `Agreed (${item.initials})` : 'Not agreed'}
            </p>
          ))}
        </div>
      </section>
    </div>
  )
}


export function ApplicationFormPage() {
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { clerkOrgId, tenantName, isLoading } = useTenant()
  const { user, isLoaded: userLoaded } = useUser()
  const candidate = useQuery(
    api.candidates.getCandidateProfile,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const draft = useQuery(
    api.drafts.getDraft,
    clerkOrgId ? { clerkOrgId, formType: 'application' } : 'skip',
  )
  const myApplication = useQuery(
    api.candidates.getMyApplication,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const branches = useQuery(
    api.agencyConfig.listAgencyBranches,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const submit = useMutation(api.candidates.submitApplication)
  const saveDraft = useMutation(api.drafts.saveDraft)
  const deleteDraft = useMutation(api.drafts.deleteDraft)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const savePrefilledDocument = useMutation(api.candidates.savePrefilledDocument)

  const [data, setData] = useState<ApplicationFormData>(() => createDefaultApplicationFormData())
  const [step, setStep] = useState(() => {
    // Resume at the step the applicant left off at (same tab session).
    try {
      const saved = sessionStorage.getItem('atriax.application.step')
      const parsed = Number(saved)
      if (saved !== null && Number.isInteger(parsed) && parsed >= 0 && parsed < STEPS.length) {
        return parsed
      }
    } catch {
      // Storage might be restricted in some contexts
    }
    return 0
  })
  const [jdAgreed, setJdAgreed] = useState(false)
  const [generatedPdfs, setGeneratedPdfs] = useState<{ name: string; bytes: Uint8Array; description?: string }[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current?.scrollIntoView) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [step])

  // Persist the current step so an applicant who leaves and returns (same tab
  // session) resumes exactly where they left off.
  useEffect(() => {
    try {
      sessionStorage.setItem('atriax.application.step', String(step))
    } catch {
      // Storage might be restricted in some contexts
    }
  }, [step])
  const [showErrors, setShowErrors] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [hasInitialized, setHasInitialized] = useState(false)
  const draftSavedAtRef = useRef<number>(0)

  const stepLabel = useMemo(() => STEPS[step].label, [step])

  // The applicant's branch (ILS / SLS) drives which job description and
  // position options are shown.
  const branchType = useMemo(() => {
    if (!candidate?.branchId || !Array.isArray(branches)) return undefined
    const branch = branches.find((b) => b._id === candidate.branchId)
    return branch?.branchType as string | undefined
  }, [candidate, branches])

  const handleDisbursementChange = useCallback((disbursement: DisbursementInfo) => {
    setData((prev) => ({ ...prev, disbursement }))
  }, [])

  // Initialize form from defaults, candidate profile, and saved draft.
  // When no draft exists (e.g. the applicant returns after HR requested a
  // correction), fall back to the last submitted application so every section
  // — including the criminal record — stays editable with its previous data.
  useEffect(() => {
    if (isLoading || !userLoaded || candidate === undefined || draft === undefined) return
    if (myApplication === undefined || branches === undefined) return
    if (hasInitialized) return

    const { firstName, lastName, middleInitial } = splitName(
      candidate?.displayName || user?.fullName || '',
    )
    const email = candidate?.email || user?.primaryEmailAddress?.emailAddress || ''
    const phone = candidate?.phone || ''
    const agencyName = tenantName || ''

    const base = createDefaultApplicationFormData({
      firstName,
      lastName,
      middleInitial,
      email,
      phone,
      agencyName,
      branchType: branchType || 'main',
    })

    const submittedFields = myApplication?.application?.fields as Record<string, unknown> | undefined
    const merged = mergeDraft(base, draft?.data ?? submittedFields)
    // Pre-fill the position chosen on the /apply entry page (stored in
    // sessionStorage before sign-in) when the draft has none yet.
    let storedPosition = ''
    try {
      storedPosition = sessionStorage.getItem('atriax_apply_position') ?? ''
    } catch {
      // Storage might be restricted in some contexts
    }
    const nextPersonal = {
      ...merged.personal,
      firstName,
      lastName,
      middleInitial,
      email,
      homePhone: phone,
      positionApplyingFor: merged.personal.positionApplyingFor || storedPosition,
    }

    // One-time initialization after candidate profile and draft load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData({
      ...merged,
      personal: nextPersonal,
      i9: prefilledI9FromPersonal(nextPersonal, { ...merged.i9, firstName, lastName, email, phone }),
      w4: prefilledW4FromPersonal(nextPersonal, { ...merged.w4, firstName, middleInitial, lastName }),
      agencyName,
      branchType: branchType || merged.branchType,
    })
    setHasInitialized(true)
  }, [isLoading, userLoaded, candidate, draft, myApplication, branches, branchType, user, tenantName, hasInitialized])

  // Auto-save draft on changes (debounced)
  useEffect(() => {
    if (!clerkOrgId || !hasInitialized) return
    const timeout = setTimeout(() => {
      saveDraft({ clerkOrgId, formType: 'application', data })
      draftSavedAtRef.current = Date.now()
    }, 1000)
    return () => clearTimeout(timeout)
  }, [data, clerkOrgId, hasInitialized, saveDraft])

  if (isLoading || !userLoaded || !clerkOrgId) return null

  const handleContinue = () => {
    setShowErrors(true)
    if (!validateStep(step, data, jdAgreed)) {
      setError('Please complete all required fields before continuing.')
      return
    }
    setError('')
    setShowErrors(false)
    const completedStep = step
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
    setGeneratedPdfs([])
    if (completedStep === 3 || completedStep === 4) {
      generateStepPdfs(completedStep)
    }
  }

  const handleBack = () => {
    setError('')
    setGeneratedPdfs([])
    setShowErrors(false)
    setStep((s) => Math.max(s - 1, 0))
  }

  const handleSubmit = async () => {
    setShowErrors(true)
    if (!validateAll(data)) {
      setError('Please complete all required fields before submitting.')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      await generateAndUploadPrefilledDocuments()
      await submit({ clerkOrgId, fields: data })
      await deleteDraft({ clerkOrgId, formType: 'application' })
      try {
        sessionStorage.removeItem('atriax.application.step')
      } catch {
        // Storage might be restricted in some contexts
      }
      navigate('/onboarding/status', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
      setIsSubmitting(false)
    }
  }

  const generateAndUploadPrefilledDocuments = async () => {
    if (!clerkOrgId || !candidate?._id) return
    const getUploadUrl = async () => {
      const { url } = await generateUploadUrl({ clerkOrgId })
      return url
    }

    const i9Mapping = getMapping('i9')
    if (i9Mapping) {
      try {
        const i9PdfData = {
          ...(data.i9 as unknown as Record<string, unknown>),
          dateOfBirth: formatDateUS(data.i9.dateOfBirth),
          date: formatDateUS(data.i9.date),
        }
        const i9Bytes = await generatePrefilledPdf(i9Mapping, i9PdfData)
        await saveAndUpload(
          i9Bytes,
          'i9_prefilled.pdf',
          'i9',
          clerkOrgId,
          getUploadUrl,
          savePrefilledDocument,
          candidate._id,
        )
      } catch {
        // Best-effort: do not block submission if PDF generation fails.
      }
    }

    const w4Mapping = getMapping('w4')
    if (w4Mapping) {
      try {
        const w4PdfData = normalizeW4PdfData({
          ...(data.w4 as unknown as Record<string, unknown>),
          date: formatDateUS(data.w4.date),
        })
        const w4Bytes = await generatePrefilledPdf(w4Mapping, w4PdfData)
        await saveAndUpload(
          w4Bytes,
          'w4_prefilled.pdf',
          'w4',
          clerkOrgId,
          getUploadUrl,
          savePrefilledDocument,
          candidate._id,
        )
      } catch {
        // Best-effort: do not block submission if PDF generation fails.
      }
    }

    const criminalMapping = getMapping('criminal_record')
    if (criminalMapping) {
      try {
        const { address } = data.personal
        const criminalData = {
          ...data.criminalRecord,
          convictedCaliforniaYes: data.criminalRecord.convictedCalifornia ? 'X' : '',
          convictedCaliforniaNo: !data.criminalRecord.convictedCalifornia ? 'X' : '',
          convictedOtherYes: data.criminalRecord.convictedOther ? 'X' : '',
          convictedOtherNo: !data.criminalRecord.convictedOther ? 'X' : '',
          name: data.personal.firstName + ' ' + data.personal.lastName,
          address: address.street,
          city: address.city,
          zip: address.zip,
          socialSecurityNumber: data.personal.ssn,
          dateOfBirth: formatDateUS(data.personal.dateOfBirth),
          signature: data.i9.signature,
          date: formatDateUS(data.i9.date),
          printedName: data.personal.firstName + ' ' + data.personal.lastName,
          printedDate: formatDateUS(data.i9.date),
          offense: data.criminalRecord.convictedDetails || '',
          offenseLocation: '',
          offenseDate: '',
          offenseDescription: '',
        }
        const criminalBytes = await generatePrefilledPdf(criminalMapping, criminalData)
        await saveAndUpload(
          criminalBytes,
          'lic_508_criminal_record_prefilled.pdf',
          'criminal_record',
          clerkOrgId,
          getUploadUrl,
          savePrefilledDocument,
          candidate._id,
        )
      } catch {
        // Best-effort: do not block submission if PDF generation fails.
      }
    }
  }

  const generateStepPdfs = async (completedStep: number) => {
    const pdfs: { name: string; bytes: Uint8Array; description?: string }[] = []
    try {
      if (completedStep === 3) {
        // Criminal record step completed - generate LIC 508
        const criminalMapping = getMapping('criminal_record')
        if (criminalMapping) {
          const criminalData = {
            name: data.personal.firstName + ' ' + data.personal.lastName,
            address: data.personal.address.street,
            city: data.personal.address.city,
            zip: data.personal.address.zip,
            socialSecurityNumber: data.personal.ssn,
            dateOfBirth: formatDateUS(data.personal.dateOfBirth),
            convictedCaliforniaYes: data.criminalRecord.convictedCalifornia ? 'X' : '',
            convictedCaliforniaNo: !data.criminalRecord.convictedCalifornia ? 'X' : '',
            convictedOtherYes: data.criminalRecord.convictedOther ? 'X' : '',
            convictedOtherNo: !data.criminalRecord.convictedOther ? 'X' : '',
            signature: data.personal.firstName + ' ' + data.personal.lastName,
            date: new Date().toLocaleDateString('en-US'),
            printedName: data.personal.firstName + ' ' + data.personal.lastName,
            printedDate: new Date().toLocaleDateString('en-US'),
            offense: data.criminalRecord.convictedDetails || '',
            offenseLocation: '',
            offenseDate: '',
            offenseDescription: '',
          }
          const bytes = await generatePrefilledPdf(criminalMapping, criminalData)
          pdfs.push({ name: 'lic_508_criminal_record_prefilled.pdf', bytes, description: 'Criminal Record Statement (LIC 508) - filled out with your information. Keep for your records.' })
        }
      }
      if (completedStep === 4) {
        // I-9 & W-4 step completed - generate I-9, W-4, Health Screen, and Live Scan
        const i9Mapping = getMapping('i9')
        if (i9Mapping) {
          const i9PdfData = {
            ...(data.i9 as unknown as Record<string, unknown>),
            dateOfBirth: formatDateUS(data.i9.dateOfBirth),
            date: formatDateUS(data.i9.date),
          }
          const bytes = await generatePrefilledPdf(i9Mapping, i9PdfData)
          pdfs.push({ name: 'i9_prefilled.pdf', bytes, description: 'Employment Eligibility Verification (I-9) - Section 1 filled out with your information. Your HR team will complete Section 2.' })
        }
        const w4Mapping = getMapping('w4')
        if (w4Mapping) {
          const w4PdfData = normalizeW4PdfData({
            ...(data.w4 as unknown as Record<string, unknown>),
            date: formatDateUS(data.w4.date),
          })
          const bytes = await generatePrefilledPdf(w4Mapping, w4PdfData)
          pdfs.push({ name: 'w4_prefilled.pdf', bytes, description: 'Federal W-4 Tax Withholding form - filled out with your information. Keep for your records. Your HR team will complete the employer section.' })
        }
        // Also generate health screen and live scan so the applicant can take them to their doctor/Live Scan office
        const healthMapping = getMapping('health_screen')
        if (healthMapping) {
          const healthData = {
            facilityName: data.agencyName || 'Your agency',
            personName: data.personal.firstName + ' ' + data.personal.lastName,
            positionTitle: data.personal.positionApplyingFor || 'Caregiver',
            ...healthScreenSchedule(data.personal),
            applicantSignature: data.personal.firstName + ' ' + data.personal.lastName,
            applicantAddress: [data.personal.address.street, data.personal.address.city, data.personal.address.state, data.personal.address.zip].filter(Boolean).join(', '),
            date: new Date().toLocaleDateString('en-US'),
          }
          const bytes = await generatePrefilledPdf(healthMapping, healthData)
          pdfs.push({ name: 'lic_503_health_screen_prefilled.pdf', bytes, description: 'Health Screening Report (LIC 503) - Take this form to your primary care doctor for a health screening. This is at your own cost. Bring the signed/stamped form back and upload it in the Health Screen step.' })
        }
        const liveScanMapping = getMapping('live_scan')
        if (liveScanMapping) {
          const liveScanData = {
            lastName: data.personal.lastName,
            firstName: data.personal.firstName,
            dateOfBirth: formatDateUS(data.personal.dateOfBirth),
            socialSecurityNumber: data.personal.ssn,
            sexMale: data.personal.gender === 'male' ? 'X' : '',
            sexFemale: data.personal.gender === 'female' ? 'X' : '',
            homeAddressStreet: data.personal.address.street,
            homeAddressCityStateZip: [data.personal.address.city, data.personal.address.state, data.personal.address.zip].filter(Boolean).join(', '),
            transactionDate: new Date().toLocaleDateString('en-US'),
          }
          const bytes = await generatePrefilledPdf(liveScanMapping, liveScanData)
          pdfs.push({ name: 'lic_9163_live_scan_prefilled.pdf', bytes, description: 'Live Scan Fingerprint Request (LIC 9163) - Take this form to the Live Scan office at 1625 Flickinger Ave, San Jose, CA 95131 (9am-4pm Mon-Fri). The $70 cost will be reimbursed. Bring the stamped receipt back and upload it in the Background Check step.' })
        }
      }
    } catch {
      // Best-effort: don't block navigation if PDF generation fails
    }
    setGeneratedPdfs(pdfs)
  }

  const renderPdfDownloads = () => {
    if (generatedPdfs.length === 0) return null
    return (
      <div className='mb-6 rounded-[var(--radius-atria-md)] border border-atria-info/30 bg-atria-info/5 p-5'>
        <div className='mb-2 flex items-center gap-2'>
          <span className='text-base'>📄</span>
          <p className='text-sm font-semibold text-atria-info'>Your prefilled documents are ready</p>
        </div>
        <p className='mb-3 text-xs text-atria-text-secondary'>
          These documents have been filled out with the information you provided. Download them, read the instructions for each, and keep them for your records.
        </p>
        <div className='flex flex-col gap-3'>
          {generatedPdfs.map((pdf) => (
            <div key={pdf.name} className='rounded-[var(--radius-atria-sm)] border border-atria-border bg-atria-surface p-3'>
              {pdf.description && (
                <p className='mb-2 text-xs text-atria-text-secondary'>{pdf.description}</p>
              )}
              <button
                type='button'
                onClick={() => saveAndDownload(pdf.bytes, pdf.name)}
                className='inline-flex items-center gap-1.5 rounded-[var(--radius-atria-sm)] border border-atria-border bg-atria-surface px-3 py-2 text-xs font-medium text-atria-ink hover:bg-atria-surface-2'
              >
                <span>⬇</span>
                {pdf.name.replace(/_/g, ' ').replace('.pdf', '')}
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className='flex flex-col gap-6'>
            <div className='rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-6'>
              <h3 className='mb-3 text-lg font-semibold text-atria-ink'>Job Description</h3>
              <FieldGroup label='Position applying for' htmlFor='jdPositionApplyingFor' className='mb-4'>
                <Select
                  id='jdPositionApplyingFor'
                  value={data.personal.positionApplyingFor}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      personal: { ...prev.personal, positionApplyingFor: e.target.value },
                    }))
                  }
                >
                  <option value='' disabled>Select position</option>
                  {positionOptionsForBranch(branchType).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </FieldGroup>
              {data.personal.positionApplyingFor ? (
                <p className='whitespace-pre-line text-sm leading-relaxed text-atria-text-secondary'>
                  {jobDescriptionForPosition(branchType, data.personal.positionApplyingFor)}
                </p>
              ) : (
                <p className='text-sm leading-relaxed text-atria-text-secondary'>
                  Please select a position to view the job description.
                </p>
              )}
            </div>
            <label className='flex items-start gap-3 cursor-pointer'>
              <Checkbox
                checked={jdAgreed}
                onChange={(e) => setJdAgreed(e.target.checked)}
                className='mt-0.5 shrink-0'
              />
              <span className='text-sm text-atria-text-secondary'>
                I have read and understand the job description and I agree to perform these duties.
              </span>
            </label>
            <label className='flex items-start gap-3 cursor-pointer'>
              <Checkbox
                checked={data.legalValidityAccepted}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, legalValidityAccepted: e.target.checked }))
                }
                className='mt-0.5 shrink-0'
              />
              <span className='text-sm text-atria-text-secondary'>{LEGAL_VALIDITY_TEXT}</span>
            </label>
          </div>
        )
      case 1:
        return (
          <PersonalInfoSection
            value={data.personal}
            onChange={(personal) =>
              setData((prev) => ({
                ...prev,
                personal,
                i9: prefilledI9FromPersonal(personal, prev.i9),
                w4: prefilledW4FromPersonal(personal, prev.w4),
              }))}
            branchType={branchType}
            showErrors={showErrors}
          />
        )
      case 2:
        return (
          <div className='flex flex-col gap-8'>
            <EmploymentHistorySection
              value={{
                employment: data.employment,
                currentlyEmployed: data.currentlyEmployed,
                mayContactEmployer: data.mayContactEmployer,
              }}
              onChange={(v) =>
                setData((prev) => ({
                  ...prev,
                  employment: v.employment,
                  currentlyEmployed: v.currentlyEmployed,
                  mayContactEmployer: v.mayContactEmployer,
                }))
              }
              showErrors={showErrors}
            />
            <ReferencesSection
              value={data.references}
              onChange={(references) => setData((prev) => ({ ...prev, references }))}
              showErrors={showErrors}
            />
          </div>
        )
      case 3:
        return (
          <CriminalRecordSection
            value={data.criminalRecord}
            onChange={(criminalRecord) => setData((prev) => ({ ...prev, criminalRecord }))}
            showErrors={showErrors}
          />
        )
      case 4:
        return (
          <div className='flex flex-col gap-8'>
            <I9Section
              value={data.i9}
              onChange={(i9) => setData((prev) => ({ ...prev, i9 }))}
              showErrors={showErrors}
            />
            <W4Section
              value={data.w4}
              onChange={(w4) => setData((prev) => ({ ...prev, w4 }))}
              showErrors={showErrors}
            />
          </div>
        )
      case 5:
        return (
          <DisbursementSection
            value={data.disbursement}
            onChange={handleDisbursementChange}
            idType={data.personal.idType}
            showErrors={showErrors}
          />
        )
      case 6:
        return (
          <div className='flex flex-col gap-6'>
            <label className='flex items-start gap-3 cursor-pointer rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'>
              <Checkbox
                checked={data.legalValidityAccepted}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, legalValidityAccepted: e.target.checked }))
                }
                className='mt-0.5 shrink-0'
              />
              <span className='text-sm text-atria-text-secondary'>{LEGAL_VALIDITY_TEXT}</span>
            </label>
            <AcknowledgmentsSection
              value={data.acknowledgments}
              onChange={(acknowledgments) => setData((prev) => ({ ...prev, acknowledgments }))}
              agencyName={data.agencyName || tenantName || 'Your agency'}
              branchType={branchType}
              positionTitle={data.personal.positionApplyingFor}
              showErrors={showErrors}
            />
          </div>
        )
      case 7:
        return <ReviewSection data={data} />
      default:
        return null
    }
  }

  return (
    <div ref={scrollRef} className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-4xl'>
        <CardContent className='p-8'>
          <div className='mb-6 flex flex-col items-center text-center'>
            <AtriaLogo />
            <p className='mt-2 text-sm text-atria-text-secondary'>Onboarding</p>
            <button
              type='button'
              onClick={() => signOut(() => navigate('/sign-in'))}
              className='mt-2 text-xs text-atria-text-muted hover:text-atria-ink hover:underline'
            >
              Sign out
            </button>
          </div>

          <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>Job application</h1>
          <p className='mb-6 text-base text-atria-text-secondary'>
            Step {step + 1} of {STEPS.length}: {stepLabel}
          </p>

          <ProgressSteps steps={STEPS} currentStep={step} className='mb-8' />

          <form
            className='flex flex-col gap-6'
            onSubmit={(e) => {
              e.preventDefault()
              if (step === STEPS.length - 1) {
                handleSubmit()
              } else {
                handleContinue()
              }
            }}
          >
            {renderPdfDownloads()}
            {renderStep()}

            {error && <p className='text-sm text-atria-danger'>{error}</p>}

            <div className='flex flex-col gap-3 sm:flex-row sm:justify-between'>
              <Button
                type='button'
                variant='secondary'
                size='lg'
                onClick={handleBack}
                disabled={step === 0 || isSubmitting}
                className='sm:w-auto'
              >
                ← Back
              </Button>

              {step === STEPS.length - 1 ? (
                <Button
                  type='submit'
                  variant='primary'
                  size='lg'
                  className='sm:w-auto'
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit application →'}
                </Button>
              ) : (
                <Button
                  type='submit'
                  variant='primary'
                  size='lg'
                  className='sm:w-auto'
                  disabled={isSubmitting}
                >
                  Save and continue →
                </Button>
              )}
            </div>
          </form>

          <button
            className='mt-6 block w-full text-center text-sm text-atria-text-secondary hover:text-atria-ink'
            onClick={() => navigate('/onboarding/status')}
          >
            Already applied? Check your status →
          </button>
        </CardContent>
      </Card>
      <div className='mt-6 flex flex-col items-center gap-2'>
        {/* TODO: resolve via resolveAgencyLogo(tenantName) when multi-agency support is added */}
        <img
          src="/agency-logo-individualschoice.jpeg"
          alt="Agency logo"
          className='h-10 w-auto object-contain opacity-70'
        />
        <p className='text-xs text-atria-text-muted'>Powered by ATRIA-X Digital Solutions</p>
      </div>
    </div>
  )
}
