import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'

export function CandidateOnboardingIndex() {
  const navigate = useNavigate()
  const { organization, isLoaded } = useOrganization()
  const clerkOrgId = organization?.id
  const data = useQuery(api.candidates.getMyApplication, clerkOrgId ? { clerkOrgId } : 'skip')

  useEffect(() => {
    if (!data || !clerkOrgId) return
    const status = data.candidate?.status ?? 'invited'

    if (status === 'invited' || status === 'new' || status === 'application_draft') {
      navigate('/onboarding/application', { replace: true })
      return
    }

    if (status === 'offer_sent') {
      navigate('/onboarding/offer', { replace: true })
      return
    }

    // applied, hr_review, accepted, hired, rejected, withdrawn -> show checklist
    navigate('/onboarding/checklist', { replace: true })
  }, [data, clerkOrgId, navigate])

  if (!isLoaded || !clerkOrgId) return null
  return null
}
