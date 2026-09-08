import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { ChevronDown, LifeBuoy } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { useTenant } from '@/app/useTenant'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/ui/StatusBadge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { Textarea } from '@/shared/ui/Textarea'
import { formatDateUS, formatStatusLabel } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { cn } from '@/shared/lib/cn'
import { faqEntries } from './faqData'

const TICKET_CATEGORIES = [
  'billing',
  'technical',
  'account',
  'feature',
  'other',
] as const

const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const

type TicketCategory = (typeof TICKET_CATEGORIES)[number]
type TicketPriority = (typeof TICKET_PRIORITIES)[number]

const statusVariant: Record<string, StatusBadgeVariant> = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
}

export function SupportPage() {
  // useTenant keeps the resolved org id across transient Clerk token-refresh
  // flaps (localStorage fallback) so the ticket list never flashes a loader.
  const { clerkOrgId } = useTenant()

  const tickets = useQuery(
    api.supportTickets.listMine,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const createTicket = useMutation(api.supportTickets.create)

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TicketCategory>('technical')
  const [priority, setPriority] = useState<TicketPriority>('normal')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openDialog = () => {
    setSubject('')
    setDescription('')
    setCategory('technical')
    setPriority('normal')
    setError(null)
    setDialogOpen(true)
  }

  const handleCreate = async () => {
    if (!clerkOrgId || !subject.trim() || !description.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      await createTicket({
        clerkOrgId,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
      })
      setDialogOpen(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to create support ticket.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">Support</h1>
          <p className="text-base text-atria-text-secondary">
            Answers to common questions and help from the ATRIA-X team.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openDialog}>
          New ticket
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-atria-accent" />
            Frequently asked questions
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-atria-border p-0">
          {faqEntries.map((entry, index) => {
            const isOpen = openFaqIndex === index
            return (
              <div key={entry.question}>
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium text-atria-ink">
                    {entry.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-atria-text-secondary transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                {isOpen && (
                  <p className="px-6 pb-4 text-sm text-atria-text-secondary">
                    {entry.answer}
                  </p>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Support tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {tickets === undefined ? (
            <p className="py-8 text-center text-sm text-atria-muted">
              Loading tickets…
            </p>
          ) : tickets.length === 0 ? (
            <EmptyState
              title="No support tickets"
              description="Open a ticket and the platform team will get back to you."
              action={
                <Button variant="primary" size="sm" onClick={openDialog}>
                  New ticket
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Subject</TableHeader>
                  <TableHeader>Category</TableHeader>
                  <TableHeader>Priority</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Created</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket._id}>
                    <TableCell className="font-medium">
                      {ticket.subject}
                    </TableCell>
                    <TableCell>{formatStatusLabel(ticket.category)}</TableCell>
                    <TableCell>{formatStatusLabel(ticket.priority)}</TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={statusVariant[ticket.status] ?? 'neutral'}
                      >
                        {formatStatusLabel(ticket.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{formatDateUS(ticket.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>New support ticket</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
              Subject
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the issue"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What happened, and what did you expect?"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-atria-muted">
              Please do not include client PHI in tickets.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Category
              </label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="mt-1"
              >
                {TICKET_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {formatStatusLabel(value)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Priority
              </label>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="mt-1"
              >
                {TICKET_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {formatStatusLabel(value)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-atria-danger">{error}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={isSubmitting || !subject.trim() || !description.trim()}
          >
            {isSubmitting ? 'Submitting…' : 'Submit ticket'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
