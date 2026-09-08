import { useOrganization } from '@clerk/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Textarea'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Input } from '@/shared/ui/Input'
import { HrToast } from '../components/HrToast'
import { useHrToast } from '../hooks/useHrToast'
import { candidateStatusPill, candidateStatusAccentClass } from '../lib/candidateStatus'
import { getCarInsuranceStatus } from '../lib/carInsurance'
import { formatDocumentCategoryLabel, formatDateUS } from '@/shared/format'
import { uploadFileToConvex } from '@/shared/lib/upload'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { generatePrefilledPdf, saveAndUpload } from '@/features/onboarding/pdf/generatePrefilledPdf'
import { getMapping, normalizeW4PdfData } from '@/features/onboarding/pdf/mappings'
import { isNonEmptyString } from '@/features/onboarding/components/application/types'
import { DynamicFormReview } from '@/features/forms/components/DynamicFormReview'
import { ArrowLeft, CheckCircle2, Download, RotateCcw, XCircle } from 'lucide-react'
import { Component, useState, useMemo, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import type { Id, Doc } from '../../../../convex/_generated/dataModel'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getInitialW4EmployerData(
  prefilledDocs: Doc<'prefilledDocuments'>[] | undefined,
  organizationName: string | undefined,
  agencyEin?: string | null,
) {
  const w4Doc = prefilledDocs?.find((d) => d.documentType === 'w4')
  const hrData = w4Doc?.hrSectionData as Record<string, unknown> | undefined
  const todayIso = new Date().toISOString().split('T')[0]
  return {
    employerName: String(hrData?.employerName ?? organizationName ?? ''),
    ein: String(hrData?.ein ?? agencyEin ?? ''),
    firstDateOfEmployment: String(hrData?.firstDateOfEmployment ?? todayIso),
  }
}

function getInitialI9Section2(fields: Record<string, unknown>) {
  const section = (fields.i9Section2 ?? {}) as Record<string, unknown>
  const todayIso = new Date().toISOString().split('T')[0]
  return {
    documentTitle: String(section.documentTitle ?? ''),
    documentNumber: String(section.documentNumber ?? ''),
    expirationDate: String(section.expirationDate ?? ''),
    employerSignature: String(section.employerSignature ?? ''),
    date: String(section.date ?? todayIso),
  }
}

function ApplicationField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
        {label}
      </p>
      <p className="mt-1 text-base text-atria-ink">{value || '—'}</p>
    </div>
  )
}

class DownloadButton extends Component<{
  clerkOrgId: string
  storageId?: string
  fileName: string
}, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.warn('DownloadButton error suppressed:', error.message)
  }

  render() {
    const { clerkOrgId, storageId, fileName } = this.props

    if (!storageId) return null

    if (this.state.hasError) {
      return (
        <span className="inline-flex h-8 items-center gap-1 rounded-md border border-atria-border bg-atria-surface-2 px-2.5 text-xs font-medium text-atria-text-muted">
          <Download className="h-3.5 w-3.5" />
          File unavailable
        </span>
      )
    }

    return <DownloadButtonInner clerkOrgId={clerkOrgId} storageId={storageId} fileName={fileName} />
  }
}

class StorageDownloadButton extends Component<{
  clerkOrgId: string
  storageId?: string
  fileName: string
}, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.warn('StorageDownloadButton error suppressed:', error.message)
  }

  render() {
    const { clerkOrgId, storageId, fileName } = this.props
    if (!storageId) return null

    if (this.state.hasError) {
      return (
        <span className="inline-flex h-8 items-center gap-1 rounded-md border border-atria-border bg-atria-surface-2 px-2.5 text-xs font-medium text-atria-text-muted">
          <Download className="h-3.5 w-3.5" />
          File unavailable
        </span>
      )
    }

    return <StorageDownloadButtonInner clerkOrgId={clerkOrgId} storageId={storageId} fileName={fileName} />
  }
}

function StorageDownloadButtonInner({
  clerkOrgId,
  storageId,
  fileName,
}: {
  clerkOrgId: string
  storageId: string
  fileName: string
}) {
  const url = useQuery(
    api.files.getStorageUrl,
    { clerkOrgId, storageId },
  )

  return (
    <a
      href={url ?? '#'}
      download={fileName}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 items-center gap-1 rounded-md border border-atria-border bg-atria-surface px-2.5 text-xs font-medium text-atria-ink hover:bg-atria-surface-2 disabled:pointer-events-none disabled:opacity-50"
      aria-disabled={!url}
      onClick={(e) => {
        if (!url) e.preventDefault()
      }}
    >
      <Download className="h-3.5 w-3.5" />
      Download
    </a>
  )
}

function DownloadButtonInner({
  clerkOrgId,
  storageId,
  fileName,
}: {
  clerkOrgId: string
  storageId?: string
  fileName: string
}) {
  const url = useQuery(
    api.files.getDownloadUrl,
    storageId ? { clerkOrgId, storageId } : 'skip',
  )

  return (
    <a
      href={url ?? '#'}
      download={fileName}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 items-center gap-1 rounded-md border border-atria-border bg-atria-surface px-2.5 text-xs font-medium text-atria-ink hover:bg-atria-surface-2 disabled:pointer-events-none disabled:opacity-50"
      aria-disabled={!url}
      onClick={(e) => {
        if (!url) e.preventDefault()
      }}
    >
      <Download className="h-3.5 w-3.5" />
      Download
    </a>
  )
}

class PrefilledDocumentDownloadButton extends Component<{
  clerkOrgId: string
  documentId?: Id<'prefilledDocuments'>
  fileName: string
  variant?: 'prefilled' | 'signed'
  label?: string
}, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.warn('PrefilledDocumentDownloadButton error suppressed:', error.message)
  }

  render() {
    const { clerkOrgId, documentId, fileName, variant = 'prefilled', label = 'Download PDF' } = this.props

    if (!documentId) return null

    if (this.state.hasError) {
      return (
        <span className="inline-flex h-8 items-center gap-1 rounded-md border border-atria-border bg-atria-surface-2 px-2.5 text-xs font-medium text-atria-text-muted">
          <Download className="h-3.5 w-3.5" />
          Not generated yet
        </span>
      )
    }

    return <PrefilledDocumentDownloadButtonInner clerkOrgId={clerkOrgId} documentId={documentId} fileName={fileName} variant={variant} label={label} />
  }
}

function PrefilledDocumentDownloadButtonInner({
  clerkOrgId,
  documentId,
  fileName,
  variant = 'prefilled',
  label = 'Download PDF',
}: {
  clerkOrgId: string
  documentId: Id<'prefilledDocuments'>
  fileName: string
  variant: 'prefilled' | 'signed'
  label: string
}) {
  const url = useQuery(
    api.candidates.getPrefilledDocumentDownloadUrl,
    { clerkOrgId, documentId, variant },
  )

  return (
    <a
      href={url ?? '#'}
      download={fileName}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 items-center gap-1 rounded-md border border-atria-border bg-atria-surface px-2.5 text-xs font-medium text-atria-ink hover:bg-atria-surface-2 disabled:pointer-events-none disabled:opacity-50"
      aria-disabled={!url}
      onClick={(e) => {
        if (!url) e.preventDefault()
      }}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </a>
  )
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface p-6 shadow-[var(--shadow-atria-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-atria-ink">{title}</h3>
        <p className="mt-2 text-base text-atria-text-secondary">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-atria-ink">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  )
}

export function ApplicationReviewPage() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const navigate = useNavigate()
  const { organization } = useOrganization()

  const clerkOrgId = organization?.id

  const detail = useQuery(
    api.candidates.getCandidateDetail,
    clerkOrgId && candidateId
      ? { clerkOrgId, candidateId: candidateId as Id<'candidates'> }
      : 'skip',
  )
  const tasks = useQuery(
    api.candidates.listCandidateTasksForHR,
    clerkOrgId && candidateId
      ? { clerkOrgId, candidateId: candidateId as Id<'candidates'> }
      : 'skip',
  )
  const bgCheck = useQuery(
    api.backgroundChecks.getBackgroundCheckForHR,
    clerkOrgId && candidateId
      ? { clerkOrgId, candidateId: candidateId as Id<'candidates'> }
      : 'skip',
  )
  const prefilledDocs = useQuery(
    api.candidates.getPrefilledDocuments,
    clerkOrgId && candidateId
      ? { clerkOrgId, candidateId: candidateId as Id<'candidates'> }
      : 'skip',
  )
  const w4ForHR = useQuery(
    api.candidates.getW4ForHR,
    clerkOrgId && candidateId
      ? { clerkOrgId, candidateId: candidateId as Id<'candidates'> }
      : 'skip',
  )

  const reviewApplication = useMutation(api.candidates.reviewApplication)
  const sendOffer = useMutation(api.candidates.sendOffer)
  const saveW4EmployerSection = useMutation(api.candidates.saveW4EmployerSection)
  const saveI9Section2 = useMutation(api.candidates.saveI9Section2ForHR)
  const uploadBackgroundCheckResult = useMutation(api.backgroundChecks.uploadBackgroundCheckResult)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const savePrefilledDocument = useMutation(api.candidates.savePrefilledDocument)

  const candidate = detail?.candidate
  const application = detail?.applications?.[0]
  const fields = (application?.fields ?? {}) as Record<string, unknown>

  const dynamicFormSubmissions = (fields.dynamicFormSubmissions ?? []) as {
    formDefinitionId: Id<'formDefinitions'>
    submissionId: Id<'formSubmissions'>
    formKey: string | null
    formName: string
  }[]
  const dynamicSubmissionIds = dynamicFormSubmissions.map((s) => s.submissionId)
  const dynamicFormDefinitionIds = dynamicFormSubmissions.map((s) => s.formDefinitionId)
  const dynamicSubmissions = useQuery(
    api.forms.getFormSubmissionsByIds,
    clerkOrgId && dynamicSubmissionIds.length > 0
      ? { clerkOrgId, submissionIds: dynamicSubmissionIds }
      : 'skip',
  )
  const dynamicFormDefinitions = useQuery(
    api.forms.getFormDefinitionsByIds,
    clerkOrgId && dynamicFormDefinitionIds.length > 0
      ? { clerkOrgId, formDefinitionIds: dynamicFormDefinitionIds }
      : 'skip',
  )

  const [hrNotes, setHrNotes] = useState('')
  const [payRate, setPayRate] = useState(String(fields.payRate || '$22.00 / hr'))
  const [startDate, setStartDate] = useState(String(fields.startDate || ''))
  const [schedule, setSchedule] = useState(String(fields.schedule || 'Flexible, based on availability'))
  const [supervisor, setSupervisor] = useState(String(fields.supervisor || 'Your assigned coordinator'))
  const [clientName, setClientName] = useState(String(fields.clientName || ''))
  const [expiresAt, setExpiresAt] = useState(String(fields.offerExpiresAt || ''))
  const [submitting, setSubmitting] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)
  const { toast, show, hide } = useHrToast()

  const todayIso = new Date().toISOString().split('T')[0]
  const [employerName, setEmployerName] = useState(organization?.name ?? '')
  const [ein, setEin] = useState('')
  const [firstDateOfEmployment, setFirstDateOfEmployment] = useState(todayIso)
  const [isGeneratingW4, setIsGeneratingW4] = useState(false)

  const [i9Section2, setI9Section2] = useState({
    documentTitle: '',
    documentNumber: '',
    expirationDate: '',
    employerSignature: '',
    date: new Date().toISOString().split('T')[0],
  })

  const [bgResultFile, setBgResultFile] = useState<File | null>(null)

  // Sync W-4 employer fields and I-9 Section 2 from saved data when it loads,
  // without overriding user edits (render-time derived state avoids cascading effects).
  const [w4SourceKey, setW4SourceKey] = useState<string | null>(null)
  const [i9SourceKey, setI9SourceKey] = useState<string | null>(null)
  const nextW4Key = `${prefilledDocs?.map((d) => d._id).join(',') ?? 'loading'}|${w4ForHR?.agencyEin ?? ''}`
  const nextI9Key = JSON.stringify(fields.i9Section2)
  const initialW4Employer = getInitialW4EmployerData(prefilledDocs, organization?.name, w4ForHR?.agencyEin)
  const initialI9Section2 = getInitialI9Section2(fields)
  if (w4SourceKey !== nextW4Key) {
    setW4SourceKey(nextW4Key)
    setEmployerName(initialW4Employer.employerName)
    setEin(initialW4Employer.ein)
    setFirstDateOfEmployment(initialW4Employer.firstDateOfEmployment)
  }
  if (i9SourceKey !== nextI9Key) {
    setI9SourceKey(nextI9Key)
    setI9Section2(initialI9Section2)
  }
  const [isUploadingBgResult, setIsUploadingBgResult] = useState(false)
  const bgResultInputRef = useRef<HTMLInputElement>(null)

  const allTasksComplete = useMemo(() => {
    const list = tasks ?? []
    if (list.length === 0) return false
    // Only required tasks must be complete — optional tasks (additional_certifications) are excluded
    // Skipped tasks (e.g. car_insurance when the applicant does not transport clients) never block
    return list
      .filter((t: { type: string; status: string }) => t.type !== 'additional_certifications')
      .every((t: { status: string }) => t.status === 'complete' || t.status === 'waived' || t.status === 'skipped')
  }, [tasks])

  const prefilledDocByType = useMemo(() => {
    const map = new Map<string, Doc<'prefilledDocuments'>>()
    if (!prefilledDocs) return map
    for (const doc of prefilledDocs) {
      map.set(doc.documentType, doc)
    }
    return map
  }, [prefilledDocs])

  const w4EmployerComplete = useMemo(() => {
    const doc = prefilledDocByType.get('w4')
    return (
      !!doc?.hrSectionCompleted &&
      isNonEmptyString(employerName) &&
      isNonEmptyString(ein) &&
      isNonEmptyString(firstDateOfEmployment)
    )
  }, [prefilledDocByType, employerName, ein, firstDateOfEmployment])

  const i9Section2Complete = useMemo(() => {
    const section = fields.i9Section2 as Record<string, unknown> | undefined
    return (
      !!section &&
      isNonEmptyString(section.documentTitle) &&
      isNonEmptyString(section.documentNumber) &&
      isNonEmptyString(section.employerSignature) &&
      isNonEmptyString(section.date)
    )
  }, [fields.i9Section2])

  const backgroundCheckResultComplete = useMemo(
    () => !!bgCheck?.officialResultStorageId,
    [bgCheck],
  )

  const canSendOffer = useMemo(
    () =>
      allTasksComplete &&
      w4EmployerComplete &&
      i9Section2Complete &&
      backgroundCheckResultComplete,
    [allTasksComplete, w4EmployerComplete, i9Section2Complete, backgroundCheckResultComplete],
  )

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-text-secondary">Loading application…</div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-danger">Candidate not found.</div>
      </div>
    )
  }

  const pill = candidateStatusPill(candidate.status)

  const personal = (fields.personal ?? {}) as Record<string, unknown>
  const personalAddress = (personal.address ?? {}) as Record<string, unknown>
  const employment = (fields.employment ?? []) as Record<string, unknown>[]
  const references = (fields.references ?? []) as Record<string, unknown>[]
  const criminalRecord = (fields.criminalRecord ?? {}) as Record<string, unknown>
  const i9 = (fields.i9 ?? {}) as Record<string, unknown>
  const w4 = (fields.w4 ?? {}) as Record<string, unknown>
  const w4Dependents = (w4.dependents ?? {}) as Record<string, unknown>
  const disbursement = (fields.disbursement ?? {}) as Record<string, unknown>
  const acknowledgments = (fields.acknowledgments ?? {}) as Record<string, Record<string, unknown>>

  const existingI9Section2 = (fields.i9Section2 ?? {}) as Record<string, unknown>

  const canTransportClients =
    personal.canTransportClients === true
      ? true
      : personal.canTransportClients === false
        ? false
        : undefined
  const carInsuranceDoc = (detail.documents ?? []).find(
    (doc: { category: string }) => doc.category === 'car_insurance',
  )
  const carInsuranceStatus = getCarInsuranceStatus({
    canTransportClients,
    expiresAt: carInsuranceDoc?.expiresAt,
  })
  const carInsuranceBadge: { variant: 'success' | 'warning' | 'danger' | 'neutral'; label: string } =
    carInsuranceStatus === 'valid'
      ? { variant: 'success', label: 'Valid' }
      : carInsuranceStatus === 'expiring_soon'
        ? { variant: 'warning', label: 'Expiring soon' }
        : carInsuranceStatus === 'expired'
          ? { variant: 'danger', label: 'Expired' }
          : carInsuranceStatus === 'missing'
            ? { variant: 'danger', label: 'Missing' }
            : { variant: 'neutral', label: 'Not applicable' }

  const handleAdvance = async () => {
    if (!clerkOrgId || !candidateId) return
    setSubmitting(true)
    try {
      await sendOffer({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
        payRate,
        startDate,
        schedule,
        supervisor,
        clientName,
        expiresAt,
      })
      show('success', 'Offer sent', 'The candidate can now accept the offer.')
    } catch (err) {
      show(
        'danger',
        'Could not advance candidate',
        err instanceof Error ? sanitizeConvexError(err.message) : 'Unknown error.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleApproveAndSendOffer = async () => {
    if (!clerkOrgId || !candidateId) return
    setSubmitting(true)
    try {
      await reviewApplication({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
        decision: 'approved',
      })
      await sendOffer({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
        payRate,
        startDate,
        schedule,
        supervisor,
        clientName,
        expiresAt,
      })
      show('success', 'Approved and offer sent', 'The candidate can now accept the offer.')
    } catch (err) {
      show(
        'danger',
        'Could not approve and send offer',
        err instanceof Error ? sanitizeConvexError(err.message) : 'Unknown error.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleCorrection = async () => {
    if (!clerkOrgId || !candidateId || !hrNotes.trim()) return
    setSubmitting(true)
    try {
      await reviewApplication({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
        decision: 'needs_correction',
        hrNotes: hrNotes.trim(),
      })
      setHrNotes('')
      show('warning', 'Correction requested', 'The candidate has been notified.')
    } catch (err) {
      show(
        'danger',
        'Request failed',
        err instanceof Error ? sanitizeConvexError(err.message) : 'Unknown error.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!clerkOrgId || !candidateId) return
    setSubmitting(true)
    try {
      await reviewApplication({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
        decision: 'rejected',
        hrNotes: hrNotes.trim() || undefined,
      })
      setConfirmReject(false)
      show('danger', 'Application rejected')
    } catch (err) {
      show(
        'danger',
        'Rejection failed',
        err instanceof Error ? sanitizeConvexError(err.message) : 'Unknown error.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveW4EmployerSection = async () => {
    if (!clerkOrgId || !candidateId) return
    setIsGeneratingW4(true)
    try {
      await saveW4EmployerSection({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
        employerName,
        ein,
        firstDateOfEmployment,
      })

      const w4Data = w4ForHR?.application?.fields
      if (w4Data && typeof w4Data === 'object') {
        const candidateW4 = ((w4Data as Record<string, unknown>).w4 ?? {}) as Record<string, unknown>
        const mapping = getMapping('w4')
        if (mapping) {
          const pdfData = normalizeW4PdfData({
            ...candidateW4,
            employerName,
            ein,
            firstDateOfEmployment,
          })
          const bytes = await generatePrefilledPdf(mapping, pdfData)
          const getUploadUrl = async () => {
            const { url } = await generateUploadUrl({ clerkOrgId })
            return url
          }
          await saveAndUpload(
            bytes,
            'w4_prefilled.pdf',
            'w4',
            clerkOrgId,
            getUploadUrl,
            savePrefilledDocument,
            candidateId as Id<'candidates'>,
          )
        }
      }

      show('success', 'W-4 employer section saved', 'The prefilled W-4 PDF has been regenerated.')
    } catch (err) {
      show(
        'danger',
        'Could not save W-4 employer section',
        err instanceof Error ? sanitizeConvexError(err.message) : 'Unknown error.',
      )
    } finally {
      setIsGeneratingW4(false)
    }
  }

  const handleSaveI9Section2 = async () => {
    if (!clerkOrgId || !candidateId) return
    try {
      await saveI9Section2({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
        section2: i9Section2,
      })
      show('success', 'I-9 Section 2 saved')
    } catch (err) {
      show(
        'danger',
        'Could not save I-9 Section 2',
        err instanceof Error ? sanitizeConvexError(err.message) : 'Unknown error.',
      )
    }
  }

  const handleUploadBgResult = async () => {
    if (!clerkOrgId || !candidateId || !bgResultFile) return
    setIsUploadingBgResult(true)
    try {
      const storageId = await uploadFileToConvex({
        generateUploadUrl,
        clerkOrgId,
        file: bgResultFile,
      })
      await uploadBackgroundCheckResult({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
        storageId,
      })
      setBgResultFile(null)
      show('success', 'Official background check result uploaded')
    } catch (err) {
      show(
        'danger',
        'Upload failed',
        err instanceof Error ? sanitizeConvexError(err.message) : 'Unknown error.',
      )
    } finally {
      setIsUploadingBgResult(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/hr/candidates"
        className="inline-flex items-center gap-1 text-sm font-medium text-atria-accent hover:text-atria-accent-hover"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Candidate Pipeline
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-atria-ink">Application Review</h1>
        <p className="text-base text-atria-text-secondary">
          {candidate.displayName} · {String(fields.position || personal.positionApplyingFor || 'Caregiver')} · Applied{' '}
          {application?.submittedAt
            ? formatDateUS(application.submittedAt)
            : '—'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-8 p-6">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold ${candidateStatusAccentClass(candidate.status)}`}
              >
                {initials(candidate.displayName)}
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold text-atria-ink">
                  {candidate.displayName}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-atria-text-secondary">
                  <span>{candidate.email}</span>
                  {candidate.phone && <span>{candidate.phone}</span>}
                  <StatusBadge variant={pill.variant}>{pill.label}</StatusBadge>
                </div>
              </div>
            </div>

            <SectionBlock title="Personal information">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ApplicationField label="FULL NAME" value={`${personal.firstName ?? ''} ${personal.lastName ?? ''}`.trim()} />
                <ApplicationField label="EMAIL" value={String(personal.email ?? candidate.email ?? '')} />
                <ApplicationField label="PHONE" value={String(personal.cellPhone ?? personal.homePhone ?? candidate.phone ?? '')} />
                <ApplicationField label="DATE OF BIRTH" value={String(personal.dateOfBirth ?? '')} />
                <ApplicationField label="ADDRESS" value={`${personalAddress.street ?? ''} ${personalAddress.apt ?? ''}, ${personalAddress.city ?? ''}, ${personalAddress.state ?? ''} ${personalAddress.zip ?? ''}`.trim()} />
                <ApplicationField label="POSITION" value={String(personal.positionApplyingFor ?? fields.position ?? '')} />
                <ApplicationField label="AVAILABILITY" value={String(personal.availability ?? fields.availability ?? '')} />
                <ApplicationField label="LANGUAGES" value={String(personal.languages ?? '')} />
              </div>
            </SectionBlock>

            {dynamicFormSubmissions.length > 0 && (
              <SectionBlock title="Application forms">
                <div className="flex flex-col gap-4">
                  {dynamicFormSubmissions.map((meta) => {
                    const submission = dynamicSubmissions?.find((s) => s._id === meta.submissionId)
                    const formDefinition = dynamicFormDefinitions?.find(
                      (f) => f._id === meta.formDefinitionId,
                    )
                    if (!submission) {
                      return (
                        <Card key={meta.submissionId}>
                          <CardContent className="p-4">
                            <p className="text-sm text-atria-text-secondary">
                              Loading {meta.formName}…
                            </p>
                          </CardContent>
                        </Card>
                      )
                    }
                    if (!formDefinition) {
                      return (
                        <Card key={meta.submissionId}>
                          <CardHeader>
                            <CardTitle>{meta.formName}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {Object.entries(submission.answers).map(([key, value]) => (
                                <ApplicationField
                                  key={key}
                                  label={key}
                                  value={
                                    typeof value === 'boolean'
                                      ? value
                                        ? 'Yes'
                                        : 'No'
                                      : String(value ?? '')
                                  }
                                />
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    }
                    return (
                      <DynamicFormReview
                        key={meta.submissionId}
                        form={formDefinition}
                        answers={submission.answers}
                      />
                    )
                  })}
                </div>
              </SectionBlock>
            )}

            <SectionBlock title="Employment history">
              {employment.length === 0 ? (
                <p className="text-sm text-atria-text-secondary">No employment history provided.</p>
              ) : (
                <div className="space-y-4">
                  {employment.map((entry, i) => (
                    <div key={i} className="rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <ApplicationField label="COMPANY" value={String(entry.companyName ?? '')} />
                        <ApplicationField label="POSITION" value={String(entry.position ?? '')} />
                        <ApplicationField label="DATES" value={`${entry.fromMoYr ?? ''} – ${entry.toMoYr ?? ''}`} />
                        <ApplicationField label="SUPERVISOR" value={String(entry.supervisorContact ?? '')} />
                        <ApplicationField label="DUTIES" value={String(entry.jobDuties ?? '')} />
                        <ApplicationField label="REASON FOR LEAVING" value={String(entry.reasonForLeaving ?? '')} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionBlock>

            <SectionBlock title="References">
              {references.length === 0 ? (
                <p className="text-sm text-atria-text-secondary">No references provided.</p>
              ) : (
                <div className="space-y-4">
                  {references.map((ref, i) => (
                    <div key={i} className="rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <ApplicationField label="NAME" value={String(ref.name ?? '')} />
                        <ApplicationField label="RELATIONSHIP" value={String(ref.relationship ?? '')} />
                        <ApplicationField label="PHONE" value={String(ref.phone ?? '')} />
                        <ApplicationField label="ADDRESS" value={String(ref.address ?? '')} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionBlock>

            <SectionBlock title="Criminal record">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ApplicationField
                  label="CONVICTED IN CALIFORNIA"
                  value={criminalRecord.convictedCalifornia ? 'Yes' : criminalRecord.convictedCalifornia === false ? 'No' : ''}
                />
                <ApplicationField
                  label="CONVICTED ELSEWHERE"
                  value={criminalRecord.convictedOther ? 'Yes' : criminalRecord.convictedOther === false ? 'No' : ''}
                />
                <ApplicationField label="DETAILS" value={String(criminalRecord.convictedDetails ?? '')} />
                <ApplicationField label="ALIAS NAMES" value={String(criminalRecord.aliasNames ?? '')} />
              </div>
            </SectionBlock>

            <SectionBlock title="I-9 Section 1">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ApplicationField label="LAST NAME" value={String(i9.lastName ?? '')} />
                <ApplicationField label="FIRST NAME" value={String(i9.firstName ?? '')} />
                <ApplicationField label="ADDRESS" value={`${i9.address ?? ''}, ${i9.city ?? ''}, ${i9.state ?? ''} ${i9.zip ?? ''}`.trim()} />
                <ApplicationField label="DATE OF BIRTH" value={String(i9.dateOfBirth ?? '')} />
                <ApplicationField label={String(personal.idType ?? 'ssn').toUpperCase()} value={String(i9.ssn ?? '')} />
                <ApplicationField label="CITIZENSHIP STATUS" value={String(i9.citizenshipStatus ?? '').replace(/_/g, ' ')} />
                <ApplicationField label="ALIEN NUMBER" value={String(i9.alienNumber ?? '')} />
              </div>
            </SectionBlock>

            <SectionBlock title="I-9 Section 2 verification">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldGroup label="DOCUMENT TITLE" htmlFor="i9-doc-title">
                  <Input
                    id="i9-doc-title"
                    value={i9Section2.documentTitle}
                    onChange={(e) => setI9Section2((prev) => ({ ...prev, documentTitle: e.target.value }))}
                    placeholder="e.g. US Passport"
                  />
                </FieldGroup>
                <FieldGroup label="DOCUMENT NUMBER" htmlFor="i9-doc-number">
                  <Input
                    id="i9-doc-number"
                    value={i9Section2.documentNumber}
                    onChange={(e) => setI9Section2((prev) => ({ ...prev, documentNumber: e.target.value }))}
                  />
                </FieldGroup>
                <FieldGroup label="EXPIRATION DATE" htmlFor="i9-expiration">
                  <Input
                    id="i9-expiration"
                    type="date"
                    value={i9Section2.expirationDate}
                    onChange={(e) => setI9Section2((prev) => ({ ...prev, expirationDate: e.target.value }))}
                  />
                </FieldGroup>
                <FieldGroup label="DATE VERIFIED" htmlFor="i9-date">
                  <Input
                    id="i9-date"
                    type="date"
                    value={i9Section2.date}
                    onChange={(e) => setI9Section2((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </FieldGroup>
                <FieldGroup label="EMPLOYER SIGNATURE" htmlFor="i9-signature" className="sm:col-span-2">
                  <Input
                    id="i9-signature"
                    value={i9Section2.employerSignature}
                    onChange={(e) => setI9Section2((prev) => ({ ...prev, employerSignature: e.target.value }))}
                    placeholder="Type full name"
                  />
                </FieldGroup>
              </div>
              <Button
                variant="secondary"
                size="md"
                className="mt-4"
                onClick={handleSaveI9Section2}
              >
                Save I-9 Section 2
              </Button>
              {!!existingI9Section2.documentTitle && (
                <p className="mt-2 text-sm text-atria-success">
                  Verified on {formatDateUS(String(existingI9Section2.i9Section2CompletedAt ?? ''))}
                </p>
              )}
            </SectionBlock>

            <SectionBlock title="W-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ApplicationField label="NAME" value={`${w4.firstName ?? ''} ${w4.middleInitial ?? ''} ${w4.lastName ?? ''}`.trim()} />
                <ApplicationField label="SSN" value={String(w4.ssn ?? '')} />
                <ApplicationField label="FILING STATUS" value={String(w4.filingStatus ?? '').replace(/_/g, ' ')} />
                <ApplicationField label="MULTIPLE JOBS" value={w4.multipleJobs ? 'Yes' : 'No'} />
                <ApplicationField label="DEPENDENTS TOTAL" value={String(w4Dependents.total ?? '')} />
                <ApplicationField label="EXTRA WITHHOLDING" value={String(w4.extraWithholding ?? '')} />
              </div>
            </SectionBlock>

            <SectionBlock title="W-4 employer section">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FieldGroup label="EMPLOYER NAME" htmlFor="w4-employer-name">
                  <Input
                    id="w4-employer-name"
                    value={employerName}
                    onChange={(e) => setEmployerName(e.target.value)}
                  />
                </FieldGroup>
                <FieldGroup label="EIN" htmlFor="w4-ein">
                  <Input
                    id="w4-ein"
                    value={ein}
                    onChange={(e) => setEin(e.target.value)}
                    placeholder="XX-XXXXXXX"
                  />
                </FieldGroup>
                <FieldGroup label="FIRST DATE OF EMPLOYMENT" htmlFor="w4-start-date">
                  <Input
                    id="w4-start-date"
                    type="date"
                    value={firstDateOfEmployment}
                    onChange={(e) => setFirstDateOfEmployment(e.target.value)}
                  />
                </FieldGroup>
              </div>
              <Button
                variant="secondary"
                size="md"
                className="mt-4"
                disabled={isGeneratingW4 || !employerName || !ein || !firstDateOfEmployment}
                onClick={handleSaveW4EmployerSection}
              >
                {isGeneratingW4 ? 'Generating...' : 'Save employer section & regenerate W-4 PDF'}
              </Button>
            </SectionBlock>

            <SectionBlock title="Disbursement">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ApplicationField label="METHOD" value={String(disbursement.method ?? '').replace(/_/g, ' ')} />
                {disbursement.method === 'direct_deposit' && (
                  <>
                    <ApplicationField label="BANK NAME" value={String(disbursement.bankName ?? '')} />
                    <ApplicationField label="ACCOUNT TYPE" value={String(disbursement.accountType ?? '')} />
                    <ApplicationField label="ROUTING NUMBER" value={String(disbursement.routingNumber ?? '')} />
                    <ApplicationField label="ACCOUNT NUMBER" value={String(disbursement.accountNumber ?? '')} />
                  </>
                )}
              </div>
            </SectionBlock>

            <SectionBlock title="Acknowledgments">
              {acknowledgments ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Object.entries(acknowledgments).map(([key, value]) => (
                    <ApplicationField
                      key={key}
                      label={key.replace(/_/g, ' ').toUpperCase()}
                      value={value?.agreed ? `Agreed by ${value.initials ?? ''} on ${value.date ?? ''}` : 'Not acknowledged'}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-atria-text-secondary">No acknowledgments recorded.</p>
              )}
            </SectionBlock>

            <SectionBlock title="Prefilled documents">
              <div className="space-y-2">
                {(['health_screen', 'live_scan', 'criminal_record', 'i9', 'w4', 'de_34', 'bcia_8016', 'hcs_501'] as const).map((type) => {
                  const doc = prefilledDocByType.get(type)
                  const hasSigned = !!doc?.uploadedSignedStorageId
                  const isOnlineForm = type === 'criminal_record' || type === 'i9' || type === 'w4' || type === 'bcia_8016'
                  return (
                    <div
                      key={type}
                      className="flex flex-col gap-2 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-atria-ink">
                          {type === 'health_screen' && 'Health Screen (LIC 503)'}
                          {type === 'live_scan' && 'Live Scan (LIC 9163)'}
                          {type === 'criminal_record' && 'Criminal Record (LIC 508)'}
                          {type === 'i9' && 'I-9 Employment Eligibility'}
                          {type === 'w4' && 'W-4 Tax Withholding'}
                          {type === 'de_34' && 'DE 34 — Report of New Employee(s)'}
                          {type === 'bcia_8016' && 'BCIA 8016 — Live Scan Request'}
                          {type === 'hcs_501' && 'HCS 501 — Personnel Record'}
                        </span>
                        <PrefilledDocumentDownloadButton
                          clerkOrgId={clerkOrgId!}
                          documentId={doc?._id}
                          fileName={`${type}_prefilled.pdf`}
                        />
                      </div>
                      {!isOnlineForm && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-atria-text-secondary">
                            Signed/stamped upload:
                            {hasSigned ? (
                              <span className="ml-1 text-atria-success">Received</span>
                            ) : (
                              <span className="ml-1 text-atria-text-muted">Not uploaded</span>
                            )}
                          </span>
                          {hasSigned && (
                            <PrefilledDocumentDownloadButton
                              clerkOrgId={clerkOrgId!}
                              documentId={doc?._id}
                              fileName={`${type}_signed.pdf`}
                              variant="signed"
                              label="Download signed"
                            />
                          )}
                        </div>
                      )}
                      {isOnlineForm && (
                        <p className="text-xs text-atria-text-muted">
                          Completed via online form (no upload needed)
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </SectionBlock>

            <SectionBlock title="Documents submitted">
              <div className="mt-3 space-y-2">
                {/* Show HR-uploaded background check result if available */}
                {bgCheck?.officialResultStorageId && (
                  <div className="flex items-center justify-between gap-3 rounded-[var(--radius-atria-md)] border border-atria-info/30 bg-atria-info/5 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-atria-ink">
                        Background Check Result (HR upload)
                      </p>
                      <p className="text-xs text-atria-text-secondary">
                        Official result uploaded by HR
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge variant="success">Verified</StatusBadge>
                      <DownloadButton
                        clerkOrgId={clerkOrgId!}
                        storageId={bgCheck.officialResultStorageId}
                        fileName="official_background_check_result.pdf"
                      />
                    </div>
                  </div>
                )}
                {(detail.documents ?? []).length === 0 && !bgCheck?.officialResultStorageId ? (
                  <p className="text-sm text-atria-text-secondary">
                    No documents submitted yet.
                  </p>
                ) : (
                  (detail.documents ?? []).length > 0 && detail.documents!.map((doc: {
                    _id: string
                    category: string
                    fileName?: string
                    expiresAt?: string
                    status: string
                    storageId?: string
                  }) => (
                    <div
                      key={doc._id}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-atria-ink">
                          {formatDocumentCategoryLabel(doc.category)}
                        </p>
                        {(doc.fileName || doc.expiresAt) && (
                          <p className="truncate text-xs text-atria-text-secondary">
                            {doc.fileName ? doc.fileName : ''}
                            {doc.fileName && doc.expiresAt ? ' · ' : ''}
                            {doc.expiresAt ? `Expires ${formatDateUS(doc.expiresAt)}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge
                          variant={
                            doc.status === 'active' || doc.status === 'verified'
                              ? 'success'
                              : doc.status === 'rejected'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {doc.status === 'active'
                            ? 'Received'
                            : doc.status === 'verified'
                              ? 'Verified'
                              : doc.status === 'rejected'
                                ? 'Missing'
                                : 'Under review'}
                        </StatusBadge>
                        <DownloadButton
                          clerkOrgId={clerkOrgId!}
                          storageId={doc.storageId}
                          fileName={doc.fileName ?? `${formatDocumentCategoryLabel(doc.category)}.pdf`}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionBlock>

            <SectionBlock title="Car insurance">
              <div
                className="rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-4"
                data-testid="car-insurance-section"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-atria-ink">
                    Client transport in personal vehicle
                  </p>
                  <StatusBadge variant={carInsuranceBadge.variant}>
                    {carInsuranceBadge.label}
                  </StatusBadge>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <ApplicationField
                    label="TRANSPORT CLIENTS"
                    value={
                      canTransportClients === true
                        ? 'Yes'
                        : canTransportClients === false
                          ? 'No'
                          : 'Not answered'
                    }
                  />
                  <ApplicationField
                    label="INSURANCE DOCUMENT"
                    value={carInsuranceDoc ? 'Uploaded' : 'Not uploaded'}
                  />
                  <ApplicationField
                    label="EXPIRES"
                    value={
                      carInsuranceDoc?.expiresAt
                        ? formatDateUS(carInsuranceDoc.expiresAt)
                        : '—'
                    }
                  />
                </div>
                {carInsuranceStatus === 'missing' && (
                  <p className="mt-3 text-sm text-atria-danger">
                    This applicant plans to transport clients but has not uploaded a car insurance
                    policy yet.
                  </p>
                )}
                {carInsuranceStatus === 'expired' && (
                  <p className="mt-3 text-sm text-atria-danger">
                    This car insurance policy has expired. Request an updated policy before
                    allowing client transport.
                  </p>
                )}
                {carInsuranceStatus === 'expiring_soon' && (
                  <p className="mt-3 text-sm text-atria-warning">
                    This car insurance policy expires within 30 days. Request a renewed policy.
                  </p>
                )}
              </div>
            </SectionBlock>

            <FieldGroup
              label="Recruiter notes"
              htmlFor="hr-notes"
              helperText="Required when requesting a correction."
            >
              <Textarea
                id="hr-notes"
                data-testid="hr-notes-input"
                value={hrNotes}
                onChange={(e) => setHrNotes(e.target.value)}
                placeholder="Add notes about the application…"
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            <div className="space-y-4">
              <FieldGroup label="PAY RATE" htmlFor="offer-pay-rate">
                <Input
                  id="offer-pay-rate"
                  value={payRate}
                  onChange={(e) => setPayRate(e.target.value)}
                  placeholder="$22.00 / hr"
                />
              </FieldGroup>
              <FieldGroup label="START DATE" htmlFor="offer-start-date">
                <Input
                  id="offer-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </FieldGroup>
              <FieldGroup label="SCHEDULE" htmlFor="offer-schedule">
                <Input
                  id="offer-schedule"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="Flexible, based on availability"
                />
              </FieldGroup>
              <FieldGroup label="SUPERVISOR" htmlFor="offer-supervisor">
                <Input
                  id="offer-supervisor"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  placeholder="Your assigned coordinator"
                />
              </FieldGroup>
              <FieldGroup
                label="CLIENT NAME"
                htmlFor="offer-client-name"
                helperText="The client this hire will be assigned to."
              >
                <Input
                  id="offer-client-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. John Smith"
                />
              </FieldGroup>
              <FieldGroup
                label="OFFER EXPIRES AT"
                htmlFor="offer-expires-at"
                helperText="Candidate must accept before this date."
              >
                <Input
                  id="offer-expires-at"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </FieldGroup>
            </div>
            <hr className="border-atria-border" />

            {(candidate.status === 'applied' || candidate.status === 'application_draft' || candidate.status === 'hr_review' || candidate.status === 'interviewing' || candidate.status === 'offered' || candidate.status === 'accepted') && !canSendOffer && (
              <div className='rounded-[var(--radius-atria-md)] border border-atria-warning bg-atria-warning/10 p-3 text-sm text-atria-warning'>
                <p className='font-medium'>
                  {candidate.status === 'accepted'
                    ? 'Before hiring, complete:'
                    : 'Before sending an offer, complete:'}
                </p>
                <ul className='mt-1 list-inside list-disc'>
                  {!backgroundCheckResultComplete && <li>Upload official background check result</li>}
                  {!w4EmployerComplete && <li>W-4 employer section (name, EIN, first date of employment)</li>}
                  {!i9Section2Complete && <li>I-9 Section 2 verification</li>}
                  {!allTasksComplete && <li>All candidate tasks</li>}
                </ul>
              </div>
            )}

            {(candidate.status === 'applied' || candidate.status === 'application_draft') && (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                data-testid="approve-and-send-offer-button"
                disabled={submitting || !canSendOffer}
                onClick={handleApproveAndSendOffer}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve application & send offer
              </Button>
            )}

            {candidate.status === 'hr_review' && (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                data-testid="advance-button"
                disabled={submitting || !canSendOffer}
                onClick={handleAdvance}
              >
                <CheckCircle2 className="h-4 w-4" />
                Send offer
              </Button>
            )}

            {candidate.status === 'offer_sent' && (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                data-testid="advance-button"
                disabled
              >
                <CheckCircle2 className="h-4 w-4" />
                Offer already sent
              </Button>
            )}

            {candidate.status === 'accepted' && (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                data-testid="hire-button"
                disabled={submitting || !canSendOffer}
                onClick={() => navigate(`/hr/candidates/${candidate._id}/hire`)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Hire candidate
              </Button>
            )}

            {candidate.status === 'hired' && (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                data-testid="hired-button"
                disabled
              >
                <CheckCircle2 className="h-4 w-4" />
                Hired
              </Button>
            )}

            {/* Background Check Status */}
            <div className="mt-4">
              <h3 className="text-base font-semibold text-atria-ink">
                Background check
              </h3>
              <div className="mt-3 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-atria-ink">
                      Provider: {bgCheck?.provider ?? 'Not started'}
                    </p>
                    {bgCheck?.initiatedAt && (
                      <p className="text-xs text-atria-text-muted">
                        Initiated: {formatDateUS(bgCheck.initiatedAt)}
                      </p>
                    )}
                  </div>
                  {bgCheck && (
                    <span className={
                      bgCheck.status === 'clear'
                        ? 'rounded-full bg-atria-success/10 px-3 py-1 text-xs font-medium text-atria-success'
                        : bgCheck.status === 'consider'
                          ? 'rounded-full bg-atria-warning/10 px-3 py-1 text-xs font-medium text-atria-warning'
                          : bgCheck.status === 'error' || bgCheck.status === 'scan_failed'
                            ? 'rounded-full bg-atria-danger/10 px-3 py-1 text-xs font-medium text-atria-danger'
                            : 'rounded-full bg-atria-surface-3 px-3 py-1 text-xs font-medium text-atria-text-secondary'
                    }>
                      {bgCheck.status === 'pending' ? 'In progress' :
                       bgCheck.status === 'clear' ? 'Cleared' :
                       bgCheck.status === 'consider' ? 'Needs review' :
                       bgCheck.status === 'error' ? 'Failed' :
                       bgCheck.status === 'pending_scan' ? 'Scanning document' :
                       bgCheck.status === 'completed' ? 'Completed' :
                       bgCheck.status === 'scan_failed' ? 'Document rejected' :
                       bgCheck.status}
                    </span>
                  )}
                </div>
                {bgCheck?.officialResultStorageId && (
                  <div className="mt-3 border-t border-atria-border pt-3">
                    <p className="text-sm text-atria-success">Official result uploaded</p>
                    <StorageDownloadButton
                      clerkOrgId={clerkOrgId!}
                      storageId={bgCheck.officialResultStorageId}
                      fileName="official_background_check_result.pdf"
                    />
                  </div>
                )}
                <div className="mt-3">
                  <p className="mb-2 text-sm font-medium text-atria-ink">Upload official result</p>
                  <input
                    ref={bgResultInputRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => setBgResultFile(e.target.files?.[0] ?? null)}
                  />
                  <div
                    className="mb-2 cursor-pointer rounded-[var(--radius-atria-md)] border border-dashed border-atria-border bg-atria-surface-2 p-3 text-center text-sm text-atria-text-secondary hover:bg-atria-surface-3"
                    onClick={() => bgResultInputRef.current?.click()}
                  >
                    {bgResultFile ? bgResultFile.name : 'Tap to select official result PDF'}
                  </div>
                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full"
                    disabled={!bgResultFile || isUploadingBgResult}
                    onClick={handleUploadBgResult}
                  >
                    {isUploadingBgResult ? 'Uploading...' : 'Upload official result'}
                  </Button>
                </div>
                {bgCheck?.result && bgCheck.status !== 'pending' && (
                  <div className="mt-3 border-t border-atria-border pt-3">
                    <pre className="whitespace-pre-wrap text-xs text-atria-text-secondary">
                      {(() => {
                        try {
                          const r = JSON.parse(bgCheck.result)
                          return r.summary ?? JSON.stringify(r, null, 2)
                        } catch {
                          return bgCheck.result
                        }
                      })()}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {!allTasksComplete && (
              <p className="text-xs text-atria-text-secondary">
                Complete or waive all candidate tasks before advancing.
              </p>
            )}

            <Button
              variant="secondary"
              size="lg"
              className="w-full border-atria-warning text-atria-warning hover:bg-atria-warning-bg"
              data-testid="request-correction-button"
              disabled={submitting || !hrNotes.trim()}
              onClick={handleCorrection}
            >
              <RotateCcw className="h-4 w-4" />
              Request a correction
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="w-full border-atria-danger text-atria-danger hover:bg-atria-danger-bg"
              data-testid="reject-button"
              disabled={submitting}
              onClick={() => setConfirmReject(true)}
            >
              <XCircle className="h-4 w-4" />
              Reject application
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmReject}
        title="Reject application"
        message={`Are you sure you want to reject ${candidate.displayName}'s application? This action cannot be undone.`}
        confirmLabel="Reject"
        onConfirm={handleReject}
        onCancel={() => setConfirmReject(false)}
      />
      <HrToast toast={toast} onClose={hide} />
    </div>
  )
}
