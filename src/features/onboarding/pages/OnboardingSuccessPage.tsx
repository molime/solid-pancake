import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLoader } from '@/shared/ui/AppLoader'

export function OnboardingSuccessPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // Always redirect to the caregiver dashboard after training
    navigate('/caregiver/today', { replace: true })
  }, [navigate])

  return <AppLoader fullScreen />
}
