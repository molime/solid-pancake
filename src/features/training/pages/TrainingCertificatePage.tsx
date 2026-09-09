import { useParams, useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/react'
import { clearSessionData } from '@/shared/lib/clearSession'
import { getStoredClerkOrgId, useTenant } from '@/app/useTenant'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { AppLoader } from '@/shared/ui/AppLoader'
import { formatDateUS } from '@/shared/format'
import { Award, Printer, ArrowLeft, Download } from 'lucide-react'

export function TrainingCertificatePage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { clerkOrgId } = useTenant()
  const effectiveClerkOrgId = clerkOrgId ?? getStoredClerkOrgId() ?? undefined

  const handleSignOut = () => {
    clearSessionData()
    signOut(() => navigate('/sign-in'))
  }

  const certificateData = useQuery(
    api.training.getCourseCertificate,
    effectiveClerkOrgId && courseId
      ? {
          clerkOrgId: effectiveClerkOrgId,
          courseId: courseId as Id<'trainingCourses'>,
        }
      : 'skip',
  )

  if (!effectiveClerkOrgId || !courseId) {
    return <AppLoader fullScreen label="Opening certificate..." />
  }

  if (certificateData === undefined) {
    return <AppLoader fullScreen label="Loading certificate..." />
  }

  if (!certificateData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h1 className="mb-2 text-xl font-bold text-atria-ink">
              Certificate not found
            </h1>
            <p className="mb-6 text-sm text-atria-text-secondary">
              Finish the course to earn your certificate. Certificates are
              issued after all required steps are completed.
            </p>
            <Button variant="primary" onClick={() => navigate('/training')}>
              Back to Training
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { course, completion, file, recipientName } = certificateData
  const completedAt = completion.completedAt
  const expiresAt =
    completion.expiresAt ??
    new Date(
      new Date(completedAt).getTime() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString()
  const displayName = recipientName ?? 'Caregiver'

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadText = () => {
    const text =
      `TRAINING CERTIFICATE\n\n` +
      `Recipient: ${displayName}\n` +
      `Course: ${course.title}\n` +
      `Completed: ${formatDateUS(completedAt)}\n` +
      `Valid until: ${formatDateUS(expiresAt)}\n\n` +
      `This certificate verifies the holder has completed the required training.`
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${course.title} Certificate.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-atria-bg px-4 py-8 print:py-0">
      <Card className="w-full max-w-[720px] print:max-w-none print:rounded-none print:border-0 print:shadow-none print:bg-white">
        <CardContent className="p-8">
          <div className="mb-6 flex items-center justify-between print:hidden">
            <button
              type="button"
              onClick={() => navigate('/training')}
              className="flex items-center gap-1 text-sm text-atria-text-secondary hover:text-atria-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to training
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-atria-text-muted hover:text-atria-ink hover:underline"
            >
              Sign out
            </button>
          </div>

          <div
            id="training-certificate"
            className="relative border-4 border-atria-accent/20 bg-atria-surface p-8 text-center print:border-atria-accent/40 print:bg-white"
          >
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-atria-accent text-white">
                <Award className="h-10 w-10" />
              </div>
            </div>

            <p className="mb-2 text-sm font-bold uppercase tracking-widest text-atria-text-secondary print:text-atria-ink">
              Certificate of Completion
            </p>
            <h1 className="mb-4 text-2xl font-bold text-atria-ink md:text-3xl">
              {course.title}
            </h1>

            <p className="mb-6 text-base text-atria-text-secondary print:text-atria-ink">
              This certifies that
            </p>
            <p className="mb-6 text-xl font-semibold text-atria-ink md:text-2xl">
              {displayName}
            </p>
            <p className="mb-8 text-base text-atria-text-secondary print:text-atria-ink">
              has successfully completed all required training on{' '}
              <strong>{formatDateUS(completedAt)}</strong>.
            </p>

            <div className="mb-8 grid gap-4 border-y border-atria-border py-6 sm:grid-cols-2 print:border-atria-border">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-atria-text-muted">
                  Completed
                </p>
                <p className="text-lg font-semibold text-atria-ink">
                  {formatDateUS(completedAt)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-atria-text-muted">
                  Expires
                </p>
                <p className="text-lg font-semibold text-atria-ink">
                  {formatDateUS(expiresAt)}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <AtriaLogo />
              <p className="text-sm text-atria-text-secondary print:text-atria-ink">
                Golden Ages Home Care · ATRIA-X Digital Solutions
              </p>
            </div>

            {file?.createdAt && (
              <p className="mt-6 text-xs text-atria-text-muted print:text-atria-ink">
                Issued on {formatDateUS(file.createdAt)}
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 print:hidden sm:flex-row">
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" />
              Print certificate
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={handleDownloadText}
            >
              <Download className="h-4 w-4" />
              Download text
            </Button>
          </div>
        </CardContent>
      </Card>

      <style>{`
        @media print {
          body {
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:max-w-none {
            max-width: none !important;
          }
          .print\\:rounded-none {
            border-radius: 0 !important;
          }
          .print\\:border-0 {
            border-width: 0 !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:bg-white {
            background-color: white !important;
          }
          .print\\:border-atria-accent\\/40 {
            border-color: rgba(var(--color-atria-accent), 0.4) !important;
          }
          .print\\:border-atria-border {
            border-color: var(--atria-border) !important;
          }
          .print\\:text-atria-ink {
            color: var(--atria-ink) !important;
          }
        }
      `}</style>
    </div>
  )
}
