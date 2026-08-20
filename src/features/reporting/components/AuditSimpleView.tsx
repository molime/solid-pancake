import { useOrganization } from '@clerk/react'
import { useConvex, useQuery } from 'convex/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { downloadCsv } from '@/shared/lib/downloadCsv'
import { cn } from '@/shared/lib/cn'
import { CheckCircle2, Download } from 'lucide-react'

// The simple /audit view (docs/design-audit-simplification.md, stages 2+4):
// one traffic light, one plain-language fix list, one export button. Every
// number comes from auditReadiness.getFixList, which derives from the same
// backend computations as the full view — never a parallel data path.

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

export function AuditSimpleView() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const convex = useConvex()

  const fixList = useQuery(
    api.auditReadiness.getFixList,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const member = useQuery(api.members.me, clerkOrgId ? { clerkOrgId } : 'skip')

  const [period, setPeriod] = useState<PacketPeriod>('last_3_months')
  const [downloadingPacket, setDownloadingPacket] = useState(false)

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
          <h1 className="text-2xl font-bold text-atria-ink">Audit readiness</h1>
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
        <h1 className="text-2xl font-bold text-atria-ink">Audit readiness</h1>
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
          <CardContent>
            <ol className="space-y-3">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-atria-surface-2 text-xs font-semibold text-atria-text-secondary"
                    >
                      {index + 1}
                    </span>
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
                  </div>
                  {item.linkTo && (
                    <Link to={item.linkTo} className="shrink-0">
                      <Button variant="primary" size="sm">
                        Fix it
                      </Button>
                    </Link>
                  )}
                </li>
              ))}
            </ol>
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

      <div className="rounded-[var(--radius-atria-lg)] border border-dashed border-atria-border px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-atria-muted">
          For auditors / Details
        </p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <Link
            to="/audit?view=full"
            className="text-sm font-medium text-atria-accent hover:underline"
          >
            Full details, tables &amp; exports →
          </Link>
          {member?.role === 'org:admin' && (
            <Link
              to="/logs"
              className="text-sm font-medium text-atria-accent hover:underline"
            >
              Audit trail (every recorded action) →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
