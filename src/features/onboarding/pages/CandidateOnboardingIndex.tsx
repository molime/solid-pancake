import { useEffect } from 'react'
import { AppLoader } from '@/shared/ui/AppLoader'
import { isPlatformTrainingComplete } from '@/features/onboarding/model/trainingCompletion'
import { useNavigate } from 'react-router-dom'
import { useTenant } from '@/app/useTenant'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'

export function CandidateOnboardingIndex() {
  const navigate = useNavigate()
  const { clerkOrgId, isLoading } = useTenant()
  const data = useQuery(api.candidates.getMyApplication, clerkOrgId ? { clerkOrgId } : 'skip')
  const candidate = useQuery(api.candidates.getCandidateProfile, clerkOrgId ? { clerkOrgId } : 'skip')
  const completions = useQuery(
    api.platformTrainingCompletions.listMyCompletions,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const hasFullPlatform = useQuery(
    api.agencyConfig.hasProduct,
    clerkOrgId ? { clerkOrgId, productKey: 'full_platform' } : 'skip',
  )

  useEffect(() => {
    if (!data || !clerkOrgId) return

    if (candidate?.requiresPasswordChange) {
      navigate('/onboarding/profile?forcePasswordChange=true', { replace: true })
      return
    }

    const status = data.candidate?.status ?? 'invited'

    if (status === 'invited' || status === 'new' || status === 'application_draft') {
      navigate('/onboarding/application', { replace: true })
      return
    }

    if (status === 'offer_sent') {
      navigate('/onboarding/offer', { replace: true })
      return
    }

    if (status === 'hired') {
      if (isPlatformTrainingComplete(completions)) {
        // Check if agency has full_platform product
        if (hasFullPlatform === false) {
          // Hiring-only agency — show success screen, not caregiver dashboard
          navigate('/onboarding/success', { replace: true })
        } else {
          navigate('/caregiver/today', { replace: true })
        }
      } else {
        navigate('/onboarding/training', { replace: true })
      }
      return
    }

    // applied, hr_review, accepted, rejected, withdrawn -> show onboarding checklist page
    navigate('/onboarding/checklist', { replace: true })
  }, [data, clerkOrgId, navigate, completions, candidate, hasFullPlatform])

  if (isLoading || !clerkOrgId) return <AppLoader fullScreen />
  return <AppLoader fullScreen />
}
