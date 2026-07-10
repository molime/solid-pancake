import { Toast } from '@/shared/ui/Toast'
import type { HrToast as HrToastState } from '../hooks/useHrToast'

export function HrToast({
  toast,
  onClose,
}: {
  toast: HrToastState
  onClose: () => void
}) {
  if (!toast.visible) return null

  return (
    <div className="fixed right-4 top-4 z-50 w-full max-w-sm">
      <Toast
        variant={toast.variant}
        title={toast.title}
        description={toast.description}
        onClose={onClose}
      />
    </div>
  )
}
