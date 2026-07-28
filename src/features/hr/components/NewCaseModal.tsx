import { useState } from 'react'
import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'
import { Select } from '@/shared/ui/Select'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'

const CASE_KINDS = [
  { value: 'discrepancy', label: 'Discrepancy' },
  { value: 'dispute', label: 'Dispute' },
  { value: 'onboarding_issue', label: 'Onboarding issue' },
  { value: 'credentialing', label: 'Credentialing' },
  { value: 'other', label: 'Other' },
]

export function NewCaseModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}) {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const createHrCase = useMutation(api.hrCases.createHrCase)
  const employees = useQuery(
    api.employeeProfiles.listEmployeeProfiles,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const candidates = useQuery(
    api.candidates.listCandidates,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState('discrepancy')
  const [subject, setSubject] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setTitle('')
    setDescription('')
    setKind('discrepancy')
    setSubject('')
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!clerkOrgId || !subject) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const [subjectType, subjectId] = subject.split(':')
    if (!subjectType || !subjectId) return

    setSubmitting(true)
    setError(null)

    try {
      await createHrCase({
        clerkOrgId,
        subjectType,
        subjectId,
        category: kind,
        title: trimmedTitle,
        description: description.trim() || undefined,
      })
      reset()
      onCreated?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? sanitizeConvexError(err.message) : 'Failed to create case.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader>
        <DialogTitle>New HR case</DialogTitle>
      </DialogHeader>
      <DialogContent className="space-y-4">
        {error && <p className="text-sm text-atria-danger">{error}</p>}
        <FieldGroup label="Subject" required htmlFor="case-subject">
          <Select
            id="case-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="" disabled>
              Select subject
            </option>
            <optgroup label="Employees">
              {employees?.map((employee) =>
                employee.clerkUserId ? (
                  <option
                    key={`employee:${employee.clerkUserId}`}
                    value={`employee:${employee.clerkUserId}`}
                  >
                    {employee.displayName}
                  </option>
                ) : null,
              )}
            </optgroup>
            <optgroup label="Candidates">
              {candidates?.map((candidate) => (
                <option
                  key={`candidate:${candidate._id}`}
                  value={`candidate:${candidate._id}`}
                >
                  {candidate.displayName}
                </option>
              ))}
            </optgroup>
          </Select>
        </FieldGroup>
        <FieldGroup label="Kind" required htmlFor="case-kind">
          <Select
            id="case-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {CASE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="Title" required htmlFor="case-title">
          <Input
            id="case-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short summary"
          />
        </FieldGroup>
        <FieldGroup label="Description" htmlFor="case-description">
          <Textarea
            id="case-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details about the case…"
          />
        </FieldGroup>
      </DialogContent>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={submitting || !title.trim() || !subject}
          onClick={handleSubmit}
        >
          {submitting ? 'Creating…' : 'Create case'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
