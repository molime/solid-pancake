import { useOrganization } from '@clerk/react'
import { useConvex, useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { Input } from '@/shared/ui/Input'
import { Badge } from '@/shared/ui/Badge'
import { USDateInput } from '@/shared/ui/USDateInput'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { downloadCsv } from '@/shared/lib/downloadCsv'
import { uploadFileToConvex } from '@/shared/lib/upload'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { cn } from '@/shared/lib/cn'
import { CheckCircle2, ChevronDown, ChevronRight, Download } from 'lucide-react'

// The simple /audit view (docs/design-audit-simplification.md, stages 2+4):
// one traffic light, a plain-language fix list grouped per employee with
// search + employee/client filters, an in-place fix popup, and one export
// button. Every number comes from auditReadiness.getFixList, which derives
// from the same backend computations as the full view — never a parallel
// data path.

const DAY_MS = 24 * 60 * 60 * 1000

type PacketPeriod = 'last_3_months' | 'this_year' | 'everything'

const PACKET_PERIODS: { value: PacketPeriod; label: string }[] = [
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'this_year', label: 'This year' },
  { value: 'everything', label: 'Everything' },
]

function packetWindow(period: PacketPeriod) {
  const endDate = new Date().toISOString().slice(0, 10)
  if (period === 'last_3_months') {
    return {
      startDate: new Date(Date.now() - 90 * DAY_MS).toISOString().slice(0, 10),
      endDate,
    }
  }
  if (period === 'this_year') {
    return { startDate: `${new Date().getFullYear()}-01-01`, endDate }
  }
  return { startDate: '2000-01-01', endDate }
}

const STATUS_PRESENTATION = {
  ready: {
    dot: 'bg-atria-success',
    headline: "You're audit ready.",
    subtext: 'Nothing needs fixing right now.',
  },
  almost: {
    dot: 'bg-atria-warning',
    headline: (count: number) =>
      `Almost — fix ${count === 1 ? 'this 1 thing' : `these ${count} things`}.`,
    subtext: 'Each one has a Fix it button below.',
  },
  not_ready: {
    dot: 'bg-atria-danger',
    headline: (count: number) =>
      `Not ready — fix ${count === 1 ? 'this 1 thing' : `these ${count} things`}.`,
    subtext: 'Start at the top — the most urgent item is listed first.',
  },
} as const

type FixListItem = FunctionReturnType<
  typeof api.auditReadiness.getFixList
>['items'][number]

const CREDENTIAL_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]
const MAX_CREDENTIAL_FILE_SIZE = 10 * 1024 * 1024

// Human wording for the nudge email (review-call feedback: the old message
// read like "Reminder from your agency: No expired credentials: Expired
// Driver License").
function credentialReminderMessage(
  label: string,
  state: 'missing' | 'expired' | 'expiring',
) {
  if (state === 'expired') {
    return `Reminder from your agency: your ${label} has expired — please upload a renewed one.`
  }
  if (state === 'expiring') {
    return `Reminder from your agency: your ${label} expires soon — please upload a renewed one.`
  }
  return `Reminder from your agency: your ${label} is missing — please upload it as soon as you can.`
}

/**
 * In-place fix popup (no redirect). Credential items show only the relevant
 * artifact: the admin uploads the missing/expired document right here via the
 * same files + documentArchive pipeline as the rest of the app, or emails the
 * employee a reminder to upload it themselves. Other items show the issue
 * detail plus a link into the console that owns the fix.
 */
function FixDialog({
  item,
  clerkOrgId,
  onClose,
}: {
  item: FixListItem
  clerkOrgId: string
  onClose: () => void
}) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const addCredential = useMutation(
    api.documentArchive.addEmployeeCredentialDocument,
  )
  const sendReminder = useMutation(api.notifications.sendReminderToMember)

  const [file, setFile] = useState<File | null>(null)
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isReminding, setIsReminding] = useState(false)
  const [reminderSent, setReminderSent] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const credential = item.credential

  const handleFileChange = (selected: File | null) => {
    setError('')
    if (!selected) return
    if (!CREDENTIAL_FILE_TYPES.includes(selected.type)) {
      setError('Only JPG, PNG, WebP, and PDF files are allowed.')
      return
    }
    if (selected.size > MAX_CREDENTIAL_FILE_SIZE) {
      setError('File must be smaller than 10 MB.')
      return
    }
    setFile(selected)
  }

  const handleUpload = async () => {
    if (!file || !credential) return
    setIsUploading(true)
    setError('')
    try {
      const storageId = await uploadFileToConvex({
        generateUploadUrl,
        clerkOrgId,
        file,
      })
      await addCredential({
        clerkOrgId,
        employeeProfileId:
          credential.employeeProfileId as Id<'employeeProfiles'>,
        category: credential.category,
        label: credential.label,
        storageId,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        expiresAt: expiresAt ? `${expiresAt}T00:00:00.000Z` : undefined,
      })
      onClose()
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Upload failed. Please try again.',
      )
      setIsUploading(false)
    }
  }

  const handleSendReminder = async () => {
    if (!credential?.clerkUserId) return
    setIsReminding(true)
    try {
      await sendReminder({
        clerkOrgId,
        clerkUserId: credential.clerkUserId,
        message: credentialReminderMessage(credential.label, credential.state),
      })
      setReminderSent(true)
    } catch {
      // The button re-enables so the admin can retry.
    } finally {
      setIsReminding(false)
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader>
        <DialogTitle>{item.title}</DialogTitle>
      </DialogHeader>
      <DialogContent className="space-y-4">
        {item.detail && (
          <p className="text-sm text-atria-text-secondary">{item.detail}</p>
        )}
        {credential ? (
          <>
            <div
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-atria-md)] border-2 border-dashed p-6 transition-colors',
                file
                  ? 'border-atria-accent bg-atria-accent-quiet'
                  : 'border-atria-border bg-atria-surface-2 hover:bg-atria-surface-3',
              )}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept={CREDENTIAL_FILE_TYPES.join(',')}
                className="hidden"
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0] ?? null)
                }
              />
              <p className="text-center text-sm text-atria-text-secondary">
                {file
                  ? file.name
                  : `Choose the ${credential.label} document to upload`}
              </p>
            </div>
            <label className="block text-sm text-atria-text-secondary">
              Expiration date (if the document has one)
              <USDateInput
                aria-label="Credential expiration date"
                value={expiresAt}
                onChange={setExpiresAt}
                className="mt-1"
              />
            </label>
            {error && <p className="text-sm text-atria-danger">{error}</p>}
            <Button
              variant="primary"
              size="md"
              className="w-full"
              disabled={!file || isUploading}
              onClick={handleUpload}
            >
              {isUploading ? 'Uploading…' : `Upload ${credential.label}`}
            </Button>
            {credential.clerkUserId && (
              <div className="border-t border-atria-border pt-4">
                <p className="mb-2 text-sm text-atria-text-secondary">
                  Or ask {item.employeeName ?? 'the employee'} to upload it
                  themselves:
                </p>
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full"
                  disabled={isReminding || reminderSent}
                  onClick={handleSendReminder}
                >
                  {reminderSent
                    ? 'Reminder sent ✓'
                    : isReminding
                      ? 'Sending…'
                      : 'Send reminder email'}
                </Button>
              </div>
            )}
          </>
        ) : item.linkTo ? (
          <Link to={item.linkTo} onClick={onClose}>
            <Button variant="primary" size="md" className="w-full">
              Open it in the console →
            </Button>
          </Link>
        ) : (
          <p className="text-sm text-atria-text-secondary">
            Only an admin can resolve this — share it with your agency admin.
          </p>
        )}
      </DialogContent>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

export function AuditSimpleView() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const convex = useConvex()

  const fixList = useQuery(
    api.auditReadiness.getFixList,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const [period, setPeriod] = useState<PacketPeriod>('last_3_months')
  const [downloadingPacket, setDownloadingPacket] = useState(false)
  // Search + employee/client filters, group collapse, and the fix popup.
  const [search, setSearch] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
    new Set(),
  )
  const [fixItem, setFixItem] = useState<FixListItem | null>(null)

  const fixItems = fixList?.items
  const { employeeOptions, clientOptions, groups } = useMemo(() => {
    const all = fixItems ?? []
    const employeeOptions = [
      ...new Set(
        all
          .map((item) => item.employeeName)
          .filter((name): name is string => !!name),
      ),
    ].sort()
    const clientOptions = [
      ...new Set(
        all
          .map((item) => item.clientName)
          .filter((name): name is string => !!name),
      ),
    ].sort()
    const needle = search.trim().toLowerCase()
    const visible = all.filter(
      (item) =>
        (employeeFilter === 'all' || item.employeeName === employeeFilter) &&
        (clientFilter === 'all' || item.clientName === clientFilter) &&
        (!needle ||
          [item.title, item.detail, item.employeeName, item.clientName].some(
            (field) => field?.toLowerCase().includes(needle),
          )),
    )
    // One collapsible row per employee; client-scoped and agency-wide items
    // fall back to the client name / a general bucket.
    const byGroup = new Map<string, FixListItem[]>()
    for (const item of visible) {
      const key = item.employeeName ?? item.clientName ?? 'General'
      const bucket = byGroup.get(key)
      if (bucket) bucket.push(item)
      else byGroup.set(key, [item])
    }
    return { employeeOptions, clientOptions, groups: [...byGroup.entries()] }
  }, [fixItems, search, employeeFilter, clientFilter])

  const toggleGroup = (name: string) => {
    setCollapsedGroups((previous) => {
      const next = new Set(previous)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleDownloadPacket = async () => {
    if (!clerkOrgId) return
    setDownloadingPacket(true)
    try {
      const { startDate, endDate } = packetWindow(period)
      const csv = await convex.query(api.auditPacket.exportPacketCsv, {
        clerkOrgId,
        startDate,
        endDate,
      })
      downloadCsv(`audit-packet-${startDate}-to-${endDate}.csv`, csv)
    } finally {
      setDownloadingPacket(false)
    }
  }

  if (fixList === undefined) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">Audit Ready Center</h1>
          <p className="text-base text-atria-text-secondary">
            One look at how your agency is doing.
          </p>
        </div>
        <p className="py-8 text-center text-sm text-atria-text-secondary">
          Checking your agency…
        </p>
      </div>
    )
  }

  const { status, items } = fixList
  const presentation = STATUS_PRESENTATION[status]
  const headline =
    status === 'ready'
      ? "You're audit ready."
      : status === 'almost'
        ? STATUS_PRESENTATION.almost.headline(items.length)
        : STATUS_PRESENTATION.not_ready.headline(items.length)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-atria-ink">Audit Ready Center</h1>
        <p className="text-base text-atria-text-secondary">
          One look at how your agency is doing.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <span
            aria-hidden
            className={cn('h-10 w-10 shrink-0 rounded-full', presentation.dot)}
          />
          <div>
            <p className="text-xl font-bold text-atria-ink">{headline}</p>
            <p className="text-sm text-atria-text-secondary">
              {presentation.subtext}
            </p>
          </div>
        </CardContent>
      </Card>

      {status === 'ready' ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-atria-success" />
            <p className="text-base text-atria-text-secondary">
              Credentials, incident reports, and agency paperwork are all up to
              date. We keep watching in the background — if something needs
              attention, it shows up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>What to fix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Search fixes"
                placeholder="Search fixes…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="sm:flex-1"
              />
              <Select
                aria-label="Filter by employee"
                value={employeeFilter}
                onChange={(event) => setEmployeeFilter(event.target.value)}
                className="sm:w-48"
              >
                <option value="all">All employees</option>
                {employeeOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Filter by client"
                value={clientFilter}
                onChange={(event) => setClientFilter(event.target.value)}
                className="sm:w-48"
              >
                <option value="all">All clients</option>
                {clientOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            {groups.length === 0 ? (
              <p className="py-4 text-center text-sm text-atria-text-secondary">
                No fixes match your search.
              </p>
            ) : (
              <ul className="space-y-3">
                {groups.map(([name, groupItems]) => {
                  const collapsed = collapsedGroups.has(name)
                  return (
                    <li
                      key={name}
                      className="rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface"
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(name)}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left"
                        aria-expanded={!collapsed}
                      >
                        {collapsed ? (
                          <ChevronRight className="h-4 w-4 shrink-0 text-atria-text-secondary" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 text-atria-text-secondary" />
                        )}
                        <span className="flex-1 text-sm font-semibold text-atria-ink">
                          {name}
                        </span>
                        <Badge
                          variant={
                            groupItems.some(
                              (item) => item.severity === 'critical',
                            )
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {groupItems.length}{' '}
                          {groupItems.length === 1 ? 'fix' : 'fixes'}
                        </Badge>
                      </button>
                      {!collapsed && (
                        <ul className="space-y-2 border-t border-atria-border px-4 py-3">
                          {groupItems.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-center justify-between gap-4"
                            >
                              <div>
                                <p className="text-sm font-medium text-atria-ink">
                                  {item.title}
                                </p>
                                {item.detail && (
                                  <p className="text-sm text-atria-text-secondary">
                                    {item.detail}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="primary"
                                size="sm"
                                className="shrink-0"
                                onClick={() => setFixItem(item)}
                              >
                                Fix it
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base text-atria-text-secondary">
            Need to hand everything to an auditor?
          </p>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Packet period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as PacketPeriod)}
              className="w-40"
            >
              {PACKET_PERIODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button
              variant="primary"
              size="sm"
              disabled={downloadingPacket}
              onClick={handleDownloadPacket}
            >
              <Download className="h-4 w-4" />
              {downloadingPacket ? 'Preparing…' : 'Download audit packet'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-atria-accent/40 bg-gradient-to-br from-atria-accent/10 via-atria-surface to-atria-info/10">
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
              For auditors
            </p>
            <h2 className="mt-1 text-lg font-bold text-atria-ink">
              Full audit dashboard
            </h2>
            <p className="mt-1 max-w-md text-sm text-atria-text-secondary">
              Compliance KPIs, credential gaps, incident timeliness, the
              self-inspection checklist, and every export an auditor asks for
              — all in one place.
            </p>
          </div>
          <Link to="/audit?view=full" className="shrink-0">
            <Button variant="primary" size="md">
              Open full audit dashboard →
            </Button>
          </Link>
        </CardContent>
      </Card>

      {fixItem && clerkOrgId && (
        <FixDialog
          item={fixItem}
          clerkOrgId={clerkOrgId}
          onClose={() => setFixItem(null)}
        />
      )}
    </div>
  )
}
