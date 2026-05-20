export interface DocumentationNote {
  startTime: string
  endTime: string
  servicesProvided: string
  clientResponse: string
  narrative: string
}

export interface ExistingTask<TaskId extends string = string> {
  _id: TaskId
  title: string
  requiredProof: boolean
  status: 'pending' | 'complete'
  proofUrl?: string
  proofName?: string
}

export interface TaskUpdate<TaskId extends string = string> {
  taskId: TaskId
  status: 'pending' | 'complete'
  proofUrl?: string
  proofName?: string
}

export interface ValidatedTask<TaskId extends string = string>
  extends ExistingTask<TaskId> {
  proofUrl?: string
  proofName?: string
}

export function mergeTaskUpdates<TaskId extends string>(
  tasks: ExistingTask<TaskId>[],
  updates: TaskUpdate<TaskId>[],
): ValidatedTask<TaskId>[] {
  const byTaskId = new Map(updates.map((update) => [update.taskId, update]))

  for (const update of updates) {
    if (!tasks.some((task) => task._id === update.taskId)) {
      throw new Error('Submitted task update does not belong to this shift.')
    }
  }

  return tasks.map((task) => {
    const update = byTaskId.get(task._id)
    if (!update) return task

    return {
      ...task,
      status: update.status,
      proofUrl: update.proofUrl,
      proofName: update.proofName,
    }
  })
}

export function validateShiftDocumentation(
  note: DocumentationNote,
  tasks: ExistingTask[],
): string[] {
  const blockers: string[] = []

  if (!note.startTime.trim()) blockers.push('Start time is required.')
  if (!note.endTime.trim()) blockers.push('End time is required.')
  if (!note.servicesProvided.trim()) {
    blockers.push('Services provided is required.')
  }
  if (!note.clientResponse.trim()) blockers.push('Client response is required.')
  if (!note.narrative.trim()) blockers.push('Narrative is required.')
  if (note.startTime.trim() && note.endTime.trim()) {
    const hours = calculateDocumentedHours(note.startTime, note.endTime)
    if (hours === null) blockers.push('End time must be after start time.')
  }

  for (const task of tasks) {
    if (task.status !== 'complete') {
      blockers.push(`${task.title} must be completed.`)
    }

    if (task.requiredProof && !task.proofName?.trim()) {
      blockers.push(`${task.title} requires proof.`)
    }
  }

  return blockers
}

export function calculateDocumentedHours(
  startTime: string,
  endTime: string,
): number | null {
  const start = minutesSinceMidnight(startTime)
  const end = minutesSinceMidnight(endTime)
  if (start === null || end === null || end <= start) return null
  return Math.round(((end - start) / 60) * 100) / 100
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function minutesSinceMidnight(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}
