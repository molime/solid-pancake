import { useEffect } from 'react'
import { AppLoader } from '@/shared/ui/AppLoader'
import { isPlatformTrainingComplete } from '@/features/onboarding/model/trainingCompletion'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'

export function CandidateOnboardingIndex() {
  const navigate = useNavigate()
  const { organization, isLoaded } = useOrganization()
  const clerkOrgId = organization?.id
  const data = useQuery(api.candidates.getMyApplication, clerkOrgId ? { clerkOrgId } : 'skip')
  const candidate = useQuery(api.candidates.getCandidateProfile, clerkOrgId ? { clerkOrgId } : 'skip')
  const completions = useQuery(
    api.platformTrainingCompletions.listMyCompletions,
    clerkOrgId ? { clerkOrgId } : 'skip',
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
        navigate('/caregiver/today', { replace: true })
      } else {
        navigate('/onboarding/training', { replace: true })
      }
      return
    }

    // applied, hr_review, accepted, rejected, withdrawn -> show onboarding checklist page
    navigate('/onboarding/checklist', { replace: true })
  }, [data, clerkOrgId, navigate, completions, candidate])

  if (!isLoaded || !clerkOrgId) return <AppLoader fullScreen />
  return <AppLoader fullScreen />
}
