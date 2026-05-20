import type { Dispatch, SetStateAction } from 'react'
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { TaskDraft } from '../model/documentationDraft'
import { updateTaskDraft } from '../model/documentationDraft'
import { Input } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
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
      alert(err instanceof Error ? err.message : 'Upload failed')
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
      alert(err instanceof Error ? err.message : 'Remove failed')
    }
  }

  return (
    <div>
      <h4 className="text-sm font-medium text-atria-ink mb-2">Tasks</h4>
      <div className="space-y-2">
        {tasks.map((task) => {
          const draft = taskUpdates.find((item) => item.taskId === task._id)
          const isComplete = draft?.status === 'complete'
          const proofName = draft?.proofName
          const isUploading = uploadingTaskId === task._id

          return (
            <div
              key={task._id}
              className="grid gap-3 rounded-md border border-atria-border p-3 sm:grid-cols-[auto_1fr]"
            >
              <input
                type="checkbox"
                checked={isComplete}
                onChange={(e) =>
                  onChange((prev) =>
                    updateTaskDraft(prev, task._id, {
                      status: e.target.checked ? 'complete' : 'pending',
                    }),
                  )
                }
                disabled={!editable}
                className="mt-0.5 h-4 w-4 rounded border-atria-border text-atria-accent focus:ring-atria-accent"
              />
              <div className="min-w-0 space-y-2">
                <div>
                  <p className="text-sm text-atria-ink">{task.title}</p>
                  {task.requiredProof && (
                    <p className="mt-0.5 text-xs text-atria-danger">
                      Proof required
                    </p>
                  )}
                </div>
                {task.requiredProof && editable && (
                  <div>
                    {proofName ? (
                      <div className="flex items-center gap-2 rounded-md bg-atria-success-bg px-3 py-2">
                        <FileCheck className="h-4 w-4 text-atria-success shrink-0" />
                        <span className="text-sm text-atria-ink truncate flex-1">
                          {proofName}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(task._id)}
                          disabled={isUploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileSelect(task._id, file)
                            e.target.value = ''
                          }}
                          disabled={isUploading}
                        />
                        <div className="flex items-center gap-2 rounded-md border border-dashed border-atria-border px-3 py-2 text-sm text-atria-muted hover:border-atria-accent hover:text-atria-ink transition-colors">
                          <Upload className="h-4 w-4" />
                          {isUploading ? 'Uploading…' : 'Upload proof'}
                        </div>
                      </label>
                    )}
                  </div>
                )}
                {task.requiredProof && !editable && proofName && (
                  <div className="flex items-center gap-2 rounded-md bg-atria-success-bg px-3 py-2">
                    <FileCheck className="h-4 w-4 text-atria-success shrink-0" />
                    <span className="text-sm text-atria-ink truncate">
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
