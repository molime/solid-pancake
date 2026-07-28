import { useOrganization } from '@clerk/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'
import { Card, CardContent } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Badge } from '@/shared/ui/Badge'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { Users, CalendarPlus, MapPin } from 'lucide-react'

type CaregiverOption = {
  clerkUserId: string
  displayName: string
  email: string
}

function caregiverLabel(caregiver: CaregiverOption) {
  const email = caregiver.email.trim()
  if (email) return email

  const displayName = caregiver.displayName.trim()
  if (displayName && displayName !== 'User') return displayName

  return caregiver.clerkUserId
}

function todayInputValue() {
  const today = new Date()
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset())
  return today.toISOString().slice(0, 10)
}

export function ClientsPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const clients = useQuery(
    api.clients.list,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const caregivers = useQuery(
    api.members.listCaregivers,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const tenantSettings = useQuery(
    api.tenantSettings.get,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const createClient = useMutation(api.clients.create)
  const createShift = useMutation(api.shifts.create)
  const createManyShifts = useMutation(api.shifts.createMany)
  const updateServiceAddress = useMutation(api.clients.updateServiceAddress)

  const [form, setForm] = useState({
    displayName: '',
    serviceType: 'SLS' as 'SLS' | 'ILS',
    authorizationHours: 40,
    riskFlags: '',
  })
  const [showForm, setShowForm] = useState(false)

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleClientId, setScheduleClientId] = useState<string | null>(null)
  const [scheduleForm, setScheduleForm] = useState(() => ({
    caregiverId: '',
    date: todayInputValue(),
    startTime: '09:00',
    endTime: '13:00',
    rate: 28.5,
  }))
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState(() => ({
    caregiverId: '',
    startDate: todayInputValue(),
    endDate: todayInputValue(),
    startTime: '09:00',
    endTime: '13:00',
    rate: 28.5,
  }))
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)

  const [addressOpen, setAddressOpen] = useState(false)
  const [addressClientId, setAddressClientId] = useState<string | null>(null)
  const [addressForm, setAddressForm] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    latitude: '',
    longitude: '',
  })
  const [addressError, setAddressError] = useState<string | null>(null)

  if (!clients) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-muted">Loading clients…</div>
      </div>
    )
  }

  const handleCreate = async () => {
    if (!clerkOrgId) return
    await createClient({
      clerkOrgId,
      displayName: form.displayName,
      serviceType: form.serviceType,
      authorizationHours: form.authorizationHours,
      riskFlags: form.riskFlags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })
    setForm({
      displayName: '',
      serviceType: 'SLS',
      authorizationHours: 40,
      riskFlags: '',
    })
    setShowForm(false)
  }

  const openSchedule = (clientId: string) => {
    setScheduleClientId(clientId)
    setScheduleForm({
      caregiverId: caregivers?.[0]?.clerkUserId ?? '',
      date: todayInputValue(),
      startTime: '09:00',
      endTime: '13:00',
      rate: 28.5,
    })
    setScheduleError(null)
    setScheduleOpen(true)
  }

  const toggleClientSelection = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId],
    )
  }

  const openBulkSchedule = () => {
    setBulkForm({
      caregiverId: caregivers?.[0]?.clerkUserId ?? '',
      startDate: todayInputValue(),
      endDate: todayInputValue(),
      startTime: '09:00',
      endTime: '13:00',
      rate: 28.5,
    })
    setBulkError(null)
    setBulkMessage(null)
    setBulkOpen(true)
  }

  const openAddress = (client: Doc<'clients'>) => {
    setAddressClientId(client._id)
    const address = client.serviceAddress
    setAddressForm({
      line1: address?.line1 ?? '',
      line2: address?.line2 ?? '',
      city: address?.city ?? '',
      state: address?.state ?? '',
      postalCode: address?.postalCode ?? '',
      country: address?.country ?? '',
      latitude: address?.latitude?.toString() ?? '',
      longitude: address?.longitude?.toString() ?? '',
    })
    setAddressError(null)
    setAddressOpen(true)
  }

  const handleSaveAddress = async () => {
    if (!clerkOrgId || !addressClientId) return
    setAddressError(null)

    const latitude = addressForm.latitude.trim()
      ? Number(addressForm.latitude)
      : undefined
    const longitude = addressForm.longitude.trim()
      ? Number(addressForm.longitude)
      : undefined

    try {
      await updateServiceAddress({
        clerkOrgId,
        clientId: addressClientId as Id<'clients'>,
        serviceAddress: {
          line1: addressForm.line1.trim(),
          line2: addressForm.line2.trim() || undefined,
          city: addressForm.city.trim(),
          state: addressForm.state.trim(),
          postalCode: addressForm.postalCode.trim(),
          country: addressForm.country.trim() || undefined,
          latitude,
          longitude,
        },
      })
      setAddressOpen(false)
      setAddressClientId(null)
    } catch (err) {
      setAddressError(err instanceof Error ? sanitizeConvexError(err.message) : 'Failed to save address.')
    }
  }

  const handleSchedule = async () => {
    if (!clerkOrgId || !scheduleClientId) return
    setScheduleError(null)

    if (!scheduleForm.caregiverId || !scheduleForm.date) {
      setScheduleError('Please select a caregiver and date.')
      return
    }

    const client = clients.find((c: Doc<'clients'>) => c._id === scheduleClientId)
    if (!client) return

    const scheduledStart = `${scheduleForm.date}T${scheduleForm.startTime}:00Z`
    const scheduledEnd = `${scheduleForm.date}T${scheduleForm.endTime}:00Z`

    try {
      await createShift({
        clerkOrgId,
        clientId: scheduleClientId as Id<'clients'>,
        caregiverId: scheduleForm.caregiverId,
        scheduledStart,
        scheduledEnd,
        serviceType: client.serviceType,
        rate: scheduleForm.rate,
      })
      setScheduleOpen(false)
      setScheduleClientId(null)
    } catch (err) {
      setScheduleError(
        err instanceof Error ? sanitizeConvexError(err.message) : 'Failed to schedule shift.',
      )
    }
  }

  const handleBulkSchedule = async () => {
    if (!clerkOrgId) return
    setBulkError(null)
    setBulkMessage(null)

    if (selectedClientIds.length === 0) {
      setBulkError('Select at least one client.')
      return
    }
    if (!bulkForm.caregiverId) {
      setBulkError('Select a caregiver.')
      return
    }

    try {
      const result = await createManyShifts({
        clerkOrgId,
        clientIds: selectedClientIds as Id<'clients'>[],
        caregiverId: bulkForm.caregiverId,
        startDate: bulkForm.startDate,
        endDate: bulkForm.endDate,
        startTime: bulkForm.startTime,
        endTime: bulkForm.endTime,
        rate: bulkForm.rate,
      })
      setBulkMessage(
        `Created ${result.created} shift${result.created !== 1 ? 's' : ''}.`,
      )
      setSelectedClientIds([])
      setBulkOpen(false)
    } catch (err) {
      setBulkError(
        err instanceof Error ? sanitizeConvexError(err.message) : 'Failed to schedule shifts.',
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-atria-ink">Clients</h1>
          <p className="text-sm text-atria-muted">
            {clients.length} client{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={selectedClientIds.length === 0}
            onClick={openBulkSchedule}
          >
            <CalendarPlus className="h-4 w-4" />
            Bulk schedule{' '}
            {selectedClientIds.length > 0 && `(${selectedClientIds.length})`}
          </Button>
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Client'}
          </Button>
        </div>
      </div>

      {bulkMessage && (
        <div className="rounded-md bg-atria-success-bg px-3 py-2 text-sm text-atria-success">
          {bulkMessage}
        </div>
      )}

      {tenantSettings?.shiftGeofence.enabled &&
        clients.some(
          (client: Doc<'clients'>) =>
            client.serviceAddress?.latitude === undefined ||
            client.serviceAddress?.longitude === undefined,
        ) && (
          <div className="rounded-md border border-atria-warning/30 bg-atria-warning-bg px-4 py-3 text-sm text-atria-warning">
            Geofence is enabled, but some clients are missing latitude/longitude
            coordinates. Clock-in/out will be blocked for those clients until a
            service address is completed.
          </div>
        )}

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                  Name
                </label>
                <Input
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                  placeholder="Client name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                  Service Type
                </label>
                <Select
                  value={form.serviceType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      serviceType: e.target.value as 'SLS' | 'ILS',
                    }))
                  }
                >
                  <option value="SLS">SLS</option>
                  <option value="ILS">ILS</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                  Authorization Hours
                </label>
                <Input
                  type="number"
                  value={form.authorizationHours}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      authorizationHours: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                  Risk Flags
                </label>
                <Input
                  value={form.riskFlags}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, riskFlags: e.target.value }))
                  }
                  placeholder="Comma-separated"
                />
              </div>
            </div>
            <Button variant="primary" onClick={handleCreate}>
              Save Client
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-atria-border/50 mb-3">
                <Users className="h-6 w-6 text-atria-muted" />
              </div>
              <p className="text-sm font-medium text-atria-ink">
                No clients yet
              </p>
              <p className="text-xs text-atria-muted mt-1 max-w-xs">
                Add your first client to start scheduling shifts.
              </p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedClientIds.length === clients.length &&
                        clients.length > 0
                      }
                      onChange={(event) =>
                        setSelectedClientIds(
                          event.target.checked
                            ? clients.map((client: Doc<'clients'>) => client._id)
                            : [],
                        )
                      }
                      className="h-4 w-4 rounded border-atria-border text-atria-accent"
                    />
                  </TableHeader>
                  <TableHeader>Name</TableHeader>
                  <TableHeader>Service</TableHeader>
                  <TableHeader>Auth Hours</TableHeader>
                  <TableHeader>Risk Flags</TableHeader>
                  <TableHeader className="w-32">Action</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((client: Doc<'clients'>) => (
                  <TableRow key={client._id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedClientIds.includes(client._id)}
                        onChange={() => toggleClientSelection(client._id)}
                        className="h-4 w-4 rounded border-atria-border text-atria-accent"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {client.displayName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{client.serviceType}</Badge>
                    </TableCell>
                    <TableCell>{client.authorizationHours}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {client.riskFlags.map((flag: string) => (
                          <Badge key={flag} variant="warning">
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAddress(client)}
                        >
                          <MapPin className="h-4 w-4 mr-1" />
                          Address
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openSchedule(client._id)}
                        >
                          <CalendarPlus className="h-4 w-4 mr-1" />
                          Schedule
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)}>
        <DialogHeader>
          <DialogTitle>Schedule Shift</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          {scheduleError && (
            <p className="text-sm text-atria-danger">{scheduleError}</p>
          )}
          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              Caregiver
            </label>
            <Select
              value={scheduleForm.caregiverId}
              onChange={(e) =>
                setScheduleForm((f) => ({ ...f, caregiverId: e.target.value }))
              }
              className="mt-1"
            >
              <option value="" disabled>
                Select caregiver
              </option>
              {caregivers?.map((cg: CaregiverOption) => (
                <option key={cg.clerkUserId} value={cg.clerkUserId}>
                  {caregiverLabel(cg)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                Date
              </label>
              <Input
                type="date"
                value={scheduleForm.date}
                onChange={(e) =>
                  setScheduleForm((f) => ({ ...f, date: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                Start
              </label>
              <Input
                type="time"
                value={scheduleForm.startTime}
                onChange={(e) =>
                  setScheduleForm((f) => ({ ...f, startTime: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                End
              </label>
              <Input
                type="time"
                value={scheduleForm.endTime}
                onChange={(e) =>
                  setScheduleForm((f) => ({ ...f, endTime: e.target.value }))
                }
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              Rate ($/hr)
            </label>
            <Input
              type="number"
              step="0.01"
              value={scheduleForm.rate}
              onChange={(e) =>
                setScheduleForm((f) => ({ ...f, rate: Number(e.target.value) }))
              }
              className="mt-1"
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setScheduleOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSchedule}>
            Schedule Shift
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)}>
        <DialogHeader>
          <DialogTitle>Bulk Schedule Shifts</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          {bulkError && (
            <p className="text-sm text-atria-danger">{bulkError}</p>
          )}
          <p className="text-sm text-atria-muted">
            Create shifts for {selectedClientIds.length} selected client
            {selectedClientIds.length !== 1 ? 's' : ''} across a date range.
          </p>
          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              Caregiver
            </label>
            <Select
              value={bulkForm.caregiverId}
              onChange={(e) =>
                setBulkForm((f) => ({ ...f, caregiverId: e.target.value }))
              }
              className="mt-1"
            >
              <option value="" disabled>
                Select caregiver
              </option>
              {caregivers?.map((cg: CaregiverOption) => (
                <option key={cg.clerkUserId} value={cg.clerkUserId}>
                  {caregiverLabel(cg)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                From
              </label>
              <Input
                type="date"
                value={bulkForm.startDate}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, startDate: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                Until
              </label>
              <Input
                type="date"
                value={bulkForm.endDate}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, endDate: e.target.value }))
                }
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                Start
              </label>
              <Input
                type="time"
                value={bulkForm.startTime}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, startTime: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                End
              </label>
              <Input
                type="time"
                value={bulkForm.endTime}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, endTime: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                Rate ($/hr)
              </label>
              <Input
                type="number"
                step="0.01"
                value={bulkForm.rate}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, rate: Number(e.target.value) }))
                }
                className="mt-1"
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setBulkOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleBulkSchedule}>
            Create Shifts
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={addressOpen} onClose={() => setAddressOpen(false)}>
        <DialogHeader>
          <DialogTitle>Service Address</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          {addressError && (
            <p className="text-sm text-atria-danger">{addressError}</p>
          )}
          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              Address line 1
            </label>
            <Input
              value={addressForm.line1}
              onChange={(e) =>
                setAddressForm((f) => ({ ...f, line1: e.target.value }))
              }
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              Address line 2
            </label>
            <Input
              value={addressForm.line2}
              onChange={(e) =>
                setAddressForm((f) => ({ ...f, line2: e.target.value }))
              }
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                City
              </label>
              <Input
                value={addressForm.city}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, city: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                State
              </label>
              <Input
                value={addressForm.state}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, state: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                Postal code
              </label>
              <Input
                value={addressForm.postalCode}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, postalCode: e.target.value }))
                }
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              Country
            </label>
            <Input
              value={addressForm.country}
              onChange={(e) =>
                setAddressForm((f) => ({ ...f, country: e.target.value }))
              }
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                Latitude
              </label>
              <Input
                type="number"
                step="any"
                value={addressForm.latitude}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, latitude: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                Longitude
              </label>
              <Input
                type="number"
                step="any"
                value={addressForm.longitude}
                onChange={(e) =>
                  setAddressForm((f) => ({ ...f, longitude: e.target.value }))
                }
                className="mt-1"
              />
            </div>
          </div>
          <p className="text-xs text-atria-muted">
            Latitude and longitude are required for geofence enforcement. They
            can be entered manually or geocoded from the address outside the
            app.
          </p>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAddressOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSaveAddress}>
            Save Address
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
