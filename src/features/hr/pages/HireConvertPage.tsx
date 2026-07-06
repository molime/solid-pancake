import { useOrganization } from '@clerk/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { HrToast } from '../components/HrToast'
import { useHrToast } from '../hooks/useHrToast'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import type { Id } from '../../../../convex/_generated/dataModel'

function ApplicationField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
        {label}
      </p>
      <p className="mt-1 text-base text-atria-ink">{value || '—'}</p>
    </div>
  )
}

export function HireConvertPage() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const { organization } = useOrganization()
  const navigate = useNavigate()
  const clerkOrgId = organization?.id

  const detail = useQuery(
    api.candidates.getCandidateDetail,
    clerkOrgId && candidateId
      ? { clerkOrgId, candidateId: candidateId as Id<'candidates'> }
      : 'skip',
  )
  const caregivers = useQuery(
    api.members.listCaregivers,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const hireCandidate = useMutation(api.candidates.hireCandidate)

  const [startDate, setStartDate] = useState('')
  const [payRate, setPayRate] = useState('')
  const [supervisor, setSupervisor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast, show, hide } = useHrToast()

  const candidate = detail?.candidate
  const application = detail?.applications?.[0]
  const fields = (application?.fields ?? {}) as Record<string, string>

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-text-secondary">Loading candidate…</div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-danger">Candidate not found.</div>
      </div>
    )
  }

  const handleHire = async () => {
    if (!clerkOrgId || !candidateId) return
    setSubmitting(true)
    setError(null)

    try {
      await hireCandidate({
        clerkOrgId,
        candidateId: candidateId as Id<'candidates'>,
        startDate: startDate || undefined,
        payRate: payRate || undefined,
        supervisor: supervisor || undefined,
      })
      show(
        'success',
        'Candidate hired successfully',
        'They are now an active caregiver.',
      )
      navigate('/hr/employees')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Hire failed.'
      setError(message)
      show('danger', 'Could not hire candidate', message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/hr/candidates"
        className="inline-flex items-center gap-1 text-sm font-medium text-atria-accent hover:text-atria-accent-hover"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Candidate Pipeline
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-atria-ink">
          Convert to Employee — {candidate.displayName}
        </h1>
        <p className="text-base text-atria-text-secondary">
          Offer accepted · {fields.position || 'Caregiver'} · Application #
          {candidateId?.slice(-6).toUpperCase()}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Candidate profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ApplicationField label="FULL NAME" value={candidate.displayName} />
              <ApplicationField label="EMAIL" value={candidate.email} />
              <ApplicationField label="PHONE" value={candidate.phone || ''} />
              <ApplicationField
                label="APPLIED FOR"
                value={fields.position || 'Caregiver'}
              />
              <ApplicationField
                label="EXPERIENCE"
                value={fields.yearsExperience || fields.experience || ''}
              />
              <ApplicationField
                label="RECRUITER"
                value={fields.recruiter || ''}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New employee record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {error && <p className="text-sm text-atria-danger">{error}</p>}

            <div className="rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-bg p-4">
              <p className="text-sm font-medium text-atria-ink">Conversion target</p>
              <p className="text-base font-semibold text-atria-accent">Caregiver</p>
            </div>

            <p className="text-sm text-atria-text-secondary">
              Worker will be registered in ADP when credentials are configured.
            </p>

            <FieldGroup label="Start date" htmlFor="start-date">
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FieldGroup>

            <FieldGroup label="Pay rate" htmlFor="pay-rate">
              <Input
                id="pay-rate"
                type="text"
                value={payRate}
                onChange={(e) => setPayRate(e.target.value)}
                placeholder="e.g. $22.00/hr"
              />
            </FieldGroup>

            <FieldGroup label="Supervisor" htmlFor="supervisor">
              <Select
                id="supervisor"
                value={supervisor}
                onChange={(e) => setSupervisor(e.target.value)}
              >
                <option value="">Select supervisor</option>
                {caregivers?.map((cg) => (
                  <option key={cg.clerkUserId} value={cg.clerkUserId}>
                    {cg.displayName}
                  </option>
                ))}
              </Select>
            </FieldGroup>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={submitting}
              onClick={handleHire}
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitting ? 'Hiring…' : 'Confirm & hire'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <HrToast toast={toast} onClose={hide} />
    </div>
  )
}
