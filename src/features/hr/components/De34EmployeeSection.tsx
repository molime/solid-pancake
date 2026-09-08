import { useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '@/shared/ui/Button'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { uploadFileToConvex } from '@/shared/lib/upload'
import { formatDateUS } from '@/shared/format'
import { Download, FileText, Upload } from 'lucide-react'

const DOCUMENT_TYPE = 'de_34'

function DownloadLink({
  clerkOrgId,
  documentId,
  variant,
  fileName,
  label,
}: {
  clerkOrgId: string
  documentId: Id<'prefilledDocuments'>
  variant: 'prefilled' | 'signed'
  fileName: string
  label: string
}) {
  const url = useQuery(api.candidates.getPrefilledDocumentDownloadUrl, {
    clerkOrgId,
    documentId,
    variant,
  })
  return (
    <a
      href={url ?? '#'}
      download={fileName}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={!url}
      onClick={(e) => {
        if (!url) e.preventDefault()
      }}
      className="inline-flex h-8 items-center gap-1 rounded-md border border-atria-border bg-atria-surface px-2.5 text-xs font-medium text-atria-ink hover:bg-atria-surface-2 disabled:pointer-events-none disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </a>
  )
}

/**
 * New Hire Report (DE 34) panel on the employee profile. The prefilled
 * (partial) version is generated when the candidate submits their
 * application; HR completes the remaining fields (start-of-work date,
 * employer account details), submits the form to the EDD, and uploads the
 * final copy here. Both versions stay attached to the employee's record and
 * remain downloadable/replaceable at any time.
 */
export function De34EmployeeSection({
  clerkOrgId,
  clerkUserId,
}: {
  clerkOrgId: string
  clerkUserId: string
}) {
  const candidate = useQuery(
    api.candidates.getCandidateByClerkUserId,
    clerkOrgId ? { clerkOrgId, clerkUserId } : 'skip',
  )
  const candidateId = candidate?.candidateId

  const docs = useQuery(
    api.candidates.getPrefilledDocuments,
    clerkOrgId && candidateId ? { clerkOrgId, candidateId } : 'skip',
  )
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const saveForHR = useMutation(api.candidates.saveSignedPrefilledDocumentForHR)

  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Employees without a candidate record (manual adds) never had a DE 34
  // generated — hide the panel for them.
  if (candidate === null) return null

  const doc = docs?.find((d) => d.documentType === DOCUMENT_TYPE)
  const hasPrefilled = !!doc?.storageId
  const hasCompleted = !!doc?.uploadedSignedStorageId

  const handleUpload = async () => {
    if (!file || !candidateId) return
    setIsUploading(true)
    setError('')
    try {
      const storageId = await uploadFileToConvex({
        generateUploadUrl,
        clerkOrgId,
        file,
      })
      await saveForHR({
        clerkOrgId,
        candidateId,
        documentType: DOCUMENT_TYPE,
        storageId,
      })
      setFile(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Upload failed. Please try again.',
      )
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section className="rounded-[var(--radius-atria-md)] border border-atria-warning/40 bg-atria-warning-bg p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-atria-warning" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-atria-ink">
              New Hire Report (DE 34)
            </p>
            <p className="text-sm text-atria-text-secondary">
              Prefilled with the applicant&apos;s information. Complete the
              remaining fields (start-of-work date, employer account details),
              submit the form to the EDD, and upload the final copy here. Both
              versions are kept in this employee&apos;s record.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {doc && hasPrefilled && (
            <>
              <DownloadLink
                clerkOrgId={clerkOrgId}
                documentId={doc._id}
                variant="prefilled"
                fileName="de_34_new_hire_prefilled.pdf"
                label="Download prefilled (partial)"
              />
              <span className="text-xs text-atria-text-muted">
                Generated {formatDateUS(doc.generatedAt)}
              </span>
            </>
          )}
          {doc && !hasPrefilled && (
            <span className="text-xs text-atria-text-muted">
              No prefilled version on file (application may predate DE 34
              generation).
            </span>
          )}
          {doc && hasCompleted && (
            <DownloadLink
              clerkOrgId={clerkOrgId}
              documentId={doc._id}
              variant="signed"
              fileName="de_34_new_hire_completed.pdf"
              label="Download completed version"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              setError('')
              setFile(e.target.files?.[0] ?? null)
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            {file ? 'Choose a different file' : 'Choose completed DE 34 (PDF)'}
          </Button>
          {file && (
            <span className="text-xs text-atria-text-secondary">
              {file.name}
            </span>
          )}
          <Button
            variant="primary"
            size="sm"
            disabled={!file || isUploading}
            onClick={handleUpload}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            {isUploading
              ? 'Uploading...'
              : hasCompleted
                ? 'Replace completed version'
                : 'Upload completed version'}
          </Button>
          <span className="text-xs text-atria-text-muted">
            {hasCompleted
              ? '✓ Completed version on file'
              : 'Completed version not uploaded yet'}
          </span>
        </div>

        {error && <p className="text-sm text-atria-danger">{error}</p>}
      </div>
    </section>
  )
}
