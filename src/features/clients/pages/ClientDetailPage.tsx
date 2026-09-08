import { useOrganization } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Badge } from '@/shared/ui/Badge'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import type { StatusBadgeVariant } from '@/shared/ui/StatusBadge'
import { USDateInput } from '@/shared/ui/USDateInput'
import { EmptyState } from '@/shared/ui/EmptyState'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from '@/shared/ui/Dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { formatDateUS, formatStatusLabel } from '@/shared/format'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { ClientProgressReports } from '@/features/reporting/components/ClientProgressReports'
import { GrievancesSection } from '@/features/clients/components/GrievancesSection'
import { ChevronLeft, Target } from 'lucide-react'

type Client = Doc<'clients'>
type Objective = Doc<'clientObjectives'>
type EmergencyContact = { name: string; phone: string; relationship: string }

const OBJECTIVE_STATUS_VARIANTS: Record<Objective['status'], StatusBadgeVariant> =
  {
    active: 'info',
    achieved: 'success',
    discontinued: 'neutral',
  }

function formatHoursValue(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(2)
}

function ProfileField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-atria-muted">
        {label}
      </p>
      <p className="mt-1 text-sm text-atria-ink">
        {value?.trim() ? value : '—'}
      </p>
    </div>
  )
}

type ProfileFormState = {
  uci: string
  dob: string
  conservatorName: string
  conservatorPhone: string
  regionalCenter: string
  serviceCoordinatorName: string
  serviceCoordinatorEmail: string
  vendorNumber: string
  serviceCode: string
  emergencyContacts: EmergencyContact[]
}

function profileFormFromClient(client: Client): ProfileFormState {
  return {
    uci: client.uci ?? '',
    dob: client.dob ?? '',
    conservatorName: client.conservatorName ?? '',
    conservatorPhone: client.conservatorPhone ?? '',
    regionalCenter: client.regionalCenter ?? '',
    serviceCoordinatorName: client.serviceCoordinatorName ?? '',
    serviceCoordinatorEmail: client.serviceCoordinatorEmail ?? '',
    vendorNumber: client.vendorNumber ?? '',
    serviceCode: client.serviceCode ?? '',
    emergencyContacts: client.emergencyContacts ?? [],
  }
}

export function ClientDetailPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id
  const { clientId } = useParams<{ clientId: string }>()
  const typedClientId = clientId as Id<'clients'> | undefined

  const client = useQuery(
    api.clients.get,
    clerkOrgId && typedClientId
      ? { clerkOrgId, clientId: typedClientId }
      : 'skip',
  )
  const objectives = useQuery(
    api.clientObjectives.listByClient,
    clerkOrgId && typedClientId
      ? { clerkOrgId, clientId: typedClientId }
      : 'skip',
  )
  const usage = useQuery(
    api.clients.getMonthlyUsage,
    clerkOrgId && typedClientId
      ? { clerkOrgId, clientId: typedClientId }
      : 'skip',
  )

  const updateProfile = useMutation(api.clients.updateProfile)
  const createObjective = useMutation(api.clientObjectives.create)
  const updateObjective = useMutation(api.clientObjectives.update)
  const discontinueObjective = useMutation(api.clientObjectives.discontinue)

  const [profileOpen, setProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [objectiveOpen, setObjectiveOpen] = useState(false)
  const [objectiveForm, setObjectiveForm] = useState({
    title: '',
    source: 'ipp' as 'ipp' | 'isp',
    description: '',
    targetDate: '',
    hoursPerMonth: '',
  })
  const [objectiveError, setObjectiveError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (!client || !objectives || !usage) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-muted">Loading client…</div>
      </div>
    )
  }

  const openProfile = () => {
    setProfileForm(profileFormFromClient(client))
    setProfileError(null)
    setProfileOpen(true)
  }

  const handleSaveProfile = async () => {
    if (!clerkOrgId || !profileForm) return
    setProfileError(null)
    try {
      await updateProfile({
        clerkOrgId,
        clientId: client._id,
        uci: profileForm.uci.trim(),
        // dob is only sent when set — the backend validates ISO format and an
        // empty string would fail validation.
        ...(profileForm.dob ? { dob: profileForm.dob } : {}),
        conservatorName: profileForm.conservatorName.trim(),
        conservatorPhone: profileForm.conservatorPhone.trim(),
        regionalCenter: profileForm.regionalCenter.trim(),
        serviceCoordinatorName: profileForm.serviceCoordinatorName.trim(),
        serviceCoordinatorEmail: profileForm.serviceCoordinatorEmail.trim(),
        vendorNumber: profileForm.vendorNumber.trim(),
        serviceCode: profileForm.serviceCode.trim(),
        emergencyContacts: profileForm.emergencyContacts,
      })
      setProfileOpen(false)
      setProfileForm(null)
    } catch (err) {
      setProfileError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to save profile.',
      )
    }
  }

  const handleAddObjective = async () => {
    if (!clerkOrgId) return
    setObjectiveError(null)
    try {
      await createObjective({
        clerkOrgId,
        clientId: client._id,
        title: objectiveForm.title,
        source: objectiveForm.source,
        description: objectiveForm.description.trim() || undefined,
        targetDate: objectiveForm.targetDate || undefined,
        hoursPerMonth: objectiveForm.hoursPerMonth
          ? Number(objectiveForm.hoursPerMonth)
          : undefined,
      })
      setObjectiveForm({
        title: '',
        source: 'ipp',
        description: '',
        targetDate: '',
        hoursPerMonth: '',
      })
      setObjectiveOpen(false)
    } catch (err) {
      setObjectiveError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to add objective.',
      )
    }
  }

  const handleStatusChange = async (
    objective: Objective,
    action: 'achieved' | 'discontinued',
  ) => {
    if (!clerkOrgId) return
    setActionError(null)
    try {
      if (action === 'achieved') {
        await updateObjective({
          clerkOrgId,
          objectiveId: objective._id,
          status: 'achieved',
        })
      } else {
        await discontinueObjective({
          clerkOrgId,
          objectiveId: objective._id,
        })
      }
    } catch (err) {
      setActionError(
        err instanceof Error
          ? sanitizeConvexError(err.message)
          : 'Failed to update objective.',
      )
    }
  }

  const updateContact = (
    index: number,
    patch: Partial<EmergencyContact>,
  ) => {
    setProfileForm((form) =>
      form
        ? {
            ...form,
            emergencyContacts: form.emergencyContacts.map((contact, i) =>
              i === index ? { ...contact, ...patch } : contact,
            ),
          }
        : form,
    )
  }

  const overAuthorized = usage.deliveredHours > usage.authorizedHours

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/clients"
          className="inline-flex items-center gap-1 text-sm text-atria-muted hover:text-atria-ink"
        >
          <ChevronLeft className="h-4 w-4" />
          Clients
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-atria-ink">
            {client.displayName}
          </h1>
          <Badge variant="default">{client.serviceType}</Badge>
          {client.riskFlags.map((flag) => (
            <Badge key={flag} variant="warning">
              {flag}
            </Badge>
          ))}
        </div>
        <p
          className={`mt-1 text-sm ${overAuthorized ? 'text-atria-danger font-medium' : 'text-atria-muted'}`}
          data-testid="hours-usage"
        >
          Authorized hours this month: {formatHoursValue(usage.deliveredHours)}{' '}
          of {formatHoursValue(usage.authorizedHours)}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile details</CardTitle>
          <Button variant="secondary" size="sm" onClick={openProfile}>
            Edit profile
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileField label="UCI" value={client.uci} />
            <ProfileField label="Date of birth" value={formatDateUS(client.dob)} />
            <ProfileField label="Service code" value={client.serviceCode} />
            <ProfileField label="Vendor number" value={client.vendorNumber} />
            <ProfileField label="Regional center" value={client.regionalCenter} />
            <ProfileField
              label="Service coordinator"
              value={client.serviceCoordinatorName}
            />
            <ProfileField
              label="Coordinator email"
              value={client.serviceCoordinatorEmail}
            />
            <ProfileField
              label="Conservator / authorized rep"
              value={client.conservatorName}
            />
            <ProfileField
              label="Conservator phone"
              value={client.conservatorPhone}
            />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-atria-muted">
              Emergency contacts
            </p>
            {client.emergencyContacts && client.emergencyContacts.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {client.emergencyContacts.map((contact, index) => (
                  <li key={index} className="text-sm text-atria-ink">
                    {contact.name} · {contact.phone}
                    {contact.relationship ? ` · ${contact.relationship}` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-atria-ink">—</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>IPP/ISP objectives</CardTitle>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setObjectiveError(null)
              setObjectiveOpen(true)
            }}
          >
            Add objective
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {actionError && (
            <p className="px-6 pt-4 text-sm text-atria-danger">{actionError}</p>
          )}
          {objectives.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Target className="h-6 w-6" />}
                title="No objectives yet"
                description="Add IPP/ISP objectives so caregivers can tag shift documentation to them."
              />
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Objective</TableHeader>
                  <TableHeader>Source</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Target date</TableHeader>
                  <TableHeader>Hrs/mo</TableHeader>
                  <TableHeader className="w-40">Action</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {objectives.map((objective) => (
                  <TableRow key={objective._id}>
                    <TableCell className="font-medium">
                      <div>{objective.title}</div>
                      {objective.description && (
                        <div className="text-xs font-normal text-atria-muted">
                          {objective.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        {objective.source.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={OBJECTIVE_STATUS_VARIANTS[objective.status]}
                      >
                        {formatStatusLabel(objective.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {objective.targetDate
                        ? formatDateUS(objective.targetDate)
                        : '—'}
                    </TableCell>
                    <TableCell>{objective.hoursPerMonth ?? '—'}</TableCell>
                    <TableCell>
                      {objective.status === 'active' && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleStatusChange(objective, 'achieved')
                            }
                          >
                            Achieve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleStatusChange(objective, 'discontinued')
                            }
                          >
                            Discontinue
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {clerkOrgId && (
        <ClientProgressReports
          clerkOrgId={clerkOrgId}
          clientId={client._id}
          serviceType={client.serviceType}
          serviceCoordinatorEmail={client.serviceCoordinatorEmail}
        />
      )}

      {clerkOrgId && (
        <GrievancesSection clerkOrgId={clerkOrgId} clientId={client._id} />
      )}

      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)}>
        <DialogHeader>
          <DialogTitle>Edit profile details</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          {profileError && (
            <p className="text-sm text-atria-danger">{profileError}</p>
          )}
          {profileForm && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                    UCI
                  </label>
                  <Input
                    value={profileForm.uci}
                    onChange={(e) =>
                      setProfileForm((f) => f && { ...f, uci: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                    Date of birth
                  </label>
                  <USDateInput
                    value={profileForm.dob}
                    onChange={(iso) =>
                      setProfileForm((f) => f && { ...f, dob: iso })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                    Conservator / authorized rep
                  </label>
                  <Input
                    value={profileForm.conservatorName}
                    onChange={(e) =>
                      setProfileForm(
                        (f) => f && { ...f, conservatorName: e.target.value },
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                    Conservator phone
                  </label>
                  <Input
                    value={profileForm.conservatorPhone}
                    onChange={(e) =>
                      setProfileForm(
                        (f) => f && { ...f, conservatorPhone: e.target.value },
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                    Regional center
                  </label>
                  <Input
                    value={profileForm.regionalCenter}
                    onChange={(e) =>
                      setProfileForm(
                        (f) => f && { ...f, regionalCenter: e.target.value },
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                    Service coordinator
                  </label>
                  <Input
                    value={profileForm.serviceCoordinatorName}
                    onChange={(e) =>
                      setProfileForm(
                        (f) => f && {
                          ...f,
                          serviceCoordinatorName: e.target.value,
                        },
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                    Coordinator email
                  </label>
                  <Input
                    type="email"
                    value={profileForm.serviceCoordinatorEmail}
                    onChange={(e) =>
                      setProfileForm(
                        (f) => f && {
                          ...f,
                          serviceCoordinatorEmail: e.target.value,
                        },
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                    Vendor number
                  </label>
                  <Input
                    value={profileForm.vendorNumber}
                    onChange={(e) =>
                      setProfileForm(
                        (f) => f && { ...f, vendorNumber: e.target.value },
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                    Service code
                  </label>
                  <Input
                    value={profileForm.serviceCode}
                    onChange={(e) =>
                      setProfileForm(
                        (f) => f && { ...f, serviceCode: e.target.value },
                      )
                    }
                    placeholder="e.g. 520 or 896"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                    Emergency contacts
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setProfileForm(
                        (f) =>
                          f && {
                            ...f,
                            emergencyContacts: [
                              ...f.emergencyContacts,
                              { name: '', phone: '', relationship: '' },
                            ],
                          },
                      )
                    }
                  >
                    Add contact
                  </Button>
                </div>
                <div className="mt-2 space-y-2">
                  {profileForm.emergencyContacts.map((contact, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
                    >
                      <Input
                        value={contact.name}
                        onChange={(e) =>
                          updateContact(index, { name: e.target.value })
                        }
                        placeholder="Name"
                        aria-label={`Emergency contact ${index + 1} name`}
                      />
                      <Input
                        value={contact.phone}
                        onChange={(e) =>
                          updateContact(index, { phone: e.target.value })
                        }
                        placeholder="Phone"
                        aria-label={`Emergency contact ${index + 1} phone`}
                      />
                      <Input
                        value={contact.relationship}
                        onChange={(e) =>
                          updateContact(index, {
                            relationship: e.target.value,
                          })
                        }
                        placeholder="Relationship"
                        aria-label={`Emergency contact ${index + 1} relationship`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setProfileForm(
                            (f) =>
                              f && {
                                ...f,
                                emergencyContacts: f.emergencyContacts.filter(
                                  (_, i) => i !== index,
                                ),
                              },
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setProfileOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSaveProfile}>
            Save profile
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={objectiveOpen} onClose={() => setObjectiveOpen(false)}>
        <DialogHeader>
          <DialogTitle>Add objective</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          {objectiveError && (
            <p className="text-sm text-atria-danger">{objectiveError}</p>
          )}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
              Title
            </label>
            <Input
              value={objectiveForm.title}
              onChange={(e) =>
                setObjectiveForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Prepare a simple meal"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Source
              </label>
              <Select
                value={objectiveForm.source}
                onChange={(e) =>
                  setObjectiveForm((f) => ({
                    ...f,
                    source: e.target.value as 'ipp' | 'isp',
                  }))
                }
                className="mt-1"
              >
                <option value="ipp">IPP</option>
                <option value="isp">ISP</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
                Target date (optional)
              </label>
              <USDateInput
                value={objectiveForm.targetDate}
                onChange={(iso) =>
                  setObjectiveForm((f) => ({ ...f, targetDate: iso }))
                }
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
              Description (optional)
            </label>
            <Input
              value={objectiveForm.description}
              onChange={(e) =>
                setObjectiveForm((f) => ({ ...f, description: e.target.value }))
              }
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-atria-muted">
              Hours per month (optional)
            </label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={objectiveForm.hoursPerMonth}
              onChange={(e) =>
                setObjectiveForm((f) => ({
                  ...f,
                  hoursPerMonth: e.target.value,
                }))
              }
              className="mt-1"
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setObjectiveOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleAddObjective}>
            Add objective
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
