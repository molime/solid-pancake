import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import {
  createTaskDrafts,
  noteDraftFromNote,
  buildServicesProvided,
  buildClientResponse,
  parseSelectedServices,
  parseSelectedGoals,
  parseIssueChoice,
  type NoteDraft,
  type TaskDraft,
  type ServiceLabel,
  type GoalLabel,
  type IssueChoice,
} from '../model/documentationDraft'
import {
  WIZARD_STEPS,
  validateDocumentationDraft,
  validateStep,
  buildAutosavePatch,
} from '../model/documentationWizard'
import { useCaregiverLocation } from '../hooks/useCaregiverLocation'
import { Button } from '@/shared/ui/Button'
import { ShiftClockInScreen } from './ShiftClockInScreen'
import { ShiftClockOutScreen } from './ShiftClockOutScreen'
import { ShiftNoteStep } from './ShiftNoteStep'
import { ShiftSuccessScreen } from './ShiftSuccessScreen'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { formatStreetAddress } from '@/shared/format'

type ShiftDetails = FunctionReturnType<typeof api.shiftQueries.getWithDetails>
type TenantSettings = FunctionReturnType<typeof api.tenantSettings.get>
type TaskId = ShiftDetails['tasks'][number]['_id']
type TaskDraftList = TaskDraft<TaskId>[]

const TERMINAL_STATUSES = new Set([
  'submitted',
  'approved',
  'billing_ready',
])

function defaultGeofence(settings: TenantSettings | undefined) {
  return {
    enabled: settings?.shiftGeofence.enabled ?? false,
    enforceClockIn: settings?.shiftGeofence.enforceClockIn ?? false,
    enforceClockOut: settings?.shiftGeofence.enforceClockOut ?? false,
  }
}

export function ShiftDocumentationForm({
  clerkOrgId,
  shiftId,
  firstName,
  onDone,
}: {
  clerkOrgId: string
  shiftId: Id<'shifts'>
  firstName?: string
  onDone?: () => void
}) {
  const details = useQuery(api.shiftQueries.getWithDetails, {
    clerkOrgId,
    shiftId,
  })
  const settings = useQuery(api.tenantSettings.get, { clerkOrgId })

  if (!details || !settings) {
    return (
      <div className="rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface p-6">
        <div className="text-sm text-atria-muted">Loading shift details…</div>
      </div>
    )
  }

  return (
    <ShiftDocumentationWizard
      clerkOrgId={clerkOrgId}
      details={details}
      settings={settings}
      shiftId={shiftId}
      firstName={firstName}
      onDone={onDone}
    />
  )
}

function ShiftDocumentationWizard({
  clerkOrgId,
  details,
  settings,
  shiftId,
  firstName,
  onDone,
}: {
  clerkOrgId: string
  details: ShiftDetails
  settings: TenantSettings
  shiftId: Id<'shifts'>
  firstName?: string
  onDone?: () => void
}) {
  const [note, setNote] = useState<NoteDraft>(() => noteDraftFromNote(details.note))
  const [taskDrafts, setTaskDrafts] = useState<TaskDraftList>(() =>
    createTaskDrafts(details.tasks),
  )
  const [selectedServices, setSelectedServices] = useState<ServiceLabel[]>(() =>
    parseSelectedServices(details.note?.servicesProvided),
  )
  const [selectedGoals, setSelectedGoals] = useState<GoalLabel[]>(() =>
    parseSelectedGoals(details.note?.servicesProvided),
  )
  const [issueChoice, setIssueChoice] = useState<IssueChoice | null>(() =>
    parseIssueChoice(details.note?.clientResponse),
  )
  const [confirmed, setConfirmed] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [view, setView] = useState<'clockIn' | 'wizard' | 'clockOut' | 'success'>(() => {
    if (TERMINAL_STATUSES.has(details.shift.status)) return 'success'
    if (details.shift.clockInAt) return 'wizard'
    return 'clockIn'
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isPunchLoading, setIsPunchLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const geofence = useMemo(
    () => defaultGeofence(settings),
    [settings],
  )
  const { state: locationState, requestLocation, setOutsideError, clearLocationError } = useCaregiverLocation()

  const clockIn = useMutation(api.shifts.clockIn)
  const clockOut = useMutation(api.shifts.clockOut)
  const updateProgressNote = useMutation(api.shifts.updateProgressNote)

  const blockers = useMemo(
    () => validateDocumentationDraft(note, taskDrafts, details.tasks),
    [note, taskDrafts, details.tasks],
  )

  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const autosave = (patch: Partial<NoteDraft>) => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }
    setSaved(false)
    autosaveTimeoutRef.current = setTimeout(async () => {
      if (Object.keys(patch).length === 0) return
      setIsSaving(true)
      setSaveError(null)
      try {
        await updateProgressNote({
          clerkOrgId,
          shiftId,
          ...patch,
        })
        setSaved(true)
      } catch (err) {
        setSaveError(err instanceof Error ? sanitizeConvexError(err.message) : 'Autosave failed')
      } finally {
        setIsSaving(false)
      }
    }, 800)
  }

  const handleNoteChange = (next: NoteDraft) => {
    setNote(next)
    const stepId = WIZARD_STEPS[currentStepIndex].id
    const patch = buildAutosavePatch(stepId, next)
    autosave(patch)
  }

  const updateServicesAndGoals = (
    services: ServiceLabel[],
    goals: GoalLabel[],
  ) => {
    const servicesProvided = buildServicesProvided(services, goals)
    setSelectedServices(services)
    setSelectedGoals(goals)
    const next = { ...note, servicesProvided }
    setNote(next)
    autosave({ servicesProvided })
  }

  const updateIssueChoice = (choice: IssueChoice) => {
    setIssueChoice(choice)
    const clientResponse = buildClientResponse(choice)
    const next = { ...note, clientResponse }
    setNote(next)
    autosave({ clientResponse })
  }

  const handleClockIn = async () => {
    setSaveError(null)
    setIsPunchLoading(true)
    try {
      const location = await requestLocation({
        geofence,
        punchType: 'clock_in',
      })
      const locationRequired = geofence.enabled && geofence.enforceClockIn
      if (locationRequired && !location) {
        return
      }
      await clockIn({ clerkOrgId, shiftId, location })
      setView('wizard')
    } catch (err) {
      const message = err instanceof Error ? sanitizeConvexError(err.message) : 'Clock in failed'
      if (message.toLowerCase().includes('outside')) {
        setOutsideError(message)
      } else {
        setSaveError(message)
      }
    } finally {
      setIsPunchLoading(false)
    }
  }

  const hasExistingClockOut = Boolean(details.shift.clockOutAt)

  const handleClockOut = async () => {
    setSaveError(null)
    setIsPunchLoading(true)
    try {
      const location = hasExistingClockOut
        ? undefined
        : await requestLocation({
            geofence,
            punchType: 'clock_out',
          })
      await clockOut({
        clerkOrgId,
        shiftId,
        location,
        note,
        tasks: taskDrafts,
      })
      setView('success')
    } catch (err) {
      const message = err instanceof Error ? sanitizeConvexError(err.message) : 'Clock out failed'
      if (message.toLowerCase().includes('outside')) {
        setOutsideError(message)
      } else {
        setSaveError(message)
      }
    } finally {
      setIsPunchLoading(false)
    }
  }

  const currentStepId = WIZARD_STEPS[currentStepIndex].id
  const stepBlockers = validateStep(currentStepId, note, taskDrafts, details.tasks)

  const isDoneStep = currentStepIndex === WIZARD_STEPS.length - 1
  const canAdvance =
    stepBlockers.length === 0 &&
    (currentStepId !== 'what' || selectedServices.length > 0) &&
    (currentStepId !== 'goal' || selectedGoals.length > 0) &&
    (currentStepId !== 'issues' || issueChoice !== null)
  const canSubmitDone = canAdvance && confirmed

  const goNext = () => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      setCurrentStepIndex((i) => i + 1)
    } else {
      setView('clockOut')
    }
  }

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1)
    } else {
      setView('clockIn')
      clearLocationError()
    }
  }

  const editStep = (stepIndex: number) => {
    setCurrentStepIndex(stepIndex)
  }

  const clientName = details.client?.displayName ?? 'Client'
  const address = details.client?.serviceAddress
    ? formatStreetAddress(details.client.serviceAddress)
    : 'No address'

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (view === 'clockOut' && !hasExistingClockOut) {
      requestLocation({ geofence, punchType: 'clock_out' }).catch(() => {
        // Location errors are captured in locationState; surface them via the checklist.
      })
    }
  }, [view, geofence, requestLocation, hasExistingClockOut])

  if (view === 'success') {
    return (
      <ShiftSuccessScreen
        firstName={firstName ?? ''}
        clientName={clientName}
        onHome={() => {
          onDone?.()
          setView('clockIn')
          setCurrentStepIndex(0)
          setConfirmed(false)
          clearLocationError()
        }}
      />
    )
  }

  if (view === 'clockIn') {
    return (
      <ShiftClockInScreen
        scheduledStart={details.shift.scheduledStart}
        scheduledEnd={details.shift.scheduledEnd}
        clientName={clientName}
        address={address}
        geofence={geofence}
        locationState={locationState}
        isLoading={isPunchLoading}
        onClockIn={handleClockIn}
      />
    )
  }

  if (view === 'clockOut') {
    return (
      <ShiftClockOutScreen
        scheduledStart={details.shift.scheduledStart}
        clientName={clientName}
        actualClockInAt={details.shift.clockInAt}
        actualClockOutAt={details.shift.clockOutAt}
        blockers={blockers}
        geofence={geofence}
        locationState={locationState}
        isLoading={isPunchLoading}
        onClockOut={handleClockOut}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <ShiftNoteStep
          stepId={currentStepId}
          stepIndex={currentStepIndex}
          note={note}
          onNoteChange={handleNoteChange}
          taskDrafts={taskDrafts}
          onTaskDraftsChange={setTaskDrafts}
          tasks={details.tasks}
          editable
          clerkOrgId={clerkOrgId}
          clientName={clientName}
          selectedServices={selectedServices}
          selectedGoals={selectedGoals}
          issueChoice={issueChoice}
          confirmed={confirmed}
          onSelectedServicesChange={(services) =>
            updateServicesAndGoals(services, selectedGoals)
          }
          onSelectedGoalsChange={(goals) =>
            updateServicesAndGoals(selectedServices, goals)
          }
          onIssueChoiceChange={updateIssueChoice}
          onConfirmedChange={setConfirmed}
          onEditStep={editStep}
          isSaving={isSaving}
          saved={saved}
        />
      </div>

      {saveError && (
        <div className="mb-4 rounded-[var(--radius-atria-md)] border border-atria-danger/30 bg-atria-danger-bg p-3 text-sm text-atria-danger" data-testid="save-error">
          {saveError}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="lg"
          className="h-[52px] min-w-[44px]"
          onClick={goBack}
          data-testid="wizard-back-button"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </Button>

        <Button
          variant="primary"
          size="lg"
          className={cn(
            'h-[52px] min-w-[44px] rounded-full',
            currentStepId !== 'issues' && WIZARD_STEPS[currentStepIndex].bgAccent,
          )}
          onClick={goNext}
          disabled={isDoneStep ? !canSubmitDone : !canAdvance}
          data-testid="wizard-next-button"
        >
          {isDoneStep ? 'Submit my notes' : 'Next Step'}
          {isDoneStep ? (
            <span className="ml-2">✓</span>
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  )
}
