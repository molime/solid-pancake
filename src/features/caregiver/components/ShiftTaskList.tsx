import type { Dispatch, SetStateAction } from 'react'
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { TaskDraft } from '../model/documentationDraft'
import { updateTaskDraft } from '../model/documentationDraft'
import { Input } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { X, Upload, FileCheck } from 'lucide-react'

export interface ShiftTaskListItem<TaskId extends string = string> {
  _id: TaskId
  title: string
  requiredProof: boolean
}

export function ShiftTaskList<TaskId extends string>({
  clerkOrgId,
  editable,
  onChange,
  taskUpdates,
  tasks,
}: {
  clerkOrgId: string
  editable: boolean
  onChange: Dispatch<SetStateAction<TaskDraft<TaskId>[]>>
  taskUpdates: TaskDraft<TaskId>[]
  tasks: ShiftTaskListItem<TaskId>[]
}) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const attachProof = useMutation(api.files.attachProof)
  const removeProof = useMutation(api.files.removeProof)
  const [uploadingTaskId, setUploadingTaskId] = useState<TaskId | null>(null)

  const handleFileSelect = async (taskId: TaskId, file: File) => {
    if (!file) return
    setUploadingTaskId(taskId)

    try {
      const { url } = await generateUploadUrl({ clerkOrgId })

      const uploadRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error('Upload failed')
      }

      const { storageId } = (await uploadRes.json()) as { storageId: string }

      await attachProof({
        clerkOrgId,
        shiftTaskId: taskId as unknown as import('../../../../convex/_generated/dataModel').Id<'shiftTasks'>,
        storageId,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      })

      onChange((prev) =>
        updateTaskDraft(prev, taskId, {
          proofUrl: storageId,
          proofName: file.name,
        }),
      )
    } catch (err) {
      console.error('Upload error:', err)
      alert(err instanceof Error ? sanitizeConvexError(err.message) : 'Upload failed')
    } finally {
      setUploadingTaskId(null)
    }
  }

  const handleRemove = async (taskId: TaskId) => {
    try {
      await removeProof({
        clerkOrgId,
        shiftTaskId: taskId as unknown as import('../../../../convex/_generated/dataModel').Id<'shiftTasks'>,
      })
      onChange((prev) =>
        updateTaskDraft(prev, taskId, {
          proofUrl: undefined,
          proofName: undefined,
        }),
      )
    } catch (err) {
      console.error('Remove error:', err)
      alert(err instanceof Error ? sanitizeConvexError(err.message) : 'Remove failed')
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-base font-medium text-atria-ink">Tasks</h4>
      <div className="space-y-3">
        {tasks.map((task) => {
          const draft = taskUpdates.find((item) => item.taskId === task._id)
          const isComplete = draft?.status === 'complete'
          const proofName = draft?.proofName
          const isUploading = uploadingTaskId === task._id

          return (
            <div
              key={task._id}
              className="flex gap-3 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-3"
            >
              <Checkbox
                checked={isComplete}
                onChange={(e) =>
                  onChange((prev) =>
                    updateTaskDraft(prev, task._id, {
                      status: e.target.checked ? 'complete' : 'pending',
                    }),
                  )
                }
                disabled={!editable}
                className="mt-1 h-6 w-6 shrink-0 rounded-md"
                aria-label={`Mark ${task.title} complete`}
                data-testid={`task-complete-checkbox-${task._id}`}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="text-base text-atria-ink">{task.title}</p>
                  {task.requiredProof && (
                    <p className="mt-0.5 text-sm text-atria-danger">
                      Proof required
                    </p>
                  )}
                </div>
                {task.requiredProof && editable && (
                  <div>
                    {proofName ? (
                      <div className="flex items-center gap-2 rounded-[var(--radius-atria-md)] bg-atria-success-bg px-3 py-2">
                        <FileCheck className="h-5 w-5 shrink-0 text-atria-success" />
                        <span className="flex-1 truncate text-base text-atria-ink">
                          {proofName}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0"
                          onClick={() => handleRemove(task._id)}
                          disabled={isUploading}
                          aria-label={`Remove ${proofName}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[var(--radius-atria-md)] border border-dashed border-atria-border px-3 py-2 text-base text-atria-text-secondary transition-colors hover:border-atria-accent hover:text-atria-ink">
                        <Input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileSelect(task._id, file)
                            e.target.value = ''
                          }}
                          disabled={isUploading}
                          data-testid={`task-proof-input-${task._id}`}
                        />
                        <Upload className="h-5 w-5 shrink-0" />
                        {isUploading ? 'Uploading…' : 'Upload proof'}
                      </label>
                    )}
                  </div>
                )}
                {task.requiredProof && !editable && proofName && (
                  <div className="flex items-center gap-2 rounded-[var(--radius-atria-md)] bg-atria-success-bg px-3 py-2">
                    <FileCheck className="h-5 w-5 shrink-0 text-atria-success" />
                    <span className="truncate text-base text-atria-ink">
                      {proofName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
