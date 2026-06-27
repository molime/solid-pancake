import {
  type NoteDraft,
  type TaskDraft,
  type LoadedTask,
  validateDocumentationDraft,
} from './documentationDraft'

export const WIZARD_STEPS = [
  {
    id: 'when',
    label: 'When',
    prompt: 'When were you there?',
    helper: 'Check the times are right. Tap to change if needed.',
    accent: 'text-atria-step-when',
    bgAccent: 'bg-atria-step-when',
    borderAccent: 'border-atria-step-when',
    fields: ['startTime', 'endTime'] as const,
  },
  {
    id: 'what',
    label: 'What',
    prompt: 'What did you help with?',
    helper: 'Tap everything you did today. You can pick more than one.',
    accent: 'text-atria-step-what',
    bgAccent: 'bg-atria-step-what',
    borderAccent: 'border-atria-step-what',
    fields: ['servicesProvided'] as const,
  },
  {
    id: 'how',
    label: 'How',
    prompt: 'How did the visit go?',
    helper: 'Tell us in your own words what you helped with and how {clientName} was doing.',
    accent: 'text-atria-step-how',
    bgAccent: 'bg-atria-step-how',
    borderAccent: 'border-atria-step-how',
    fields: ['narrative'] as const,
  },
  {
    id: 'goal',
    label: 'Goal',
    prompt: 'Did you work on her goals?',
    helper: "These are {clientName}'s care plan goals. Tap the ones you helped with today.",
    accent: 'text-atria-step-goal',
    bgAccent: 'bg-atria-step-goal',
    borderAccent: 'border-atria-step-goal',
    fields: ['servicesProvided'] as const,
  },
  {
    id: 'issues',
    label: 'Issues',
    prompt: 'Anything we should know?',
    helper: 'Did anything go wrong, or did {clientName} seem unwell? It\'s okay if not.',
    accent: 'text-atria-step-issues',
    bgAccent: 'bg-atria-step-issues',
    borderAccent: 'border-atria-step-issues',
    fields: ['clientResponse'] as const,
  },
  {
    id: 'done',
    label: 'Done',
    prompt: 'One last look 👀',
    helper: 'Check everything looks right, then send it to your coordinator.',
    accent: 'text-atria-step-done',
    bgAccent: 'bg-atria-step-done',
    borderAccent: 'border-atria-step-done',
    fields: [] as const,
  },
] as const

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id']

export function stepIndexFor(id: WizardStepId): number {
  return WIZARD_STEPS.findIndex((step) => step.id === id)
}

export function validateStep(
  stepId: WizardStepId,
  note: NoteDraft,
  taskDrafts: TaskDraft[],
  tasks: LoadedTask[],
): string[] {
  const blockers = validateDocumentationDraft(note, taskDrafts, tasks)

  if (stepId === 'when') {
    return blockers.filter(
      (b) =>
        b.includes('Start time') ||
        b.includes('End time') ||
        b.includes('must be after'),
    )
  }

  if (stepId === 'what') {
    return blockers.filter((b) => b.includes('Services provided'))
  }

  if (stepId === 'how') {
    return blockers.filter((b) => b.includes('Narrative'))
  }

  if (stepId === 'goal') {
    return []
  }

  if (stepId === 'issues') {
    return blockers.filter((b) =>
      tasks.some((task) => b.includes(task.title)),
    )
  }

  return blockers
}

export function noteFieldsForStep(stepId: WizardStepId): Partial<NoteDraft> {
  const step = WIZARD_STEPS.find((s) => s.id === stepId)
  const patch: Partial<NoteDraft> = {}
  for (const field of step?.fields ?? []) {
    switch (field) {
      case 'startTime':
        patch.startTime = ''
        break
      case 'endTime':
        patch.endTime = ''
        break
      case 'servicesProvided':
        patch.servicesProvided = ''
        break
      case 'clientResponse':
        patch.clientResponse = ''
        break
      case 'narrative':
        patch.narrative = ''
        break
    }
  }
  return patch
}

export function buildAutosavePatch(
  stepId: WizardStepId,
  note: NoteDraft,
): Partial<NoteDraft> {
  const step = WIZARD_STEPS.find((s) => s.id === stepId)
  if (!step) return {}
  const patch: Partial<NoteDraft> = {}
  for (const field of step.fields) {
    switch (field) {
      case 'startTime':
        patch.startTime = note.startTime
        break
      case 'endTime':
        patch.endTime = note.endTime
        break
      case 'servicesProvided':
        patch.servicesProvided = note.servicesProvided
        break
      case 'clientResponse':
        patch.clientResponse = note.clientResponse
        break
      case 'narrative':
        patch.narrative = note.narrative
        break
    }
  }
  return patch
}

export function isStepComplete(
  stepId: WizardStepId,
  note: NoteDraft,
  taskDrafts: TaskDraft[],
  tasks: LoadedTask[],
): boolean {
  return validateStep(stepId, note, taskDrafts, tasks).length === 0
}

export { validateDocumentationDraft }
