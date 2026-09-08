import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenant } from '@/app/useTenant'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { AppLoader } from '@/shared/ui/AppLoader'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { cn } from '@/shared/lib/cn'
import type { TrainingStep } from '../model/courseTypes'
import {
  CATEGORY_LABELS,
} from '../model/courseTypes'

const EMPTY_STEP: TrainingStep = {
  id: 'step-1',
  title: 'Introduction',
  type: 'text',
  content:
    'Replace this placeholder with your first training step. You can use text, video, image, policy, embed, or quiz steps.',
  required: true,
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

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [courseKey, setCourseKey] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] =
    useState<TrainingCourseCategory>('agency_onboarding')
  const [durationMinutes, setDurationMinutes] = useState('60')
  const [passingScore, setPassingScore] = useState('80')
  const [stepsJson, setStepsJson] = useState(
    JSON.stringify([EMPTY_STEP], null, 2),
  )

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

    let steps: TrainingStep[]
    try {
      steps = JSON.parse(stepsJson)
      if (!Array.isArray(steps) || !steps.length) {
        throw new Error('Steps must be a non-empty array.')
      }
      for (const s of steps) {
        if (
          !s.id?.trim() ||
          !s.title?.trim() ||
          !s.type?.trim() ||
          typeof s.content !== 'string'
        ) {
          throw new Error(`Invalid step: ${JSON.stringify(s)}`)
        }
      }
    } catch (err) {
      setError(
        `Invalid steps JSON: ${err instanceof Error ? err.message : String(err)}`,
      )
      return
    }

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
        courseKey: courseKey.trim(),
        title: title.trim(),
        description: description.trim(),
        category,
        durationMinutes: duration,
        steps,
        passingScore: score,
      })
      setShowForm(false)
      setCourseKey('')
      setTitle('')
      setDescription('')
      setDurationMinutes('60')
      setPassingScore('80')
      setStepsJson(JSON.stringify([EMPTY_STEP], null, 2))
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-atria-ink">Course key</label>
                <Input
                  value={courseKey}
                  onChange={(e) => setCourseKey(e.target.value)}
                  placeholder="e.g. golden_ages_onboarding"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-atria-ink">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Course title"
                />
              </div>
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-atria-ink">Steps JSON</label>
              <textarea
                value={stepsJson}
                onChange={(e) => setStepsJson(e.target.value)}
                rows={12}
                className="w-full rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-3 font-mono text-sm text-atria-ink outline-none focus:border-atria-accent"
              />
              <p className="text-xs text-atria-text-muted">
                Each step needs: id, title, type (text|policy|video|image|embed|quiz),
                content, and required (boolean). For quiz steps, content is JSON with
                a &quot;questions&quot; array.
              </p>
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
          </Card>
        ))}
      </div>
    </div>
  )
}
