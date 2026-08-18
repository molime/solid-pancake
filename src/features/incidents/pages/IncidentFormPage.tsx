import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useTenant } from '@/app/useTenant'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'
import { Checkbox } from '@/shared/ui/Checkbox'
import { USDateInput } from '@/shared/ui/USDateInput'
import {
  formatAgencyNotifiedLabel,
  formatIncidentCategoryLabel,
} from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'

const INCIDENT_CATEGORIES = [
  'death',
  'serious_injury',
  'hospitalization',
  'emergency_room_visit',
  'medication_error',
  'suspected_abuse',
  'suspected_exploitation',
  'suspected_neglect',
  'victim_of_crime',
  'missing_person',
  'unauthorized_absence',
  'aggressive_act',
  'rights_violation',
  'other',
] as const

type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number]

const AGENCIES_NOTIFIED = [
  'aps',
  'cps',
  'ccl',
  'law_enforcement',
  'ombudsman',
  'dph',
  'other',
] as const

type AgencyNotified = (typeof AGENCIES_NOTIFIED)[number]

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
        {label}
        {required ? ' *' : ''}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function combineDateTime(date: string, time: string): string {
  if (!date || !time) return ''
  const parsed = new Date(`${date}T${time}`)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString()
}

export function IncidentFormPage() {
  // useTenant (not useOrganization): caregivers hold no Clerk org membership,
  // so their clerkOrgId resolves from the tenantMembers table instead.
  const { clerkOrgId } = useTenant()
  const navigate = useNavigate()

  const member = useQuery(api.members.me, clerkOrgId ? { clerkOrgId } : 'skip')
  const clientOptions = useQuery(
    api.incidents.listIncidentClientOptions,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const createIncident = useMutation(api.incidents.createIncident)

  const [clientId, setClientId] = useState('')
  const [category, setCategory] = useState<'' | IncidentCategory>('')
  const [occurredDate, setOccurredDate] = useState('')
  const [occurredTime, setOccurredTime] = useState('')
  const [learnedDate, setLearnedDate] = useState('')
  const [learnedTime, setLearnedTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [treatmentProvided, setTreatmentProvided] = useState('')
  const [witnesses, setWitnesses] = useState('')
  const [allegedPerpetrator, setAllegedPerpetrator] = useState('')
  const [actionsTaken, setActionsTaken] = useState('')
  const [agenciesNotified, setAgenciesNotified] = useState<AgencyNotified[]>([])
  const [familyWho, setFamilyWho] = useState('')
  const [familyDate, setFamilyDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleAgency = (agency: AgencyNotified) => {
    setAgenciesNotified((current) =>
      current.includes(agency)
        ? current.filter((item) => item !== agency)
        : [...current, agency],
    )
  }

  const occurredAt = combineDateTime(occurredDate, occurredTime)
  const learnedAt = combineDateTime(learnedDate, learnedTime)

  const isValid =
    Boolean(clientId) &&
    Boolean(category) &&
    Boolean(occurredAt) &&
    Boolean(learnedAt) &&
    Boolean(location.trim()) &&
    Boolean(description.trim()) &&
    Boolean(actionsTaken.trim())

  const handleSubmit = async () => {
    if (!clerkOrgId || !isValid || !category) return
    setError(null)
    setMessage(null)
    setIsSubmitting(true)
    try {
      const incidentId = await createIncident({
        clerkOrgId,
        clientId: clientId as Id<'clients'>,
        category,
        occurredAt,
        learnedAt,
        location: location.trim(),
        description: description.trim(),
        ...(treatmentProvided.trim()
          ? { treatmentProvided: treatmentProvided.trim() }
          : {}),
        ...(witnesses.trim() ? { witnesses: witnesses.trim() } : {}),
        ...(allegedPerpetrator.trim()
          ? { allegedPerpetrator: allegedPerpetrator.trim() }
          : {}),
        actionsTaken: actionsTaken.trim(),
        agenciesNotified,
        ...(familyWho.trim() && familyDate
          ? {
              familyContacted: {
                who: familyWho.trim(),
                at: new Date(`${familyDate}T00:00:00`).toISOString(),
              },
            }
          : {}),
      })

      if (member?.role === 'org:caregiver') {
        setMessage(
          'Incident filed. Your coordinator has access to the report and will handle the regional center deadlines.',
        )
        setClientId('')
        setCategory('')
        setOccurredDate('')
        setOccurredTime('')
        setLearnedDate('')
        setLearnedTime('')
        setLocation('')
        setDescription('')
        setTreatmentProvided('')
        setWitnesses('')
        setAllegedPerpetrator('')
        setActionsTaken('')
        setAgenciesNotified([])
        setFamilyWho('')
        setFamilyDate('')
      } else {
        navigate(`/incidents/${incidentId}`)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Could not file the incident.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-atria-ink">
          File a special incident report
        </h1>
        <p className="text-base text-atria-text-secondary">
          17 CCR §54327 — the regional center must be notified verbally within
          24 hours and in writing within 48 hours of learning of the incident.
        </p>
      </div>

      {message && (
        <div className="rounded-md border border-atria-success/20 bg-atria-success-bg px-4 py-3 text-sm text-atria-success">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-atria-danger/20 bg-atria-danger-bg px-4 py-3 text-sm text-atria-danger">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Incident details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client" required>
              <Select
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
              >
                <option value="">Select a client</option>
                {(clientOptions ?? []).map((client) => (
                  <option key={client.clientId} value={client.clientId}>
                    {client.displayName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category" required>
              <Select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as IncidentCategory)
                }
              >
                <option value="">Select a category</option>
                {INCIDENT_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {formatIncidentCategoryLabel(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date of incident" required>
              <USDateInput value={occurredDate} onChange={setOccurredDate} />
            </Field>
            <Field label="Time of incident" required>
              <Input
                type="time"
                value={occurredTime}
                onChange={(event) => setOccurredTime(event.target.value)}
              />
            </Field>
            <Field label="Date learned" required>
              <USDateInput value={learnedDate} onChange={setLearnedDate} />
            </Field>
            <Field label="Time learned" required>
              <Input
                type="time"
                value={learnedTime}
                onChange={(event) => setLearnedTime(event.target.value)}
              />
            </Field>
            <Field label="Location" required>
              <Input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Where the incident occurred"
              />
            </Field>
            <Field label="Witnesses">
              <Input
                value={witnesses}
                onChange={(event) => setWitnesses(event.target.value)}
                placeholder="Names of witnesses, if any"
              />
            </Field>
          </div>
          <Field label="Description of the incident" required>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What happened, in factual detail"
              rows={4}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Treatment provided">
              <Textarea
                value={treatmentProvided}
                onChange={(event) => setTreatmentProvided(event.target.value)}
                placeholder="First aid, medical care, etc."
                rows={3}
              />
            </Field>
            <Field label="Actions taken" required>
              <Textarea
                value={actionsTaken}
                onChange={(event) => setActionsTaken(event.target.value)}
                placeholder="Immediate actions taken by staff"
                rows={3}
              />
            </Field>
          </div>
          <Field label="Alleged perpetrator">
            <Input
              value={allegedPerpetrator}
              onChange={(event) => setAllegedPerpetrator(event.target.value)}
              placeholder="Description of alleged perpetrator, if applicable"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Agencies notified">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {AGENCIES_NOTIFIED.map((agency) => (
                <label
                  key={agency}
                  className="flex items-center gap-2 text-sm text-atria-ink"
                >
                  <Checkbox
                    checked={agenciesNotified.includes(agency)}
                    onChange={() => toggleAgency(agency)}
                  />
                  {formatAgencyNotifiedLabel(agency)}
                </label>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Family / authorized representative contacted">
              <Input
                value={familyWho}
                onChange={(event) => setFamilyWho(event.target.value)}
                placeholder="Who was contacted"
              />
            </Field>
            <Field label="Contact date">
              <USDateInput value={familyDate} onChange={setFamilyDate} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!isValid || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? 'Filing…' : 'File incident'}
        </Button>
      </div>
    </div>
  )
}
