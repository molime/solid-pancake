import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { cn } from '@/shared/lib/cn'
import { uploadFileToConvex } from '@/shared/lib/upload'

const DOCUMENT_LABELS: Record<string, { title: string; hint: string; expiry: boolean }> = {
  photo_id: {
    title: 'Upload photo ID',
    hint: 'Upload a clear photo or scan of your government-issued ID.',
    expiry: true,
  },
  cpr_certificate: {
    title: 'Upload CPR certificate',
    hint: 'Upload a clear photo or PDF of your current CPR certificate.',
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
  const { taskId = 'required' } = useParams<{ taskId: string }>()
  const { organization, isLoaded } = useOrganization()
  const clerkOrgId = organization?.id
  const tasks = useQuery(
    api.candidates.listCandidateTasks,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const attachDocument = useMutation(api.candidates.attachCandidateDocument)

  const [file, setFile] = useState<File | null>(null)
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const task = useMemo(() => {
    if (!tasks) return null
    const byId = tasks.find((t) => t._id === taskId)
    if (byId) return byId
    return tasks.find((t) => t.type === taskId) ?? null
  }, [tasks, taskId])

  const documentType = task?.type ?? taskId
  const meta = DOCUMENT_LABELS[documentType] ?? DOCUMENT_LABELS.required

  if (!isLoaded || !clerkOrgId) return null

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

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select a file to upload.')
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
        label: meta.title,
        expiresAt: meta.expiry ? expiresAt : undefined,
      })
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      setIsUploading(false)
    }
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[480px]'>
        <CardContent className='p-8'>
          <button
            className='mb-4 text-sm text-atria-text-secondary hover:text-atria-ink'
            onClick={() => navigate('/onboarding/checklist')}
          >
            ← Back to checklist
          </button>

          <div className='mb-6 flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-[var(--radius-atria-md)] bg-atria-accent text-atria-on-accent'>
              <span className='text-lg font-bold'>A</span>
            </div>
            <div>
              <p className='text-lg font-semibold leading-none text-atria-ink'>ATRIA-X</p>
              <p className='text-sm text-atria-text-secondary'>Caregiver Portal</p>
            </div>
          </div>

          <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>{meta.title}</h1>
          <p className='mb-6 text-base text-atria-text-secondary'>{meta.hint}</p>

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
              label='EXPIRY DATE'
              htmlFor='expiresAt'
              helperText='When does this document expire?'
              className='mb-6'
            >
              <Input
                id='expiresAt'
                type='date'
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </FieldGroup>
          )}

          {error && (
            <p className='mb-4 text-sm text-atria-danger'>{error}</p>
          )}

          <Button
            variant='primary'
            size='lg'
            className='w-full'
            disabled={!file || isUploading}
            onClick={handleSubmit}
          >
            {isUploading ? 'Uploading...' : 'Submit document →'}
          </Button>

          <p className='mt-4 text-center text-xs text-atria-text-muted'>
            Files are encrypted and stored securely. Only authorized staff can access them.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
