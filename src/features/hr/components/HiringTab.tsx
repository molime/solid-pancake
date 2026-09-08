import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { EmptyState } from '@/shared/ui/EmptyState'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Badge } from '@/shared/ui/Badge'
import { UserCheck, Download, FileText } from 'lucide-react'
import { formatDateUS } from '@/shared/format'

type FieldValue = unknown

function display(value: FieldValue): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    return value.map(display).join(', ')
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, FieldValue>
    if ('street' in rec) {
      return [rec.street, rec.apt, rec.city, rec.state, rec.zip]
        .filter((part) => part !== undefined && part !== null && part !== '')
        .map(String)
        .join(', ')
    }
    return JSON.stringify(value)
  }
  return String(value)
}

function Field({ label, value }: { label: string; value: FieldValue }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-base text-atria-ink">
        {display(value)}
      </p>
    </div>
  )
}

function Section({
  title,
  rows,
}: {
  title: string
  rows: Array<[string, FieldValue]>
}) {
  const visible = rows.filter(([, v]) => display(v) !== '—')
  if (visible.length === 0) return null
  return (
    <section>
      <h3 className="mb-2 text-base font-semibold text-atria-ink">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map(([label, value]) => (
          <Field key={label} label={label} value={value} />
        ))}
      </div>
    </section>
  )
}

function ArchiveDocDownload({
  clerkOrgId,
  storageId,
  fileName,
}: {
  clerkOrgId: string
  storageId: string
  fileName: string
}) {
  const url = useQuery(api.files.getStorageUrl, { clerkOrgId, storageId })
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
      className="inline-flex items-center gap-1 text-xs font-medium text-atria-accent hover:underline"
    >
      <Download className="h-3.5 w-3.5" />
      Download
    </a>
  )
}

function PrefilledDocDownload({
  clerkOrgId,
  documentId,
  variant,
  fileName,
}: {
  clerkOrgId: string
  documentId: Id<'prefilledDocuments'>
  variant: 'prefilled' | 'signed'
  fileName: string
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
      className="inline-flex items-center gap-1 text-xs font-medium text-atria-accent hover:underline"
    >
      <Download className="h-3.5 w-3.5" />
      {variant === 'signed' ? 'Completed copy' : 'Prefilled'}
    </a>
  )
}

const PREFILLED_DOC_LABELS: Record<string, string> = {
  health_screen: 'Health Screen (LIC 503)',
  live_scan: 'Live Scan (LIC 9163)',
  criminal_record: 'Criminal Record (LIC 508)',
  i9: 'I-9 Employment Eligibility',
  w4: 'W-4 Tax Withholding',
  de_34: 'DE 34 — Report of New Employee(s)',
  bcia_8016: 'BCIA 8016 — Live Scan Request',
  hcs_501: 'HCS 501 — Personnel Record',
}

/**
 * "Hiring" tab on the employee profile: everything the person submitted as a
 * candidate — application answers (personal, employment, references,
 * criminal record, I-9/W-4, banking/disbursement, acknowledgments), the
 * documents they uploaded, and the prefilled PDFs generated during the
 * application flow.
 */
export function HiringTab({
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

  const detail = useQuery(
    api.candidates.getCandidateDetail,
    clerkOrgId && candidateId ? { clerkOrgId, candidateId } : 'skip',
  )
  const prefilled = useQuery(
    api.candidates.getPrefilledDocuments,
    clerkOrgId && candidateId ? { clerkOrgId, candidateId } : 'skip',
  )

  if (candidate === null) {
    return (
      <EmptyState
        icon={<UserCheck className="h-6 w-6" />}
        title="No hiring record"
        description="This employee was added manually and did not go through the application flow."
      />
    )
  }

  if (!detail) {
    return <p className="text-sm text-atria-text-secondary">Loading hiring record…</p>
  }

  const application = detail.applications[0]
  const fields = (application?.fields ?? {}) as Record<string, FieldValue>
  const personal = (fields.personal ?? {}) as Record<string, FieldValue>
  const address = (personal.address ?? {}) as Record<string, FieldValue>
  const criminal = (fields.criminalRecord ?? {}) as Record<string, FieldValue>
  const i9 = (fields.i9 ?? {}) as Record<string, FieldValue>
  const w4 = (fields.w4 ?? {}) as Record<string, FieldValue>
  const disbursement = (fields.disbursement ?? {}) as Record<string, FieldValue>
  const acknowledgments = (fields.acknowledgments ?? {}) as Record<
    string,
    { agreed?: boolean; initials?: string; date?: string }
  >
  const employment = Array.isArray(fields.employment)
    ? (fields.employment as Array<Record<string, FieldValue>>)
    : []
  const references = Array.isArray(fields.references)
    ? (fields.references as Array<Record<string, FieldValue>>)
    : []

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success">{detail.candidate.status}</Badge>
        {application?.submittedAt && (
          <span className="text-sm text-atria-text-secondary">
            Applied {formatDateUS(application.submittedAt)}
          </span>
        )}
      </div>

      <Section
        title="Personal information"
        rows={[
          ['First name', personal.firstName],
          ['Last name', personal.lastName],
          ['Middle initial', personal.middleInitial],
          ['Email', personal.email],
          ['Home phone', personal.homePhone],
          ['Cell phone', personal.cellPhone],
          ['Date of birth', personal.dateOfBirth],
          ['Gender', personal.gender],
          ['Address', address],
          ['SSN / ITIN', personal.ssn],
          ['Position applied for', personal.positionApplyingFor],
          ['Availability', personal.availability],
          ['Shift', personal.shift],
          ['Days of week', personal.daysOfWeek],
        ]}
      />

      {employment.length > 0 && (
        <section>
          <h3 className="mb-2 text-base font-semibold text-atria-ink">
            Employment history
          </h3>
          <ul className="flex flex-col gap-2">
            {employment.map((entry, idx) => (
              <li
                key={idx}
                className="rounded-[var(--radius-atria-md)] bg-atria-surface-2 p-3"
              >
                <p className="text-sm font-medium text-atria-ink">
                  {display(entry.companyName)} — {display(entry.position)}
                </p>
                <p className="text-sm text-atria-text-secondary">
                  {display(entry.fromMoYr)} to {display(entry.toMoYr) || 'Present'}
                  {' · '}Supervisor: {display(entry.supervisorContact)}
                  {' · '}Reason for leaving: {display(entry.reasonForLeaving)}
                </p>
                <p className="text-sm text-atria-text-secondary">
                  Duties: {display(entry.jobDuties)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {references.length > 0 && (
        <section>
          <h3 className="mb-2 text-base font-semibold text-atria-ink">References</h3>
          <ul className="flex flex-col gap-2">
            {references.map((ref, idx) => (
              <li
                key={idx}
                className="rounded-[var(--radius-atria-md)] bg-atria-surface-2 p-3 text-sm text-atria-ink"
              >
                {display(ref.name)} — {display(ref.relationship)} (
                {display(ref.phone)})
              </li>
            ))}
          </ul>
        </section>
      )}

      <Section
        title="Criminal record statement (LIC 508 answers)"
        rows={[
          ['Convicted of a crime in California', criminal.convictedCalifornia],
          ['Convicted in another state or jurisdiction', criminal.convictedOther],
          ['Conviction details', criminal.convictedDetails],
          ['Convicted under an alias', criminal.convictedUnderAlias],
          ['Alias names', criminal.aliasNames],
          ['Lived outside California in the last 5 years', criminal.livedOutsideCalifornia],
        ]}
      />

      <Section
        title="I-9"
        rows={[
          ['Last name', i9.lastName],
          ['First name', i9.firstName],
          ['Middle initial', i9.middleInitial],
          ['Other last names', i9.otherLastNames],
          ['Address', i9.address],
          ['Apt number', i9.aptNumber],
          ['City', i9.city],
          ['State', i9.state],
          ['ZIP', i9.zip],
          ['Date of birth', i9.dateOfBirth],
          ['SSN', i9.ssn],
          ['Email', i9.email],
          ['Phone', i9.phone],
          ['Citizenship status', i9.citizenshipStatus],
          ['Alien number', i9.alienNumber],
          ['Signature', i9.signature],
          ['Date signed', i9.date],
        ]}
      />

      <Section
        title="W-4"
        rows={[
          ['First name', w4.firstName],
          ['Last name', w4.lastName],
          ['Middle initial', w4.middleInitial],
          ['SSN', w4.ssn],
          ['Address', w4.address],
          ['City / state / ZIP', w4.cityStateZip],
          ['Filing status', w4.filingStatus],
          ['Dependents (other)', (w4.dependents as FieldValue) ?? w4.otherDependents],
          ['Signature', w4.signature],
          ['Date signed', w4.date],
        ]}
      />

      <Section
        title="Disbursement (banking)"
        rows={[
          ['Method', disbursement.method],
          ['Bank name', disbursement.bankName],
          ['Account type', disbursement.accountType],
          ['Routing number', disbursement.routingNumber],
          ['Account number', disbursement.accountNumber],
        ]}
      />

      {Object.keys(acknowledgments).length > 0 && (
        <section>
          <h3 className="mb-2 text-base font-semibold text-atria-ink">
            Acknowledgments
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(acknowledgments).map(([key, item]) => (
              <Field
                key={key}
                label={key.replace(/([A-Z])/g, ' $1').toUpperCase()}
                value={
                  item?.agreed
                    ? `Agreed by ${item.initials ?? ''} on ${item.date ?? ''}`
                    : 'Not acknowledged'
                }
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-base font-semibold text-atria-ink">
          Documents submitted
        </h3>
        {detail.documents.length === 0 ? (
          <p className="text-sm text-atria-text-secondary">
            No documents were uploaded during the hiring process.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.documents.map((doc) => (
              <li
                key={doc._id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-atria-text-muted" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-atria-ink">
                      {doc.fileName ?? doc.category}
                    </p>
                    <p className="text-xs text-atria-text-muted">{doc.category}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge
                    variant={
                      doc.status === 'verified'
                        ? 'success'
                        : doc.status === 'rejected'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {doc.status}
                  </StatusBadge>
                  {doc.storageId && (
                    <ArchiveDocDownload
                      clerkOrgId={clerkOrgId}
                      storageId={doc.storageId}
                      fileName={doc.fileName ?? `${doc.category}.pdf`}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-base font-semibold text-atria-ink">
          Generated documents
        </h3>
        {!prefilled || prefilled.length === 0 ? (
          <p className="text-sm text-atria-text-secondary">
            No prefilled documents were generated for this candidate.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {prefilled.map((doc) => (
              <li
                key={doc._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-3"
              >
                <span className="text-sm font-medium text-atria-ink">
                  {PREFILLED_DOC_LABELS[doc.documentType] ?? doc.documentType}
                </span>
                <span className="flex items-center gap-3">
                  {doc.storageId && (
                    <PrefilledDocDownload
                      clerkOrgId={clerkOrgId}
                      documentId={doc._id}
                      variant="prefilled"
                      fileName={`${doc.documentType}_prefilled.pdf`}
                    />
                  )}
                  {doc.uploadedSignedStorageId && (
                    <PrefilledDocDownload
                      clerkOrgId={clerkOrgId}
                      documentId={doc._id}
                      variant="signed"
                      fileName={`${doc.documentType}_completed.pdf`}
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
