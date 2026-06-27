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

export const SERVICE_OPTIONS = [
  { label: 'Bathing', icon: '🛁' },
  { label: 'Meals', icon: '🍽️' },
  { label: 'Walking', icon: '🚶' },
  { label: 'Medication', icon: '💊' },
  { label: 'Housekeeping', icon: '🧹' },
  { label: 'Company', icon: '💬' },
] as const

export const GOAL_OPTIONS = [
  { label: 'Walk a little each day', goal: 'stay mobile and steady' },
  { label: 'Eat full meals', goal: 'keep her strength up' },
  { label: 'Spend time talking', goal: 'feel less lonely' },
] as const

export type ServiceLabel = (typeof SERVICE_OPTIONS)[number]['label']
export type GoalLabel = (typeof GOAL_OPTIONS)[number]['label']

export const ISSUE_CHOICE_NO = 'no'
export const ISSUE_CHOICE_YES = 'yes'

export type IssueChoice = typeof ISSUE_CHOICE_NO | typeof ISSUE_CHOICE_YES

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

export function parseSelectedServices(servicesProvided?: string): ServiceLabel[] {
  if (!servicesProvided) return []
  const labels = new Set(SERVICE_OPTIONS.map((s) => s.label))
  return servicesProvided
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is ServiceLabel => labels.has(part as ServiceLabel))
}

export function parseSelectedGoals(servicesProvided?: string): GoalLabel[] {
  if (!servicesProvided) return []
  const goalLabels = new Set(GOAL_OPTIONS.map((g) => g.label))
  return servicesProvided
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.endsWith(' goal'))
    .map((part) => part.replace(/ goal$/, ''))
    .filter((part): part is GoalLabel => goalLabels.has(part as GoalLabel))
}

export function buildServicesProvided(
  services: ServiceLabel[],
  goals: GoalLabel[],
): string {
  const parts: string[] = [...services]
  for (const goal of goals) {
    parts.push(`${goal} goal`)
  }
  return parts.join(', ')
}

export function parseIssueChoice(clientResponse?: string): IssueChoice | null {
  if (!clientResponse) return null
  if (clientResponse.startsWith('Reported:')) return ISSUE_CHOICE_YES
  if (clientResponse.includes('all good')) return ISSUE_CHOICE_NO
  return null
}

export function buildClientResponse(choice: IssueChoice): string {
  if (choice === ISSUE_CHOICE_NO) {
    return 'No problems — all good today'
  }
  return 'Reported: A fall, pain, mood change, or other concern'
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
