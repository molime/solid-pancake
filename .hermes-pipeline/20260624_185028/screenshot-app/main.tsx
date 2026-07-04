import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useSearchParams } from 'react-router-dom'
import './visual.css'
import { CaregiverTodayPage } from '@/features/caregiver/pages/CaregiverTodayPage'
import { ShiftClockInScreen } from '@/features/caregiver/components/ShiftClockInScreen'
import { ShiftClockOutScreen } from '@/features/caregiver/components/ShiftClockOutScreen'
import { ShiftNoteStep } from '@/features/caregiver/components/ShiftNoteStep'
import { ShiftSuccessScreen } from '@/features/caregiver/components/ShiftSuccessScreen'
import { Button } from '@/shared/ui/Button'
import { WIZARD_STEPS } from '@/features/caregiver/model/documentationWizard'
import {
  createTaskDrafts,
  noteDraftFromNote,
  parseSelectedServices,
  parseSelectedGoals,
  parseIssueChoice,
  type NoteDraft,
  type TaskDraft,
} from '@/features/caregiver/model/documentationDraft'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import type { Id } from '../../../convex/_generated/dataModel'

const shiftId = 'shift_screenshot' as Id<'shifts'>
const clientName = 'Maria Lopez'
const clerkOrgId = 'org_screenshot'

function ScreenshotRouter() {
  const [searchParams] = useSearchParams()
  const state = searchParams.get('state') ?? 'today'

  if (state === 'today') {
    return (
      <div className="mx-auto max-w-[430px] p-4">
        <CaregiverTodayPage />
      </div>
    )
  }

  if (state === 'clockIn' || state === 'clockInGeofence') {
    return (
      <div className="mx-auto max-w-[430px] p-4">
        <ShiftClockInScreen
          scheduledStart="2026-06-25T15:00:00Z"
          scheduledEnd="2026-06-25T19:00:00Z"
          clientName={clientName}
          address="1820 Oak Street, Apt 4"
          geofence={{
            enabled: state === 'clockInGeofence',
            enforceClockIn: state === 'clockInGeofence',
            enforceClockOut: state === 'clockInGeofence',
          }}
          locationState={
            state === 'clockInGeofence'
              ? { status: 'checking' }
              : { status: 'idle' }
          }
          isLoading={false}
          onClockIn={() => {}}
        />
      </div>
    )
  }

  if (state === 'clockOut') {
    return (
      <div className="mx-auto max-w-[430px] p-4">
        <ShiftClockOutScreen
          scheduledStart="2026-06-25T15:00:00Z"
          clientName={clientName}
          actualClockInAt="2026-06-25T15:02:00Z"
          actualClockOutAt="2026-06-25T19:04:00Z"
          blockers={[]}
          geofence={{ enabled: false, enforceClockIn: false, enforceClockOut: false }}
          locationState={{ status: 'idle' }}
          isLoading={false}
          onClockOut={() => {}}
        />
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="mx-auto h-[844px] max-w-[430px]">
        <ShiftSuccessScreen
          firstName="Ana"
          clientName={clientName}
          onHome={() => {}}
        />
      </div>
    )
  }

  const stepIndex =
    state === 'step1' ? 0 :
    state === 'step2' ? 1 :
    state === 'step3' ? 2 :
    state === 'step4' ? 3 :
    state === 'step5' ? 4 :
    state === 'step6' ? 5 : 0

  return (
    <div className="mx-auto flex h-svh max-w-[430px] flex-col p-4">
      <StaticStepScreen stepIndex={stepIndex} />
    </div>
  )
}

function StaticStepScreen({ stepIndex }: { stepIndex: number }) {
  const stepId = WIZARD_STEPS[stepIndex].id

  const initialNote: NoteDraft = (() => {
    const base: NoteDraft = {
      startTime: '09:00',
      endTime: '13:00',
      narrative: '',
      servicesProvided: '',
      clientResponse: '',
    }

    if (stepIndex === 0) return base

    if (stepIndex === 1) {
      return { ...base, servicesProvided: 'Bathing, Meals' }
    }

    if (stepIndex === 2) {
      return {
        ...base,
        servicesProvided: 'Bathing, Meals',
        narrative: 'I helped Maria with her morning bath and got her dressed. She ate all of her breakfast and was in good spirits. We did her walking exercises in the hallway for about 15 minutes.',
      }
    }

    if (stepIndex === 3) {
      return {
        ...base,
        servicesProvided: 'Bathing, Meals, Walk a little each day goal, Eat full meals goal',
        narrative: 'I helped Maria with her morning bath and got her dressed. She ate all of her breakfast and was in good spirits. We did her walking exercises in the hallway for about 15 minutes.',
      }
    }

    return {
      startTime: '09:00',
      endTime: '13:00',
      narrative: 'I helped Maria with her morning bath and got her dressed. She ate all of her breakfast and was in good spirits. We did her walking exercises in the hallway for about 15 minutes.',
      servicesProvided: 'Bathing, Meals, Walking, Medication, Housekeeping, Company, Walk a little each day goal, Eat full meals goal',
      clientResponse: 'No problems — all good today',
    }
  })()

  const [note, setNote] = useState<NoteDraft>(() => noteDraftFromNote(initialNote))
  const [taskDrafts, setTaskDrafts] = useState<TaskDraft[]>(() =>
    createTaskDrafts([{
      _id: 'task_screenshot',
      title: 'Observation note',
      requiredProof: true,
      status: 'complete',
      proofName: 'photo.jpg',
    }]),
  )
  const selectedServices = useMemo(() => parseSelectedServices(note.servicesProvided), [note.servicesProvided])
  const selectedGoals = useMemo(() => parseSelectedGoals(note.servicesProvided), [note.servicesProvided])
  const issueChoice = useMemo(() => parseIssueChoice(note.clientResponse), [note.clientResponse])
  const [confirmed, setConfirmed] = useState(true)

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <ShiftNoteStep
          stepId={stepId}
          stepIndex={stepIndex}
          note={note}
          onNoteChange={setNote}
          taskDrafts={taskDrafts}
          onTaskDraftsChange={setTaskDrafts}
          tasks={[
            {
              _id: 'task_screenshot',
              title: 'Observation note',
              requiredProof: true,
              status: 'complete',
              proofName: 'photo.jpg',
            },
          ]}
          editable
          clerkOrgId={clerkOrgId}
          clientName={clientName}
          selectedServices={selectedServices}
          selectedGoals={selectedGoals}
          issueChoice={issueChoice}
          confirmed={confirmed}
          onSelectedServicesChange={(services) =>
            setNote((prev) => ({ ...prev, servicesProvided: [...services, ...selectedGoals.map((g) => `${g} goal`)].join(', ') }))
          }
          onSelectedGoalsChange={(goals) =>
            setNote((prev) => ({ ...prev, servicesProvided: [...selectedServices, ...goals.map((g) => `${g} goal`)].join(', ') }))
          }
          onIssueChoiceChange={(choice) =>
            setNote((prev) => ({
              ...prev,
              clientResponse: choice === 'no' ? 'No problems — all good today' : 'Reported: A fall, pain, mood change, or other concern',
            }))
          }
          onConfirmedChange={setConfirmed}
          onEditStep={() => {}}
          isSaving={false}
          saved={stepIndex < 5 ? true : false}
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-4">
        <Button
          variant="secondary"
          size="lg"
          className="h-[52px] min-w-[44px]"
          onClick={() => {}}
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </Button>

        <Button
          variant="primary"
          size="lg"
          className={cn(
            'h-[52px] min-w-[44px] rounded-full',
            stepId !== 'issues' && WIZARD_STEPS[stepIndex].bgAccent,
          )}
          onClick={() => {}}
          disabled={stepIndex === 5 && !confirmed}
        >
          {stepIndex === 5 ? 'Submit my notes' : 'Next Step'}
          {stepIndex === 5 ? (
            <span className="ml-2">✓</span>
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ScreenshotRouter />
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
