import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/react'
import { clearSessionData } from '@/shared/lib/clearSession'
import { useTenant } from '@/app/useTenant'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { AppLoader } from '@/shared/ui/AppLoader'
import { cn } from '@/shared/lib/cn'
import { uploadFileToConvex } from '@/shared/lib/upload'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024

/**
 * Post-hire gate page (Golden Ages): the HCS 501 Home Care Organization
 * Personnel Record must be completed by the employee at the time of hire.
 * The caregiver downloads the blank form, fills it, uploads the completed
 * copy, and only then regains access to the dashboard.
 */
export function PersonnelRecordPage() {
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { clerkOrgId, tenantName, isLoading } = useTenant()

  const handleSignOut = () => {
    clearSessionData()
    signOut(() => navigate('/sign-in'))
  }

  // Sticky mounting: once the page has rendered its content once, it must
  // never unmount back to a loader during brief Clerk/Convex auth flickers.
  const hasMountedRef = useRef(false)
  const lastClerkOrgIdRef = useRef<string | undefined>(undefined)
  // eslint-disable-next-line react-hooks/refs
  if (clerkOrgId) lastClerkOrgIdRef.current = clerkOrgId
  // eslint-disable-next-line react-hooks/refs
  const effectiveClerkOrgId = clerkOrgId ?? lastClerkOrgIdRef.current

  const status = useQuery(
    api.candidates.getMyDocumentUploadStatus,
    effectiveClerkOrgId
      ? { clerkOrgId: effectiveClerkOrgId, documentType: 'hcs_501' }
      : 'skip',
  )
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const saveSignedPrefilledDocument = useMutation(
    api.candidates.saveSignedPrefilledDocument,
  )

  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // eslint-disable-next-line react-hooks/refs
  if (!hasMountedRef.current && (isLoading || !effectiveClerkOrgId)) {
    return <AppLoader fullScreen />
  }
  // eslint-disable-next-line react-hooks/refs
  hasMountedRef.current = true
  const orgId = effectiveClerkOrgId as string

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

  const handleUpload = async () => {
    if (!file) {
      setError('Please select the completed form to upload.')
      return
    }
    setIsUploading(true)
    setError('')
    try {
      const storageId = await uploadFileToConvex({
        generateUploadUrl,
        clerkOrgId: orgId,
        file,
      })
      await saveSignedPrefilledDocument({
        clerkOrgId: orgId,
        documentType: 'hcs_501',
        storageId,
      })
      navigate('/caregiver/today', { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Upload failed. Please try again.',
      )
      setIsUploading(false)
    }
  }

  const uploaded = status?.uploaded === true

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[480px]'>
        <CardContent className='p-8'>
          <div className='mb-6 flex flex-col items-center text-center'>
            <AtriaLogo />
            <p className='mt-2 text-sm text-atria-text-secondary'>
              {tenantName ?? 'ATRIA-X'}
            </p>
            <button
              type='button'
              onClick={handleSignOut}
              className='mt-2 text-xs text-atria-text-muted hover:text-atria-ink hover:underline'
            >
              Sign out
            </button>
          </div>

          <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>
            Personnel record (HCS 501)
          </h1>
          <p className='mb-6 text-base text-atria-text-secondary'>
            California requires every Home Care Organization to keep a
            completed HCS 501 personnel record for each employee. Download the
            blank form, fill it out, and upload the completed copy to continue.
          </p>

          <div className='mb-6 rounded-[var(--radius-atria-md)] border border-atria-info/30 bg-atria-info/10 p-4'>
            <p className='text-sm font-medium text-atria-info'>Step 1 — Download</p>
            <a
              href='/templates/hcs_501_personnel_record.pdf'
              download='hcs_501_personnel_record.pdf'
              className='mt-2 block w-full rounded-[var(--radius-atria-md)] bg-atria-surface-2 px-4 py-2.5 text-center text-sm font-medium text-atria-accent hover:bg-atria-surface-3 hover:underline'
            >
              Download blank HCS 501 form
            </a>
          </div>

          {uploaded ? (
            <div className='mb-6 rounded-[var(--radius-atria-md)] border border-atria-success/30 bg-atria-success-bg p-4'>
              <p className='text-sm font-medium text-atria-success'>
                ✓ Completed form received
              </p>
              <p className='mt-1 text-sm text-atria-ink'>
                Your personnel record is on file. You can upload a new copy
                below if you need to replace it.
              </p>
            </div>
          ) : (
            <div className='mb-6 rounded-[var(--radius-atria-md)] border border-atria-warning/30 bg-atria-warning-bg p-4'>
              <p className='text-sm font-medium text-atria-warning'>
                Step 2 — Upload your completed form
              </p>
              <p className='mt-1 text-sm text-atria-ink'>
                You need to upload your completed HCS 501 before you can access
                your dashboard. JPG, PNG, or PDF. Max 10MB.
              </p>
            </div>
          )}

          <div
            className={cn(
              'mb-6 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-atria-md)] border-2 border-dashed p-8 transition-colors',
              file
                ? 'border-atria-accent bg-atria-accent-quiet'
                : 'border-atria-border bg-atria-surface-2 hover:bg-atria-surface-3',
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
              {file ? file.name : 'Tap to choose the completed form'}
            </p>
          </div>

          {error && <p className='mb-4 text-sm text-atria-danger'>{error}</p>}

          <Button
            variant='primary'
            size='lg'
            className='w-full'
            disabled={!file || isUploading}
            onClick={handleUpload}
          >
            {isUploading ? 'Uploading...' : uploaded ? 'Replace uploaded form' : 'Submit completed form'}
          </Button>

          {uploaded && (
            <Button
              variant='secondary'
              size='lg'
              className='mt-3 w-full'
              onClick={() => navigate('/caregiver/today', { replace: true })}
            >
              Go to dashboard →
            </Button>
          )}

          <p className='mt-4 text-center text-xs text-atria-text-muted'>
            Your document is encrypted and stored in your personnel file, where
            HR, admin, and coordinators can review it.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
