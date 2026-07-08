import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { candidateStatusPill } from '@/features/hr/lib/candidateStatus'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function CandidateProfilePage() {
  const navigate = useNavigate()
  const { organization, isLoaded } = useOrganization()
  const clerkOrgId = organization?.id
  const candidate = useQuery(api.candidates.getCandidateProfile, clerkOrgId ? { clerkOrgId } : 'skip')
  const application = useQuery(api.candidates.getMyApplication, clerkOrgId ? { clerkOrgId } : 'skip')

  if (!isLoaded || !clerkOrgId) return null

  const appFields = application?.application?.fields ?? {}
  const status = candidate?.status ?? 'invited'
  const pill = candidateStatusPill(status)
  const displayName = candidate?.displayName ?? ''

  const rows = [
    { label: 'Full name', value: displayName },
    { label: 'Email', value: candidate?.email ?? '' },
    { label: 'Phone', value: candidate?.phone ?? '' },
    { label: 'Position', value: (appFields.position as string) ?? 'Caregiver' },
  ]

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[520px]'>
        <CardContent className='p-8'>
          <button
            className='mb-4 text-sm text-atria-text-secondary hover:text-atria-ink'
            onClick={() => navigate('/onboarding/checklist')}
          >
            {String.fromCharCode(8592)} Back to checklist
          </button>

          <div className='mb-6 flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-[var(--radius-atria-md)] bg-atria-accent text-atria-on-accent'>
              <span className='text-lg font-bold'>A</span>
            </div>
            <div>
              <p className='text-lg font-semibold leading-none text-atria-ink'>ATRIA-X</p>
              <p className='text-sm text-atria-text-secondary'>Caregiver Portal</p>
            </div>
          </div>

          <h1 className='mb-6 text-2xl font-semibold text-atria-ink'>My Profile</h1>

          <div className='mb-8 flex flex-col items-center text-center'>
            <div className='mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-atria-accent text-2xl font-semibold text-atria-on-accent'>
              {initials(displayName)}
            </div>
            <p className='text-lg font-semibold text-atria-ink'>{displayName || 'Candidate'}</p>
            <p className='text-sm text-atria-text-secondary'>
              Applying for {(appFields.position as string) ?? 'Caregiver'}
            </p>
            <div className='mt-3'>
              <StatusBadge variant={pill.variant}>{pill.label}</StatusBadge>
            </div>
          </div>

          <div className='flex flex-col gap-0'>
            {rows.map((row, idx) => (
              <div
                key={row.label}
                className={
                  idx !== rows.length - 1
                    ? 'border-b border-atria-border py-4 first:pt-0'
                    : 'py-4 first:pt-0'
                }
              >
                <p className='text-xs font-semibold uppercase tracking-wide text-atria-text-muted'>{row.label}</p>
                <p className='mt-1 text-base text-atria-ink'>{row.value || '—'}</p>
              </div>
            ))}
          </div>

          <Button
            variant='secondary'
            size='lg'
            className='mt-6 w-full'
            onClick={() => navigate('/onboarding/checklist')}
          >
            Back to checklist {String.fromCharCode(8594)}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
