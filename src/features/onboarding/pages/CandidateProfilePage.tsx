import { useTenant } from '@/app/useTenant'
import { useQuery } from 'convex/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useClerk } from '@clerk/react'
import { api } from '../../../../convex/_generated/api'
import { Card, CardContent } from '@/shared/ui/Card'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { candidateStatusPill } from '@/features/hr/lib/candidateStatus'
import { ChangePasswordSection } from '../components/ChangePasswordSection'

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
  const { signOut } = useClerk()
  const [searchParams, setSearchParams] = useSearchParams()
  const { clerkOrgId, isLoading } = useTenant()
  const candidate = useQuery(api.candidates.getCandidateProfile, clerkOrgId ? { clerkOrgId } : 'skip')
  const application = useQuery(api.candidates.getMyApplication, clerkOrgId ? { clerkOrgId } : 'skip')

  const forcePasswordChange =
    searchParams.get('forcePasswordChange') === 'true' || candidate?.requiresPasswordChange === true

  if (isLoading || !clerkOrgId) return null

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
          {!forcePasswordChange && (
            <button
              className='mb-4 text-sm text-atria-text-secondary hover:text-atria-ink'
              onClick={() => navigate('/onboarding/checklist')}
            >
              {String.fromCharCode(8592)} Back to checklist
            </button>
          )}

          <div className='mb-6 flex flex-col items-center text-center'>
            <AtriaLogo />
            <p className='mt-2 text-sm text-atria-text-secondary'>Onboarding</p>
            <button
              type='button'
              onClick={() => signOut(() => navigate('/sign-in'))}
              className='mt-2 text-xs text-atria-text-muted hover:text-atria-ink hover:underline'
            >
              Sign out
            </button>
          </div>

          <h1 className='mb-6 text-xl font-semibold text-atria-ink'>My Profile</h1>

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

          {!forcePasswordChange && (
            <p className='mt-6 text-center text-sm text-atria-accent'>
              Need to update something? Tap Edit above {String.fromCharCode(8594)}
            </p>
          )}

          <div className="mt-8 border-t border-atria-border pt-6">
            {!forcePasswordChange && <h2 className="mb-4 text-lg font-semibold text-atria-ink">Security</h2>}
            {forcePasswordChange && <h2 className="mb-4 text-lg font-semibold text-atria-ink">Set your password</h2>}
            <ChangePasswordSection
              onSuccess={() => {
                if (searchParams.get('forcePasswordChange')) {
                  const next = new URLSearchParams(searchParams)
                  next.delete('forcePasswordChange')
                  setSearchParams(next, { replace: true })
                }
                navigate('/onboarding/checklist', { replace: true })
              }}
              forced={forcePasswordChange}
            />
          </div>
        </CardContent>
      </Card>
      <div className='mt-6 flex flex-col items-center gap-2'>
        {/* TODO: resolve via resolveAgencyLogo(tenantName) when multi-agency support is added */}
        <img
          src="/agency-logo-individualschoice.jpeg"
          alt="Agency logo"
          className='h-10 w-auto object-contain opacity-70'
        />
        <p className='text-xs text-atria-text-muted'>Powered by ATRIA-X Digital Solutions</p>
      </div>
    </div>
  )
}
