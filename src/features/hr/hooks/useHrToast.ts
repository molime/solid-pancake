import { useState, useCallback } from 'react'
import type { ToastVariant } from '@/shared/ui/Toast'

export interface HrToast {
  visible: boolean
  variant: ToastVariant
  title: string
  description?: string
}

export function useHrToast() {
  const [toast, setToast] = useState<HrToast>({
    visible: false,
    variant: 'neutral',
    title: '',
  })

  const show = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      setToast({ visible: true, variant, title, description })
    },
    [],
  )

  const hide = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }))
  }, [])

  return { toast, show, hide }
}
