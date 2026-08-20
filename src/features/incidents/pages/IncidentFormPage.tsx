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
import { ProgressSteps } from '@/shared/ui/ProgressSteps'
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

// One question per screen (docs/design-audit-simplification.md, stage 3).
// Same fields, same mutation, same validation as the previous single form —
// only the presentation changed.
const STEPS = [
  { id: 'who', label: 'Who' },
  { id: 'what', label: 'What happened' },
  { id: 'when', label: 'When' },
  { id: 'hurt', label: 'Anyone hurt' },
  { id: 'done', label: 'What was done' },
  { id: 'called', label: 'Who you called' },
  { id: 'review', label: 'Review' },
] as const

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

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

/** Local date/time pair for the USDateInput + time inputs. */
function nowDateTime() {
  const now = new Date()
  return {
    date: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
    time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
  }
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-atria-muted">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-atria-ink">
        {value?.trim() ? value : '—'}
      </p>
    </div>
  )
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

  const [step, setStep] = useState(0)
  const [clientId, setClientId] = useState('')
  const [category, setCategory] = useState<'' | IncidentCategory>('')
  const [occurredDate, setOccurredDate] = useState('')
  const [occurredTime, setOccurredTime] = useState('')
  // "When did you find out?" is prefilled to now — most reporters are filing
  // as they learn, and this starts the 24h/48h clocks immediately.
  const [learnedDate, setLearnedDate] = useState(() => nowDateTime().date)
  const [learnedTime, setLearnedTime] = useState(() => nowDateTime().time)
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

  // Per-step gating: each screen owns its required fields; the final submit
  // still runs the full validity check below.
  const stepReady: boolean[] = [
    Boolean(clientId) && Boolean(category),
    Boolean(description.trim()) && Boolean(location.trim()),
    Boolean(occurredAt) && Boolean(learnedAt),
    true,
    Boolean(actionsTaken.trim()),
    true,
    true,
  ]

  const isValid =
    Boolean(clientId) &&
    Boolean(category) &&
    Boolean(occurredAt) &&
    Boolean(learnedAt) &&
    Boolean(location.trim()) &&
    Boolean(description.trim()) &&
    Boolean(actionsTaken.trim())

  const resetForm = () => {
    const now = nowDateTime()
    setStep(0)
    setClientId('')
    setCategory('')
    setOccurredDate('')
    setOccurredTime('')
    setLearnedDate(now.date)
    setLearnedTime(now.time)
    setLocation('')
    setDescription('')
    setTreatmentProvided('')
    setWitnesses('')
    setAllegedPerpetrator('')
    setActionsTaken('')
    setAgenciesNotified([])
    setFamilyWho('')
    setFamilyDate('')
  }

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
        resetForm()
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

  const isLastStep = step === STEPS.length - 1
  const clientName = (clientOptions ?? []).find(
    (client) => client.clientId === clientId,
  )?.displayName

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-atria-ink">
          Report something that went wrong
        </h1>
        <p className="text-base text-atria-text-secondary">
          One question at a time — we&apos;ll guide you through it.
        </p>
      </div>

      <ProgressSteps steps={[...STEPS]} currentStep={step} />

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
          <CardTitle>{STEPS[step].label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <Field label="Who was involved?" required>
                <Select
                  aria-label="Who was involved?"
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
              <Field label="What kind of incident?" required>
                <Select
                  aria-label="What kind of incident?"
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
            </>
          )}

          {step === 1 && (
            <>
              <Field label="What happened?" required>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Tell us what happened, in your own words"
                  rows={4}
                />
              </Field>
              <Field label="Where did it happen?" required>
                <Input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Where the incident occurred"
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Date you found out" required>
                  <USDateInput value={learnedDate} onChange={setLearnedDate} />
                </Field>
                <Field label="Time you found out" required>
                  <Input
                    type="time"
                    value={learnedTime}
                    onChange={(event) => setLearnedTime(event.target.value)}
                  />
                </Field>
              </div>
              <p className="text-sm text-atria-text-secondary">
                We filled in &quot;found out&quot; with right now — change it if
                you learned about the incident earlier.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Was anyone hurt? What care was given?">
                <Textarea
                  value={treatmentProvided}
                  onChange={(event) => setTreatmentProvided(event.target.value)}
                  placeholder="First aid, medical care, hospital visit — or leave blank"
                  rows={3}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Did anyone see it?">
                  <Input
                    value={witnesses}
                    onChange={(event) => setWitnesses(event.target.value)}
                    placeholder="Names of witnesses, if any"
                  />
                </Field>
                <Field label="Who may have caused it?">
                  <Input
                    value={allegedPerpetrator}
                    onChange={(event) =>
                      setAllegedPerpetrator(event.target.value)
                    }
                    placeholder="Description of alleged perpetrator, if applicable"
                  />
                </Field>
              </div>
            </>
          )}

          {step === 4 && (
            <Field label="What was done right away?" required>
              <Textarea
                value={actionsTaken}
                onChange={(event) => setActionsTaken(event.target.value)}
                placeholder="Immediate actions taken by staff"
                rows={3}
              />
            </Field>
          )}

          {step === 5 && (
            <>
              <Field label="Who did you call?">
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
            </>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SummaryRow label="Who was involved?" value={clientName} />
                <SummaryRow
                  label="What kind of incident?"
                  value={category ? formatIncidentCategoryLabel(category) : ''}
                />
                <SummaryRow
                  label="When did it happen?"
                  value={
                    occurredDate && occurredTime
                      ? `${occurredDate} at ${occurredTime}`
                      : ''
                  }
                />
                <SummaryRow
                  label="When did you find out?"
                  value={
                    learnedDate && learnedTime
                      ? `${learnedDate} at ${learnedTime}`
                      : ''
                  }
                />
                <SummaryRow label="Where?" value={location} />
                <SummaryRow label="Witnesses" value={witnesses} />
              </div>
              <SummaryRow label="What happened?" value={description} />
              <SummaryRow label="Care given" value={treatmentProvided} />
              <SummaryRow label="What was done right away?" value={actionsTaken} />
              <SummaryRow
                label="Who did you call?"
                value={
                  agenciesNotified.length > 0
                    ? agenciesNotified.map(formatAgencyNotifiedLabel).join(', ')
                    : ''
                }
              />
              <SummaryRow
                label="Family / representative contacted"
                value={
                  familyWho
                    ? `${familyWho}${familyDate ? ` (${familyDate})` : ''}`
                    : ''
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {isLastStep ? (
          <Button
            variant="primary"
            disabled={!isValid || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Filing…' : 'File incident'}
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={!stepReady[step]}
            onClick={() => setStep(step + 1)}
          >
            Next
          </Button>
        )}
      </div>
    </div>
  )
}
