import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClerk } from '@clerk/react'
import { useTenant } from '@/app/useTenant'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Doc } from '../../../../convex/_generated/dataModel'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { USDateInput } from '@/shared/ui/USDateInput'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { cn } from '@/shared/lib/cn'
import { uploadFileToConvex } from '@/shared/lib/upload'
import { generatePrefilledPdf, saveAndDownload, saveAndUpload } from '../pdf/generatePrefilledPdf'
import { getMapping } from '../pdf/mappings'
import { formatDateUS } from '@/shared/format'

const DOCUMENT_LABELS: Record<string, { title: string; hint: string; expiry: boolean }> = {
  photo_id: {
    title: 'Upload photo ID',
    hint: 'We accept JPG, PNG, or PDF. Max 10MB.',
    expiry: true,
  },
  tax_id_ssn: {
    title: 'Upload Tax ID or SSN',
    hint: 'Upload your Social Security card or tax ID document. JPG, PNG, or PDF. Max 10MB.',
    expiry: false,
  },
  cpr_certificate: {
    title: 'Upload CPR certificate',
    hint: 'We accept JPG, PNG, or PDF. Max 10MB.',
    expiry: true,
  },
  health_screen: {
    title: 'Upload signed health screen',
    hint: 'Upload the health clearance form signed by your doctor confirming you are fit to work. JPG, PNG, or PDF. Max 10MB.',
    expiry: false,
  },
  background_check: {
    title: 'Upload stamped Live Scan receipt',
    hint: 'Upload the stamped Live Scan form or receipt from the office. JPG, PNG, or PDF. Max 10MB.',
    expiry: false,
  },
  additional_certifications: {
    title: 'Upload additional certifications',
    hint: 'Upload any additional certifications you hold. You can upload one or more documents. JPG, PNG, or PDF. Max 10MB each.',
    expiry: false,
  },
  car_insurance: {
    title: 'Car Insurance Policy',
    hint: 'Upload your car insurance policy document. Required only if you will transport clients in your personal vehicle.',
    expiry: true,
  },
  required: {
    title: 'Upload required document',
    hint: 'Upload the requested document.',
    expiry: false,
  },
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024

export function DocumentUploadPage() {
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { taskId = 'required' } = useParams<{ taskId: string }>()
  const { clerkOrgId, tenantName, agencyAddress, isLoading } = useTenant()
  const tasks = useQuery(
    api.candidates.listCandidateTasks,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const applicationData = useQuery(
    api.candidates.getMyApplication,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const attachDocument = useMutation(api.candidates.attachCandidateDocument)
  const savePrefilledDocument = useMutation(api.candidates.savePrefilledDocument)
  const saveSignedPrefilledDocument = useMutation(api.candidates.saveSignedPrefilledDocument)

  const [file, setFile] = useState<File | null>(null)
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [photoIdType, setPhotoIdType] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const task = useMemo(() => {
    if (!tasks) return null
    const byId = tasks.find((t: Doc<'candidateTasks'>) => t._id === taskId)
    if (byId) return byId
    return tasks.find((t: Doc<'candidateTasks'>) => t.type === taskId) ?? null
  }, [tasks, taskId])

  const documentType = task?.type ?? taskId
  const meta = DOCUMENT_LABELS[documentType] ?? DOCUMENT_LABELS.required

  const isPhotoId = documentType === 'photo_id'
  const isMultiUpload = documentType === 'additional_certifications'
  const isHealthScreen = documentType === 'health_screen'
  const isBackgroundCheck = documentType === 'background_check'
  // Signed uploads for these types are also linked to the prefilled document
  // record — block submit until the candidate profile query has loaded so the
  // link is never silently skipped.
  const needsPrefilledLink = isHealthScreen || isBackgroundCheck

  const PHOTO_ID_TYPES = [
    { value: 'passport', label: 'Passport (US)' },
    { value: 'drivers_license', label: "Driver's License" },
    { value: 'foreign_passport', label: 'Foreign Passport' },
  ]

  const candidateId = applicationData?.candidate?._id
  const fields = (applicationData?.application?.fields ?? {}) as Record<string, unknown>
  const agencyName = tenantName ?? 'ATRIA-X'
  const todayUs = new Date().toLocaleDateString('en-US')

  if (isLoading || !clerkOrgId) return null

  const handleFileChange = (selected: File | null) => {
    setError('')
    if (!selected) return
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Only JPG, PNG, WebP, and PDF files are allowed.')
      return
    }
    if (selected.size > MAX_SIZE) {
      setError('File must be smaller than 10 MB.')
      return
    }
    setFile(selected)
  }

  const buildPrefilledData = (): Record<string, unknown> => {
    const personal = (fields.personal ?? {}) as Record<string, unknown>
    const address = (personal.address ?? {}) as Record<string, unknown>
    const i9 = (fields.i9 ?? {}) as Record<string, unknown>
    const w4 = (fields.w4 ?? {}) as Record<string, unknown>

    if (isHealthScreen) {
      const availability = String(personal.availability ?? '')
      const daysOfWeek = Array.isArray(personal.daysOfWeek) ? (personal.daysOfWeek as unknown[]) : []
      return {
        facilityName: agencyName,
        facilityAddress: agencyAddress ?? '',
        personName: `${personal.firstName ?? ''} ${personal.lastName ?? ''}`.trim(),
        positionTitle: personal.positionApplyingFor ?? '',
        workDaysPerWeek: daysOfWeek.length > 0 ? String(daysOfWeek.length) : '5',
        workHoursPerDay:
          availability === 'part_time' ? String(personal.customHours ?? '') || '8' : '8',
        applicantSignature: `${personal.firstName ?? ''} ${personal.lastName ?? ''}`.trim(),
        applicantAddress: `${address.street ?? ''} ${address.apt ?? ''}, ${address.city ?? ''}, ${address.state ?? ''} ${address.zip ?? ''}`.trim(),
        date: todayUs,
      }
    }

    if (isBackgroundCheck) {
      return {
        lastName: personal.lastName ?? w4.lastName ?? '',
        firstName: personal.firstName ?? w4.firstName ?? '',
        dateOfBirth: formatDateUS(String(personal.dateOfBirth ?? i9.dateOfBirth ?? '')),
        socialSecurityNumber: personal.ssn ?? w4.ssn ?? i9.ssn ?? '',
        sexMale: personal.gender === 'male' ? 'X' : '',
        sexFemale: personal.gender === 'female' ? 'X' : '',
        homeAddressStreet: address.street ?? '',
        homeAddressCityStateZip: `${address.city ?? ''}, ${address.state ?? ''} ${address.zip ?? ''}`.trim(),
        transactionDate: todayUs,
      }
    }

    return {}
  }

  const handleDownloadPrefilled = async () => {
    if (!clerkOrgId) return
    setIsGenerating(true)
    setError('')
    try {
      const mapping = getMapping(isHealthScreen ? 'health_screen' : 'live_scan')
      if (!mapping) {
        throw new Error('PDF template mapping not found.')
      }
      const data = buildPrefilledData()
      const bytes = await generatePrefilledPdf(mapping, data)
      const filename = isHealthScreen
        ? 'lic_503_health_screen_prefilled.pdf'
        : 'lic_9163_live_scan_prefilled.pdf'
      saveAndDownload(bytes, filename)
      if (clerkOrgId) {
        const getUploadUrl = async () => {
          const { url } = await generateUploadUrl({ clerkOrgId })
          return url
        }
        await saveAndUpload(
          bytes,
          filename,
          isHealthScreen ? 'health_screen' : 'live_scan',
          clerkOrgId,
          getUploadUrl,
          savePrefilledDocument,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prefilled form.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select a file to upload.')
      return
    }
    if (isPhotoId && !photoIdType) {
      setError('Please select your ID type first.')
      return
    }
    if (meta.expiry && !expiresAt) {
      setError('Please enter the document expiry date.')
      return
    }
    setIsUploading(true)
    setError('')
    try {
      const storageId = await uploadFileToConvex({
        generateUploadUrl,
        clerkOrgId,
        file,
      })
      await attachDocument({
        clerkOrgId,
        storageId,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        documentType,
        label: isPhotoId && photoIdType ? `${meta.title} (${PHOTO_ID_TYPES.find((t) => t.value === photoIdType)?.label ?? photoIdType})` : meta.title,
        expiresAt: meta.expiry ? expiresAt : undefined,
        photoIdType: isPhotoId ? photoIdType : undefined,
      })
      if ((isHealthScreen || isBackgroundCheck) && candidateId) {
        await saveSignedPrefilledDocument({
          clerkOrgId,
          documentType: isHealthScreen ? 'health_screen' : 'live_scan',
          storageId,
        })
      }
      if (isMultiUpload) {
        setUploadedFiles((prev) => [...prev, file.name])
        setFile(null)
        setIsUploading(false)
      } else {
        navigate('/onboarding', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      setIsUploading(false)
    }
  }

  const handleDone = () => {
    navigate('/onboarding', { replace: true })
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[480px]'>
        <CardContent className='p-8'>
          <button
            className='mb-4 text-sm text-atria-accent hover:text-atria-accent-hover'
            onClick={() => navigate('/onboarding/checklist')}
          >
            ← Back to checklist
          </button>

          <div className='mb-6 flex items-center gap-3'>
            <AtriaLogo />
            {/* TODO: resolve via resolveAgencyLogo(tenantName) when multi-agency support is added */}
            <img
              src="/agency-logo-individualschoice.jpeg"
              alt="Agency logo"
              className='h-8 w-auto object-contain'
            />
            <div>
              <p className='text-sm text-atria-text-secondary'>Caregiver Portal</p>
            </div>
            <button
              type='button'
              onClick={() => signOut(() => navigate('/sign-in'))}
              className='ml-auto self-start text-xs text-atria-text-muted hover:text-atria-ink hover:underline'
            >
              Sign out
            </button>
          </div>

          <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>{meta.title}</h1>
          <p className='mb-6 text-base text-atria-text-secondary'>{meta.hint}</p>

          {isHealthScreen && (
            <div className='mb-6 rounded-[var(--radius-atria-md)] border border-atria-info/30 bg-atria-info/10 p-4'>
              <p className='text-sm font-medium text-atria-info'>Before you upload</p>
              <p className='mt-1 text-sm text-atria-ink'>
                You must PRINT this document, take it to your doctor for a health screening, and once you have the signed/stamped form, come back here and upload it. The health screen is at your own cost.
              </p>
              <Button
                variant='secondary'
                size='md'
                className='mt-3 w-full'
                disabled={isGenerating}
                onClick={handleDownloadPrefilled}
              >
                {isGenerating ? 'Generating...' : 'Download prefilled Health Screen form'}
              </Button>
            </div>
          )}

          {isBackgroundCheck && (
            <div className='mb-6 rounded-[var(--radius-atria-md)] border border-atria-info/30 bg-atria-info/10 p-4'>
              <p className='text-sm font-medium text-atria-info'>Live Scan instructions</p>
              <p className='mt-1 text-sm text-atria-ink'>
                You must PRINT this document, take it to the Live Scan office for fingerprinting, and once you have the stamped receipt, come back here and upload it. The company will reimburse the $70 cost.
              </p>
              <p className='mt-2 text-sm text-atria-ink'>
                <strong>Address:</strong> 1625 Flickinger Ave, San Jose, CA 95131
              </p>
              <p className='text-sm text-atria-ink'>
                <strong>Hours:</strong> 9am-4pm Monday to Friday
              </p>
              <Button
                variant='secondary'
                size='md'
                className='mt-3 w-full'
                disabled={isGenerating}
                onClick={handleDownloadPrefilled}
              >
                {isGenerating ? 'Generating...' : 'Download prefilled Live Scan form'}
              </Button>
            </div>
          )}

          {isPhotoId && (
            <div className='mb-6'>
              <p className='mb-3 text-sm font-semibold text-atria-ink'>Select your ID type</p>
              <div className='flex flex-col gap-2'>
                {PHOTO_ID_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    type='button'
                    onClick={() => setPhotoIdType(opt.value)}
                    className={cn(
                      'flex items-center gap-3 rounded-[var(--radius-atria-md)] border p-3 text-left text-sm transition-colors',
                      photoIdType === opt.value
                        ? 'border-atria-accent bg-atria-accent-quiet text-atria-ink'
                        : 'border-atria-border bg-atria-surface-2 text-atria-text-secondary hover:bg-atria-surface-3',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                        photoIdType === opt.value
                          ? 'border-atria-accent bg-atria-accent'
                          : 'border-atria-border bg-atria-surface-3',
                      )}
                    >
                      {photoIdType === opt.value && (
                        <svg className='h-3 w-3 text-white' viewBox='0 0 24 24' fill='currentColor' aria-hidden>
                          <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' />
                        </svg>
                      )}
                    </div>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            className={cn(
              'mb-6 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-atria-md)] border-2 border-dashed p-8 transition-colors',
              file ? 'border-atria-accent bg-atria-accent-quiet' : 'border-atria-border bg-atria-surface-2 hover:bg-atria-surface-3',
            )}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type='file'
              accept={ALLOWED_TYPES.join(',')}
              className='hidden'
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <svg className='h-8 w-8 text-atria-text-secondary' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' aria-hidden>
              <path d='M12 16.5V4.5m0 0-4 4m4-4 4 4M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4' />
            </svg>
            <p className='text-center text-sm text-atria-text-secondary'>
              {file ? file.name : 'Tap to choose a file or take a photo'}
            </p>
          </div>

          {file && (
            <div className='mb-6 flex items-center gap-3 rounded-[var(--radius-atria-sm)] border border-atria-border bg-atria-surface-2 p-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-[var(--radius-atria-sm)] bg-atria-surface-3 text-atria-text-secondary'>
                📄
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium text-atria-ink'>{file.name}</p>
                <p className='text-xs text-atria-text-muted'>{(file.size / 1024).toFixed(1)} KB · Ready to upload</p>
              </div>
              <button
                className='text-sm text-atria-danger hover:underline'
                onClick={() => setFile(null)}
              >
                Remove
              </button>
            </div>
          )}

          {meta.expiry && (
            <FieldGroup
              label='EXPIRY DATE *'
              htmlFor='expiresAt'
              helperText='When does this document expire?'
              className='mb-6'
            >
              <USDateInput
                id='expiresAt'
                value={expiresAt}
                onChange={(iso) => setExpiresAt(iso)}
              />
            </FieldGroup>
          )}

          {error && (
            <p className='mb-4 text-sm text-atria-danger'>{error}</p>
          )}

          {isMultiUpload && uploadedFiles.length > 0 && (
            <div className='mb-4 space-y-2'>
              <p className='text-sm font-medium text-atria-ink'>Uploaded documents:</p>
              {uploadedFiles.map((name, i) => (
                <div key={i} className='flex items-center gap-3 rounded-[var(--radius-atria-sm)] border border-atria-border bg-atria-surface-2 p-3'>
                  <div className='flex h-8 w-8 items-center justify-center rounded-[var(--radius-atria-sm)] bg-atria-success/20 text-atria-success'>
                    <svg className='h-4 w-4' viewBox='0 0 24 24' fill='currentColor' aria-hidden>
                      <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' />
                    </svg>
                  </div>
                  <p className='truncate text-sm text-atria-ink'>{name}</p>
                </div>
              ))}
            </div>
          )}

          {isMultiUpload && uploadedFiles.length > 0 ? (
            <div className='flex gap-3'>
              <Button
                variant='secondary'
                size='lg'
                className='flex-1'
                disabled={isUploading}
                onClick={() => inputRef.current?.click()}
              >
                Upload another
              </Button>
              <Button
                variant='primary'
                size='lg'
                className='flex-1'
                onClick={handleDone}
              >
                Done
              </Button>
            </div>
          ) : (
            <Button
              variant='primary'
              size='lg'
              className='w-full'
              disabled={!file || isUploading || (isPhotoId && !photoIdType) || (meta.expiry && !expiresAt) || (needsPrefilledLink && !candidateId)}
              onClick={handleSubmit}
            >
              {isUploading ? 'Uploading...' : isMultiUpload ? 'Upload document' : 'Submit document'}
            </Button>
          )}

          <p className='mt-4 text-center text-xs text-atria-text-muted'>
            Your documents are encrypted and only seen by your recruiter.
          </p>

          {isMultiUpload && (
            <div className='mt-6 border-t border-atria-border pt-4'>
              <p className='mb-2 text-center text-xs text-atria-text-muted'>
                This step is optional. If you don't have additional certifications, you can skip it.
              </p>
              <Button
                variant='secondary'
                size='md'
                className='w-full'
                onClick={() => navigate('/onboarding')}
              >
                Skip this step →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
