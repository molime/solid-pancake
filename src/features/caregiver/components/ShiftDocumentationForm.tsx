import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useMemo, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import {
  createTaskDrafts,
  noteDraftFromNote,
  validateDocumentationDraft,
  type NoteDraft,
  type TaskDraft,
} from '../model/documentationDraft'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Separator } from '@/shared/ui/Separator'
import { Textarea } from '@/shared/ui/Textarea'
import { ShiftTaskList } from './ShiftTaskList'

type ShiftDetails = FunctionReturnType<typeof api.shiftQueries.getWithDetails>
type TaskId = ShiftDetails['tasks'][number]['_id']
type TaskDraftList = TaskDraft<TaskId>[]

export function ShiftDocumentationForm({
  clerkOrgId,
  shiftId,
}: {
  clerkOrgId: string
  shiftId: Id<'shifts'>
}) {
  const details = useQuery(api.shiftQueries.getWithDetails, {
    clerkOrgId,
    shiftId,
  })

  if (!details) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-sm text-atria-muted">Loading shift details…</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <ShiftDocumentationEditor
      clerkOrgId={clerkOrgId}
      details={details}
      shiftId={shiftId}
    />
  )
}

function ShiftDocumentationEditor({
  clerkOrgId,
  details,
  shiftId,
}: {
  clerkOrgId: string
  details: ShiftDetails
  shiftId: Id<'shifts'>
}) {
  const [note, setNote] = useState<NoteDraft>(() => noteDraftFromNote(details.note))
  const [taskUpdates, setTaskUpdates] = useState<TaskDraftList>(() =>
    createTaskDrafts(details.tasks),
  )
  const [nowMs] = useState(() => Date.now())
  const submit = useMutation(api.shifts.submitDocumentation)
  const startDocumentation = useMutation(api.shifts.startDocumentation)

  const blockers = useMemo(
    () => validateDocumentationDraft(note, taskUpdates, details.tasks),
    [note, taskUpdates, details.tasks],
  )

  const editable =
    details.shift.status === 'in_progress' ||
    details.shift.status === 'needs_correction'
  const canSubmit = blockers.length === 0 && editable
  const scheduledStartMs = Date.parse(details.shift.scheduledStart)
  const isScheduledDue =
    Number.isFinite(scheduledStartMs) && scheduledStartMs <= nowMs
  const canStartDocumentation =
    details.shift.status === 'scheduled' && isScheduledDue

  const handleSubmit = async () => {
    await submit({
      clerkOrgId,
      shiftId,
      note,
      tasks: taskUpdates,
    })
  }

  const handleStartDocumentation = async () => {
    await startDocumentation({ clerkOrgId, shiftId })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shift Documentation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              Start Time
            </label>
            <Input
              type="time"
              value={note.startTime}
              onChange={(e) => setNote((n) => ({ ...n, startTime: e.target.value }))}
              disabled={!editable}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
              End Time
            </label>
            <Input
              type="time"
              value={note.endTime}
              onChange={(e) => setNote((n) => ({ ...n, endTime: e.target.value }))}
              disabled={!editable}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
            Services Provided
          </label>
          <Input
            value={note.servicesProvided}
            onChange={(e) => setNote((n) => ({ ...n, servicesProvided: e.target.value }))}
            placeholder="Describe services provided..."
            disabled={!editable}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
            Client Response
          </label>
          <Input
            value={note.clientResponse}
            onChange={(e) => setNote((n) => ({ ...n, clientResponse: e.target.value }))}
            placeholder="How did the client respond?"
            disabled={!editable}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
            Narrative
          </label>
          <Textarea
            value={note.narrative}
            onChange={(e) => setNote((n) => ({ ...n, narrative: e.target.value }))}
            placeholder="Detailed narrative of the shift..."
            disabled={!editable}
          />
        </div>

        <Separator />

        <ShiftTaskList
          clerkOrgId={clerkOrgId}
          editable={editable}
          taskUpdates={taskUpdates}
          tasks={details.tasks}
          onChange={setTaskUpdates}
        />

        {blockers.length > 0 && (
          <div className="rounded-md bg-atria-danger-bg p-3">
            <p className="text-xs font-medium text-atria-danger mb-1">
              Blockers
            </p>
            <ul className="space-y-0.5">
              {blockers.map((blocker) => (
                <li key={blocker} className="text-xs text-atria-danger">
                  {blocker}
                </li>
              ))}
            </ul>
          </div>
        )}

        {editable && (
          <Button
            variant="primary"
            className="w-full"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            Submit Documentation
          </Button>
        )}

        {canStartDocumentation && (
          <Button
            variant="primary"
            className="w-full"
            onClick={handleStartDocumentation}
          >
            Start Documentation
          </Button>
        )}

        {details.shift.status === 'scheduled' && !isScheduledDue && (
          <div className="rounded-md bg-atria-bg p-3 text-xs text-atria-muted">
            This shift is scheduled for the future. Documentation opens at the
            scheduled start time.
          </div>
        )}

        {details.shift.status === 'submitted' && (
          <Badge variant="info">Submitted for coordinator review</Badge>
        )}
        {details.shift.status === 'needs_correction' && (
          <Badge variant="danger">Returned for corrections</Badge>
        )}
      </CardContent>
    </Card>
  )
}
