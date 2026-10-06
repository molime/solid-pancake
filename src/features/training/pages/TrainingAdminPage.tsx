import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenant } from '@/app/useTenant'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { AppLoader } from '@/shared/ui/AppLoader'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { cn } from '@/shared/lib/cn'
import { ExternalTrainingAdminCard } from '../components/ExternalTrainingAdminCard'
import type { TrainingStep } from '../model/courseTypes'
import {
  CATEGORY_LABELS,
} from '../model/courseTypes'

const STEP_TYPE_OPTIONS: {
  value: TrainingStep['type']
  label: string
}[] = [
  { value: 'text', label: 'Text' },
  { value: 'policy', label: 'Policy' },
  { value: 'video', label: 'Video (URL)' },
  { value: 'image', label: 'Image (URL)' },
]

function makeEmptyStep(index: number): TrainingStep {
  return {
    id: `step-${index + 1}`,
    title: '',
    type: 'text',
    content: '',
    required: true,
  }
}

export function TrainingAdminPage() {
  const navigate = useNavigate()
  const { clerkOrgId } = useTenant()
  const courses = useQuery(
    api.training.listAllCourses,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const createCourse = useMutation(api.training.createCourse)
  const toggleCourse = useMutation(api.training.toggleCourse)
  const deleteCourse = useMutation(api.training.deleteCourse)
  const seedDefaults = useMutation(api.training.seedDefaultCourses)
  const [assigningFor, setAssigningFor] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] =
    useState<TrainingCourseCategory>('agency_onboarding')
  const [durationMinutes, setDurationMinutes] = useState('60')
  const [passingScore, setPassingScore] = useState('80')
  const [steps, setSteps] = useState<TrainingStep[]>([makeEmptyStep(0)])

  const updateStep = (index: number, patch: Partial<TrainingStep>) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    )
  }

  const moveStep = (index: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  type TrainingCourseCategory =
    | 'agency_onboarding'
    | 'regulatory'
    | 'safety'
    | 'skills'
    | 'other'

  if (!clerkOrgId || courses === undefined) {
    return <AppLoader fullScreen label="Loading admin..." />
  }

  const handleSeed = async () => {
    if (!clerkOrgId) return
    setBusy(true)
    setError('')
    try {
      await seedDefaults({ clerkOrgId })
    } catch (err) {
      setError(err instanceof Error ? sanitizeConvexError(err.message) : 'Seed failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = async () => {
    if (!clerkOrgId) return
    setError('')

    if (!title.trim()) {
      setError('Title is required.')
      return
    }

    if (!steps.length) {
      setError('Add at least one step.')
      return
    }
    for (const [i, s] of steps.entries()) {
      if (!s.title.trim()) {
        setError(`Step ${i + 1}: title is required.`)
        return
      }
      if (!s.content.trim()) {
        setError(
          `Step ${i + 1}: ${s.type === 'video' || s.type === 'image' ? 'media URL' : 'content'} is required.`,
        )
        return
      }
    }
    // Re-number step ids to match the final order before saving.
    const orderedSteps: TrainingStep[] = steps.map((s, i) => ({
      ...s,
      id: `step-${i + 1}`,
      title: s.title.trim(),
      content: s.content.trim(),
    }))

    const duration = Number(durationMinutes)
    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Duration must be a positive number of minutes.')
      return
    }

    const score = Number(passingScore)
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError('Passing score must be between 0 and 100.')
      return
    }

    setBusy(true)
    try {
      await createCourse({
        clerkOrgId,
        title: title.trim(),
        description: description.trim(),
        category,
        durationMinutes: duration,
        steps: orderedSteps,
        passingScore: score,
      })
      setShowForm(false)
      setTitle('')
      setDescription('')
      setDurationMinutes('60')
      setPassingScore('80')
      setSteps([makeEmptyStep(0)])
    } catch (err) {
      setError(err instanceof Error ? sanitizeConvexError(err.message) : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = async (courseId: string, active: boolean) => {
    if (!clerkOrgId) return
    try {
      await toggleCourse({ clerkOrgId, courseId: courseId as Id<'trainingCourses'>, active })
    } catch (err) {
      setError(err instanceof Error ? sanitizeConvexError(err.message) : 'Toggle failed')
    }
  }

  const handleDelete = async (courseId: string) => {
    if (!clerkOrgId) return
    if (!confirm('Delete this course? This cannot be undone.')) return
    try {
      await deleteCourse({ clerkOrgId, courseId: courseId as Id<'trainingCourses'> })
    } catch (err) {
      setError(err instanceof Error ? sanitizeConvexError(err.message) : 'Delete failed')
    }
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-atria-ink">Training Admin</h1>
          <p className="text-base text-atria-text-secondary">
            Create and manage courses for your agency.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSeed} disabled={busy}>
            Seed defaults
          </Button>
          <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : 'New course'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-atria-md)] border border-atria-danger/30 bg-atria-danger-bg p-3 text-sm text-atria-danger">
          {error}
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create course</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-atria-ink">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Course title"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-atria-ink">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-atria-ink">Category</label>
                <Select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as TrainingCourseCategory)
                  }
                >
                  <option value="agency_onboarding">Agency Onboarding</option>
                  <option value="regulatory">Regulatory Compliance</option>
                  <option value="safety">Safety & Emergency</option>
                  <option value="skills">Care Skills</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-atria-ink">Duration (minutes)</label>
                <Input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-atria-ink">Passing score (%)</label>
                <Input
                  type="number"
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-atria-ink">Steps</label>
              <p className="text-xs text-atria-text-muted">
                Add steps one by one. Text and policy steps show written
                content; video and image steps take a media URL.
              </p>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-atria-text-muted">
                        Step {i + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={i === 0}
                          onClick={() => moveStep(i, -1)}
                          aria-label="Move step up"
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={i === steps.length - 1}
                          onClick={() => moveStep(i, 1)}
                          aria-label="Move step down"
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={steps.length === 1}
                          onClick={() => removeStep(i)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
                      <Input
                        value={step.title}
                        onChange={(e) => updateStep(i, { title: e.target.value })}
                        placeholder="Step title"
                      />
                      <Select
                        value={step.type}
                        onChange={(e) =>
                          updateStep(i, {
                            type: e.target.value as TrainingStep['type'],
                          })
                        }
                        aria-label="Step type"
                      >
                        {STEP_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {step.type === 'video' || step.type === 'image' ? (
                      <Input
                        value={step.content}
                        onChange={(e) =>
                          updateStep(i, { content: e.target.value })
                        }
                        placeholder={
                          step.type === 'video'
                            ? 'Video URL (e.g. https://youtube.com/watch?v=…)'
                            : 'Image URL (https://…)'
                        }
                      />
                    ) : (
                      <textarea
                        value={step.content}
                        onChange={(e) =>
                          updateStep(i, { content: e.target.value })
                        }
                        placeholder="Step content. Separate paragraphs with a blank line to create cards."
                        rows={4}
                        className="w-full rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface p-3 text-sm text-atria-ink outline-none focus:border-atria-accent"
                      />
                    )}
                    <label className="flex items-center gap-2 text-sm text-atria-text-secondary">
                      <Checkbox
                        checked={step.required}
                        onChange={(e) =>
                          updateStep(i, { required: e.target.checked })
                        }
                      />
                      Required to complete the course
                    </label>
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSteps((prev) => [...prev, makeEmptyStep(prev.length)])}
              >
                + Add step
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreate} disabled={busy}>
                Create course
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {clerkOrgId && <ExternalTrainingAdminCard clerkOrgId={clerkOrgId} />}

      <div className="space-y-3">
        {(courses ?? []).map((course) => (
          <Card key={course._id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      course.active
                        ? 'bg-atria-success-bg text-atria-success'
                        : 'bg-atria-neutral-bg text-atria-neutral',
                    )}
                  >
                    {course.active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-atria-text-muted">
                    {CATEGORY_LABELS[course.category]}
                  </span>
                </div>
                <h3 className="font-semibold text-atria-ink">{course.title}</h3>
                <p className="text-sm text-atria-text-secondary">
                  {course.description}
                </p>
                <p className="text-xs text-atria-text-muted">
                  {course.durationMinutes} min · {course.steps.length} steps ·{' '}
                  {course.passingScore}% to pass
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    navigate(`/training/${course._id}`, { replace: false })
                  }
                >
                  Preview
                </Button>
                <Button
                  variant={assigningFor === course._id ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() =>
                    setAssigningFor(assigningFor === course._id ? null : course._id)
                  }
                >
                  Assign
                </Button>
                <Button
                  variant={course.active ? 'ghost' : 'primary'}
                  size="sm"
                  onClick={() => handleToggle(course._id, !course.active)}
                >
                  {course.active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(course._id)}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
            {assigningFor === course._id && clerkOrgId && (
              <AssignPanel clerkOrgId={clerkOrgId} courseId={course._id} />
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

/** Assign a course to a member (with optional due date) + current assignees. */
function AssignPanel({
  clerkOrgId,
  courseId,
}: {
  clerkOrgId: string
  courseId: Id<'trainingCourses'>
}) {
  const members = useQuery(api.members.list, { clerkOrgId })
  const assignments = useQuery(api.training.listCourseAssignments, {
    clerkOrgId,
    courseId,
  })
  const assignTraining = useMutation(api.training.assignTraining)
  const unassignTraining = useMutation(api.training.unassignTraining)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dueAt, setDueAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const assignedIds = new Set(
    (assignments ?? []).map((a) => a.clerkUserId as string),
  )
  const availableMembers = (members ?? []).filter(
    (m: { clerkUserId: string; displayName: string }) =>
      !assignedIds.has(m.clerkUserId),
  )
  const visibleMembers = availableMembers.filter(
    (m: { clerkUserId: string; displayName: string }) =>
      m.displayName.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const toggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleAssign = async () => {
    if (!selectedIds.length) return
    setBusy(true)
    setError('')
    try {
      for (const clerkUserId of selectedIds) {
        await assignTraining({
          clerkOrgId,
          courseId,
          clerkUserId,
          dueAt: dueAt || undefined,
        })
      }
      setSelectedIds([])
      setDueAt('')
    } catch (err) {
      setError(
        err instanceof Error ? sanitizeConvexError(err.message) : 'Assign failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-atria-border px-4 py-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
            Members
          </label>
          <div className="w-72 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-atria-ink"
              onClick={() => setPickerOpen((o) => !o)}
            >
              <span>
                {selectedIds.length
                  ? `${selectedIds.length} selected`
                  : 'Select members…'}
              </span>
              <span className="text-atria-text-muted">
                {pickerOpen ? '▴' : '▾'}
              </span>
            </button>
            {pickerOpen && (
              <div className="space-y-2 border-t border-atria-border p-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="h-8 text-sm"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="text-xs font-medium text-atria-accent hover:underline"
                    onClick={() =>
                      setSelectedIds(
                        visibleMembers.map(
                          (m: { clerkUserId: string }) => m.clerkUserId,
                        ),
                      )
                    }
                  >
                    Select all visible
                  </button>
                  <span className="text-xs text-atria-text-muted">
                    {visibleMembers.length} of {availableMembers.length}
                  </span>
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {visibleMembers.map(
                    (m: { clerkUserId: string; displayName: string }) => (
                      <label
                        key={m.clerkUserId}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-atria-ink hover:bg-atria-surface-2"
                      >
                        <Checkbox
                          checked={selectedIds.includes(m.clerkUserId)}
                          onChange={() => toggleMember(m.clerkUserId)}
                        />
                        {m.displayName}
                      </label>
                    ),
                  )}
                  {!visibleMembers.length && (
                    <p className="px-1 py-1 text-xs text-atria-text-muted">
                      No members match.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-atria-text-muted">
            Due date (optional)
          </label>
          <Input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-40"
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleAssign}
          disabled={busy || !selectedIds.length}
        >
          {busy ? 'Assigning…' : 'Assign training'}
        </Button>
        {error && <p className="text-xs text-atria-danger">{error}</p>}
      </div>
      {assignments && assignments.length > 0 && (
        <ul className="space-y-1">
          {assignments.map((a) => (
            <li
              key={a._id}
              className="flex items-center justify-between gap-2 text-sm text-atria-text-secondary"
            >
              <span>
                {a.memberName}
                {a.dueAt ? ` · due ${a.dueAt}` : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  unassignTraining({ clerkOrgId, assignmentId: a._id })
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-atria-text-muted">
        Assigned members get a notification and see the course in their hub even
        if their role doesn&apos;t include it.
      </p>
    </div>
  )
}
