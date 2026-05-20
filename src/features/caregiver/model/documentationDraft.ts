export interface NoteDraft {
  startTime: string
  endTime: string
  servicesProvided: string
  clientResponse: string
  narrative: string
}

export interface LoadedTask<TaskId extends string = string> {
  _id: TaskId
  title: string
  requiredProof: boolean
  status: 'pending' | 'complete'
  proofUrl?: string
  proofName?: string
}

export interface TaskDraft<TaskId extends string = string> {
  taskId: TaskId
  status: 'pending' | 'complete'
  proofUrl?: string
  proofName?: string
}

const EMPTY_NOTE_DRAFT: NoteDraft = {
  startTime: '',
  endTime: '',
  servicesProvided: '',
  clientResponse: '',
  narrative: '',
}

export function noteDraftFromNote(note?: Partial<NoteDraft> | null): NoteDraft {
  return {
    startTime: note?.startTime ?? EMPTY_NOTE_DRAFT.startTime,
    endTime: note?.endTime ?? EMPTY_NOTE_DRAFT.endTime,
    servicesProvided: note?.servicesProvided ?? EMPTY_NOTE_DRAFT.servicesProvided,
    clientResponse: note?.clientResponse ?? EMPTY_NOTE_DRAFT.clientResponse,
    narrative: note?.narrative ?? EMPTY_NOTE_DRAFT.narrative,
  }
}

export function createTaskDrafts<TaskId extends string>(
  tasks: LoadedTask<TaskId>[],
): TaskDraft<TaskId>[] {
  return tasks.map((task) => ({
    taskId: task._id,
    status: task.status,
    proofUrl: task.proofUrl,
    proofName: task.proofName,
  }))
}

export function updateTaskDraft<TaskId extends string = string>(
  drafts: TaskDraft<TaskId>[],
  taskId: TaskId,
  patch: Partial<Omit<TaskDraft<TaskId>, 'taskId'>>,
): TaskDraft<TaskId>[] {
  const existing = drafts.find((draft) => draft.taskId === taskId)
  if (!existing) {
    return [...drafts, { taskId, status: 'pending', ...patch }]
  }

  return drafts.map((draft) =>
    draft.taskId === taskId ? { ...draft, ...patch } : draft,
  )
}

export function validateDocumentationDraft<TaskId extends string = string>(
  note: NoteDraft,
  drafts: TaskDraft<TaskId>[],
  tasks: LoadedTask<TaskId>[],
): string[] {
  const blockers: string[] = []

  if (!note.startTime.trim()) blockers.push('Start time is required.')
  if (!note.endTime.trim()) blockers.push('End time is required.')
  if (note.startTime && note.endTime && note.endTime <= note.startTime) {
    blockers.push('End time must be after start time.')
  }
  if (!note.servicesProvided.trim()) {
    blockers.push('Services provided is required.')
  }
  if (!note.clientResponse.trim()) blockers.push('Client response is required.')
  if (!note.narrative.trim()) blockers.push('Narrative is required.')

  for (const task of tasks) {
    const draft = drafts.find((item) => item.taskId === task._id)
    const status = draft?.status ?? task.status
    const proofName = draft?.proofName ?? task.proofName

    if (status !== 'complete') {
      blockers.push(`${task.title} must be completed.`)
    }

    if (task.requiredProof && !proofName?.trim()) {
      blockers.push(`${task.title} requires proof.`)
    }
  }

  return blockers
}
