import { useState } from 'react'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'
import { Checkbox } from '@/shared/ui/Checkbox'
import { ShiftTaskList } from './ShiftTaskList'
import {
  WIZARD_STEPS,
  type WizardStepId,
  validateStep,
} from '../model/documentationWizard'
import {
  SERVICE_OPTIONS,
  GOAL_OPTIONS,
  ISSUE_CHOICE_NO,
  ISSUE_CHOICE_YES,
  type ServiceLabel,
  type GoalLabel,
  type IssueChoice,
} from '../model/documentationDraft'
import type { NoteDraft, TaskDraft, LoadedTask } from '../model/documentationDraft'
import { cn } from '@/shared/lib/cn'
import type { Dispatch, SetStateAction } from 'react'
import { formatTime } from '@/shared/format'

export function ShiftNoteStep<TaskId extends string>({
  stepId,
  stepIndex,
  note,
  onNoteChange,
  taskDrafts,
  onTaskDraftsChange,
  tasks,
  editable,
  clerkOrgId,
  clientName,
  selectedServices,
  selectedGoals,
  issueChoice,
  confirmed,
  onSelectedServicesChange,
  onSelectedGoalsChange,
  onIssueChoiceChange,
  onConfirmedChange,
  onEditStep,
  isSaving,
  saved,
}: {
  stepId: WizardStepId
  stepIndex: number
  note: NoteDraft
  onNoteChange: (note: NoteDraft) => void
  taskDrafts: TaskDraft<TaskId>[]
  onTaskDraftsChange: Dispatch<SetStateAction<TaskDraft<TaskId>[]>>
  tasks: LoadedTask<TaskId>[]
  editable: boolean
  clerkOrgId: string
  clientName: string
  selectedServices: ServiceLabel[]
  selectedGoals: GoalLabel[]
  issueChoice: IssueChoice | null
  confirmed: boolean
  onSelectedServicesChange: (services: ServiceLabel[]) => void
  onSelectedGoalsChange: (goals: GoalLabel[]) => void
  onIssueChoiceChange: (choice: IssueChoice) => void
  onConfirmedChange: (confirmed: boolean) => void
  onEditStep?: (stepIndex: number) => void
  isSaving: boolean
  saved: boolean
}) {
  const step = WIZARD_STEPS.find((s) => s.id === stepId)!
  const stepBlockers = validateStep(stepId, note, taskDrafts, tasks)
  const helperText = step.helper.replace(/\{clientName\}/g, clientName)
  const progressPercent = ((stepIndex + 1) / WIZARD_STEPS.length) * 100

  const update = (patch: Partial<NoteDraft>) => {
    onNoteChange({ ...note, ...patch })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-atria-text-secondary">
            Step {stepIndex + 1} of {WIZARD_STEPS.length}
          </span>
          {saved && !isSaving && (
            <span className="text-atria-success">Autosaved ✓</span>
          )}
          {isSaving && <span className="text-atria-text-muted">Saving…</span>}
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-atria-border">
          <div
            className={cn('h-full transition-all duration-300', step.bgAccent)}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <h2 className={cn('text-2xl font-semibold', step.accent)}>{step.prompt}</h2>
        <p className="text-base text-atria-text-secondary">{helperText}</p>
      </div>

      {stepId === 'when' && (
        <WhenStep
          note={note}
          onChange={update}
          editable={editable}
          stepBlockers={stepBlockers}
        />
      )}

      {stepId === 'what' && (
        <WhatStep
          selectedServices={selectedServices}
          onChange={onSelectedServicesChange}
        />
      )}

      {stepId === 'how' && (
        <HowStep
          note={note}
          onChange={update}
          editable={editable}
          clientName={clientName}
        />
      )}

      {stepId === 'goal' && (
        <GoalStep
          selectedGoals={selectedGoals}
          onChange={onSelectedGoalsChange}
        />
      )}

      {stepId === 'issues' && (
        <IssuesStep
          issueChoice={issueChoice}
          onChange={onIssueChoiceChange}
          clerkOrgId={clerkOrgId}
          editable={editable}
          taskDrafts={taskDrafts}
          tasks={tasks}
          onTaskDraftsChange={onTaskDraftsChange}
        />
      )}

      {stepId === 'done' && (
        <DoneStep
          note={note}
          selectedServices={selectedServices}
          selectedGoals={selectedGoals}
          issueChoice={issueChoice}
          confirmed={confirmed}
          onConfirmedChange={onConfirmedChange}
          onEditStep={onEditStep}
        />
      )}

      <div data-testid={`step-content-${stepId}`} className="hidden" />
    </div>
  )
}

function WhenStep({
  note,
  onChange,
  editable,
  stepBlockers,
}: {
  note: NoteDraft
  onChange: (patch: Partial<NoteDraft>) => void
  editable: boolean
  stepBlockers: string[]
}) {
  const [editing, setEditing] = useState<'start' | 'end' | null>(null)

  const startError = !note.startTime.trim() && stepBlockers.some((b) => b.includes('Start time'))
  const endError = stepBlockers.some((b) => b.includes('End time') || b.includes('after'))

  return (
    <div className="space-y-3">
      <TimeCard
        label="I started at"
        time={note.startTime}
        displayTime={note.startTime ? formatTime(`2026-06-25T${note.startTime}:00`) : '—'}
        isEditing={editing === 'start'}
        onEdit={() => setEditing(editing === 'start' ? null : 'start')}
        onTimeChange={(value) => onChange({ startTime: value })}
        error={startError ? 'Enter a start time' : undefined}
        editable={editable}
      />
      <TimeCard
        label="I finished at"
        time={note.endTime}
        displayTime={note.endTime ? formatTime(`2026-06-25T${note.endTime}:00`) : '—'}
        isEditing={editing === 'end'}
        onEdit={() => setEditing(editing === 'end' ? null : 'end')}
        onTimeChange={(value) => onChange({ endTime: value })}
        error={endError ? stepBlockers.find((b) => b.includes('End time') || b.includes('after')) : undefined}
        editable={editable}
      />
    </div>
  )
}

function TimeCard({
  label,
  time,
  displayTime,
  isEditing,
  onEdit,
  onTimeChange,
  error,
  editable,
}: {
  label: string
  time: string
  displayTime: string
  isEditing: boolean
  onEdit: () => void
  onTimeChange: (value: string) => void
  error?: string
  editable: boolean
}) {
  return (
    <div className="rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface-2 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-atria-text-secondary">{label}</p>
          <p className="text-2xl font-semibold text-atria-ink">{displayTime}</p>
          {error && <p className="mt-1 text-sm text-atria-danger">{error}</p>}
        </div>
        {isEditing ? (
          <Input
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            disabled={!editable}
            className="w-32"
            aria-label={label}
            data-testid={label === 'I started at' ? 'start-time-input' : 'end-time-input'}
          />
        ) : (
          <button
            type="button"
            onClick={onEdit}
            disabled={!editable}
            className="min-h-[44px] rounded-full border border-atria-border bg-atria-surface px-4 text-sm font-medium text-atria-ink transition-colors hover:bg-atria-surface-2 disabled:opacity-45"
          >
            Change
          </button>
        )}
      </div>
    </div>
  )
}

function WhatStep({
  selectedServices,
  onChange,
}: {
  selectedServices: ServiceLabel[]
  onChange: (services: ServiceLabel[]) => void
}) {
  const toggle = (label: ServiceLabel) => {
    if (selectedServices.includes(label)) {
      onChange(selectedServices.filter((s) => s !== label))
    } else {
      onChange([...selectedServices, label])
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {SERVICE_OPTIONS.map((service) => {
        const selected = selectedServices.includes(service.label)
        return (
          <button
            key={service.label}
            type="button"
            onClick={() => toggle(service.label)}
            className={cn(
              'flex min-h-[88px] flex-col items-start justify-between rounded-[var(--radius-atria-lg)] border p-4 text-left transition-colors',
              selected
                ? 'border-atria-step-what bg-atria-step-what/10 text-atria-step-what'
                : 'border-atria-border bg-atria-surface-2 text-atria-ink hover:bg-atria-surface',
            )}
            data-testid={`service-option-${service.label}`}
          >
            <span className="text-2xl">{service.icon}</span>
            <span className="text-base font-medium">
              {service.label} {selected && '✓'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function HowStep({
  note,
  onChange,
  editable,
  clientName,
}: {
  note: NoteDraft
  onChange: (patch: Partial<NoteDraft>) => void
  editable: boolean
  clientName: string
}) {
  const length = note.narrative.length
  const valid = length >= 20

  const phrases = [
    '+ Bathing',
    '+ Ate well',
    '+ In good spirits',
  ]

  const appendPhrase = (phrase: string) => {
    const text = phrase.replace(/^\+ /, '')
    const separator = note.narrative.length > 0 && !note.narrative.endsWith('.') ? '. ' : ' '
    const next = note.narrative.length > 0 ? `${note.narrative}${separator}${text}` : text
    onChange({ narrative: next })
  }

  return (
    <div className="space-y-4">
      <Textarea
        value={note.narrative}
        onChange={(e) => onChange({ narrative: e.target.value })}
        placeholder={`I helped ${clientName} with her morning bath and got her dressed...`}
        disabled={!editable}
        className="min-h-[200px] border-atria-step-how focus:border-atria-step-how focus:ring-atria-step-how"
        data-testid="narrative-textarea"
      />

      {valid && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-atria-success">✓ Looking good! Nice and clear.</span>
          <span className="text-atria-text-muted">{length} characters</span>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-atria-text-secondary">Need ideas? Tap a quick phrase:</p>
        <div className="flex flex-wrap gap-2">
          {phrases.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => appendPhrase(phrase)}
              className="min-h-[36px] rounded-full border border-atria-border bg-atria-surface px-3 text-sm text-atria-ink transition-colors hover:bg-atria-surface-2"
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function GoalStep({
  selectedGoals,
  onChange,
}: {
  selectedGoals: GoalLabel[]
  onChange: (goals: GoalLabel[]) => void
}) {
  const toggle = (label: GoalLabel) => {
    if (selectedGoals.includes(label)) {
      onChange(selectedGoals.filter((g) => g !== label))
    } else {
      onChange([...selectedGoals, label])
    }
  }

  return (
    <div className="space-y-3">
      {GOAL_OPTIONS.map((goal) => {
        const selected = selectedGoals.includes(goal.label)
        return (
          <button
            key={goal.label}
            type="button"
            onClick={() => toggle(goal.label)}
            className={cn(
              'flex w-full items-center justify-between rounded-[var(--radius-atria-lg)] border p-4 text-left transition-colors',
              selected
                ? 'border-atria-step-goal bg-atria-step-goal/10'
                : 'border-atria-border bg-atria-surface-2 hover:bg-atria-surface',
            )}
            data-testid={`goal-option-${goal.label}`}
          >
            <div>
              <p className={cn('text-base font-semibold', selected ? 'text-atria-step-goal' : 'text-atria-ink')}>
                {goal.label}
              </p>
              <p className="text-sm text-atria-text-secondary">Goal: {goal.goal}</p>
            </div>
            <span className={cn('text-xl', selected ? 'text-atria-step-goal' : 'text-atria-text-muted')}>
              {selected ? '✓' : '○'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function IssuesStep<TaskId extends string>({
  issueChoice,
  onChange,
  clerkOrgId,
  editable,
  taskDrafts,
  tasks,
  onTaskDraftsChange,
}: {
  issueChoice: IssueChoice | null
  onChange: (choice: IssueChoice) => void
  clerkOrgId: string
  editable: boolean
  taskDrafts: TaskDraft<TaskId>[]
  tasks: LoadedTask<TaskId>[]
  onTaskDraftsChange: Dispatch<SetStateAction<TaskDraft<TaskId>[]>>
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => onChange(ISSUE_CHOICE_NO)}
          className={cn(
            'flex items-start gap-4 rounded-[var(--radius-atria-lg)] border p-4 text-left transition-colors',
            issueChoice === ISSUE_CHOICE_NO
              ? 'border-atria-success bg-atria-success-bg'
              : 'border-atria-border bg-atria-surface-2 hover:bg-atria-surface',
          )}
          data-testid="issue-choice-no"
        >
          <span className="text-2xl">😊</span>
          <div className="min-w-0 flex-1">
            <p className={cn('text-base font-semibold', issueChoice === ISSUE_CHOICE_NO ? 'text-atria-success' : 'text-atria-ink')}>
              No, all good today
            </p>
            <p className="text-sm text-atria-text-secondary">Everything went fine</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange(ISSUE_CHOICE_YES)}
          className={cn(
            'flex items-start gap-4 rounded-[var(--radius-atria-lg)] border p-4 text-left transition-colors',
            issueChoice === ISSUE_CHOICE_YES
              ? 'border-atria-danger bg-atria-danger-bg'
              : 'border-atria-border bg-atria-surface-2 hover:bg-atria-surface',
          )}
          data-testid="issue-choice-yes"
        >
          <span className="text-2xl">⚠️</span>
          <div className="min-w-0 flex-1">
            <p className={cn('text-base font-semibold', issueChoice === ISSUE_CHOICE_YES ? 'text-atria-danger' : 'text-atria-ink')}>
              Yes, I need to report something
            </p>
            <p className="text-sm text-atria-text-secondary">A fall, pain, mood change, or other concern</p>
          </div>
        </button>
      </div>

      <ShiftTaskList
        clerkOrgId={clerkOrgId}
        editable={editable}
        taskUpdates={taskDrafts}
        tasks={tasks}
        onChange={onTaskDraftsChange}
      />
    </div>
  )
}

function DoneStep({
  note,
  selectedServices,
  selectedGoals,
  issueChoice,
  confirmed,
  onConfirmedChange,
  onEditStep,
}: {
  note: NoteDraft
  selectedServices: ServiceLabel[]
  selectedGoals: GoalLabel[]
  issueChoice: IssueChoice | null
  confirmed: boolean
  onConfirmedChange: (confirmed: boolean) => void
  onEditStep?: (stepIndex: number) => void
}) {
  const serviceParts: string[] = [...selectedServices]
  for (const goal of selectedGoals) {
    serviceParts.push(`${goal} goal`)
  }

  const MAX_REVIEW_SERVICES = 3
  const reviewServices =
    serviceParts.length > MAX_REVIEW_SERVICES
      ? `${serviceParts.slice(0, MAX_REVIEW_SERVICES).join(' · ')} · +${serviceParts.length - MAX_REVIEW_SERVICES} more`
      : serviceParts.join(' · ')

  const issueText =
    issueChoice === ISSUE_CHOICE_NO
      ? '✓ No problems — all good today'
      : issueChoice === ISSUE_CHOICE_YES
        ? '⚠️ Reported: A fall, pain, mood change, or other concern'
        : '—'

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface-2 p-4">
        <ReviewRow
          label="Time"
          value={
            note.startTime && note.endTime
              ? `${formatTime(`2026-06-25T${note.startTime}:00`)} – ${formatTime(`2026-06-25T${note.endTime}:00`)}`
              : '—'
          }
          onEdit={() => onEditStep?.(0)}
        />
        <ReviewRow
          label="What you helped with"
          value={serviceParts.length > 0 ? reviewServices : '—'}
          onEdit={() => onEditStep?.(1)}
        />
        <ReviewRow
          label="Your notes"
          value={note.narrative ? `“${note.narrative}”` : '—'}
          valueClassName="line-clamp-1"
          onEdit={() => onEditStep?.(2)}
        />
        <ReviewRow
          label="Issues"
          value={issueText}
          onEdit={() => onEditStep?.(4)}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4">
        <Checkbox
          checked={confirmed}
          onChange={(e) => onConfirmedChange(e.target.checked)}
          className="mt-0.5 h-5 w-5"
          data-testid="confirm-checkbox"
        />
        <span className="text-base text-atria-ink">
          I confirm this is accurate and true.
        </span>
      </label>
    </div>
  )
}

function ReviewRow({
  label,
  value,
  valueClassName,
  onEdit,
}: {
  label: string
  value: string
  valueClassName?: string
  onEdit?: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-atria-text-muted">
          {label}
        </p>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-sm font-medium text-atria-step-done hover:underline"
          >
            Edit
          </button>
        )}
      </div>
      <p className={cn('mt-1 text-base text-atria-ink', valueClassName)}>{value}</p>
    </div>
  )
}
