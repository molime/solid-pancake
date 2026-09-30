import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { USDateInput } from '@/shared/ui/USDateInput'
import { uploadFileToConvex } from '@/shared/lib/upload'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { UploadCloud } from 'lucide-react'

/**
 * Upload a certificate/proof for an external (non-Atria) training. The upload
 * lands in the document archive as pending and admin/HR are notified to
 * verify it in Compliance.
 */
export function ExternalTrainingUploadCard({ clerkOrgId }: { clerkOrgId: string }) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const uploadExternalTraining = useMutation(api.training.uploadExternalTraining)
  const [title, setTitle] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleUpload = async () => {
    if (!file || !title.trim()) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const storageId = await uploadFileToConvex({
        generateUploadUrl,
        clerkOrgId,
        file,
      })
      await uploadExternalTraining({
        clerkOrgId,
        title: title.trim(),
        storageId,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        expiresAt: expiresAt || undefined,
      })
      setSuccess('Uploaded — your admin will verify it and add it to your record.')
      setTitle('')
      setExpiresAt('')
      setFile(null)
    } catch (err) {
      setError(
        err instanceof Error ? sanitizeConvexError(err.message) : 'Upload failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-4 w-4 text-atria-accent" />
          External training certificate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-atria-text-secondary">
          Completed a training outside the platform? Upload the certificate here
          and your admin will verify it into your record.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
              Training title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. CPR Renewal — Red Cross"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
              Expires (optional)
            </label>
            <USDateInput value={expiresAt} onChange={setExpiresAt} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-atria-text-secondary"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleUpload}
            disabled={busy || !file || !title.trim()}
          >
            {busy ? 'Uploading…' : 'Upload for verification'}
          </Button>
        </div>
        {error && <p className="text-sm text-atria-danger">{error}</p>}
        {success && <p className="text-sm text-atria-success">{success}</p>}
      </CardContent>
    </Card>
  )
}
