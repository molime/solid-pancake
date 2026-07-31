import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useClerk } from '@clerk/react'
import { clearSessionData } from '@/shared/lib/clearSession'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { cn } from '@/shared/lib/cn'
import { sanitizeConvexError } from '@/shared/lib/sanitizeConvexError'
import { AtriaLogo } from '@/shared/ui/AtriaLogo'
import { formatPhone, isValidEmail, isValidPhone } from '@/shared/validation'
import { positionOptionsForBranch } from '../components/application/types'

export function ApplyEntryPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { signOut } = useClerk()

  const handleSignOut = () => {
    clearSessionData()
    signOut(() => navigate('/sign-in'))
  }

  useEffect(() => {
    // Clear all session state when loading the /apply page so the applicant starts fresh
    clearSessionData()
  }, [])
  const slug = searchParams.get('agency') ?? ''

  const agencyInfo = useQuery(
    api.agencyConfig.getPublicAgencyInfo,
    slug ? { slug } : 'skip',
  )

  const applyPublic = useAction(api.candidates.applyPublic)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedPosition, setSelectedPosition] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ magicLink: string; initialPassword: string; alreadyApplied: boolean } | null>(null)

  if (!slug) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
        <Card className='w-full max-w-[480px]'>
          <CardContent className='p-8 text-center'>
            <div className='mb-6 flex flex-col items-center text-center'>
              <AtriaLogo />
            </div>
            <h1 className='mb-2 text-xl font-semibold text-atria-ink'>Invalid application link</h1>
            <p className='text-sm text-atria-text-secondary'>
              Please use the application link provided by your agency to apply.
            </p>
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

  if (agencyInfo !== undefined && agencyInfo === null) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
        <Card className='w-full max-w-[480px]'>
          <CardContent className='p-8 text-center'>
            <h1 className='mb-2 text-xl font-semibold text-atria-ink'>Agency not found</h1>
            <p className='text-sm text-atria-text-secondary'>
              We could not find an agency matching this link. Please contact your recruiter.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const agencyName = agencyInfo?.name ?? 'our agency'
  const singleBranch = agencyInfo?.branches?.length === 1 ? agencyInfo.branches[0] : null
  const effectiveBranchId = selectedBranch || (singleBranch?._id ?? '')
  const needsBranch = (agencyInfo?.branches?.length ?? 0) > 1
  const selectedBranchObj = agencyInfo?.branches?.find((b) => b._id === effectiveBranchId)
  const branchType = selectedBranchObj?.branchType ?? singleBranch?.branchType
  const needsPosition = !!selectedBranchObj || !!singleBranch
  const emailValid = isValidEmail(email)
  const phoneValid = isValidPhone(phone)
  const isValid =
    fullName.trim() &&
    emailValid &&
    phoneValid &&
    (!needsBranch || !!effectiveBranchId) &&
    (!needsPosition || !!selectedPosition)

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (!emailValid) {
      setError('Please enter a valid email address.')
      return
    }
    if (!phoneValid) {
      setError('Please enter a valid 10-digit phone number.')
      return
    }
    if (needsBranch && !effectiveBranchId) {
      setError('Please select which branch you are applying to.')
      return
    }
    if (needsPosition && !selectedPosition) {
      setError('Please select a position.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      sessionStorage.setItem('atriax_apply_slug', slug)
      sessionStorage.setItem('atriax_apply_position', selectedPosition)
      const result = await applyPublic({
        slug,
        email: email.trim(),
        displayName: fullName.trim(),
        phone: phone.trim(),
        branchId: effectiveBranchId ? (effectiveBranchId as string) : undefined,
        appBaseUrl: window.location.origin,
      })
      setSuccess({
        magicLink: result.magicLink,
        initialPassword: result.initialPassword,
        alreadyApplied: result.alreadyApplied,
      })
    } catch (err) {
      setError(err instanceof Error ? sanitizeConvexError(err.message) : 'Failed to start application. Please try again.')
    }
    setIsSubmitting(false)
  }

  if (success) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
        <Card className='w-full max-w-[520px]'>
          <CardContent className='p-8'>
            <div className='mb-6 flex flex-col items-center text-center'>
              <AtriaLogo />
              <p className='mt-2 text-sm text-atria-text-secondary'>{agencyName}</p>
              <button
                type='button'
                onClick={handleSignOut}
                className='mt-2 text-xs text-atria-text-muted hover:text-atria-ink hover:underline'
              >
                Sign out
              </button>
            </div>

            {success.alreadyApplied ? (
              <>
                <h1 className='mb-2 text-xl font-semibold text-atria-ink'>You have already applied!</h1>
                <p className='mb-6 text-sm text-atria-text-secondary'>
                  We found an existing application with this email. Use the link below to sign in and continue.
                </p>
                {success.magicLink && (
                  <div className='mb-4 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'>
                    <p className='mb-2 text-sm font-semibold text-atria-ink'>Your sign-in link:</p>
                    <p className='mb-3 break-all text-sm text-atria-accent'>{success.magicLink}</p>
                    <Button
                      variant='primary'
                      size='md'
                      className='w-full'
                      onClick={() => { window.location.href = success.magicLink }}
                    >
                      Sign in now
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h1 className='mb-2 text-xl font-semibold text-atria-ink'>Application started!</h1>
                <p className='mb-6 text-sm text-atria-text-secondary'>
                  Your account has been created. Set your new password below to access your application checklist.
                </p>

                {success.initialPassword && (
                  <div className='mb-4 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4'>
                    <p className='mb-1 text-sm font-semibold text-atria-ink'>Your temporary password (save this):</p>
                    <p className='font-mono text-sm text-atria-ink'>{success.initialPassword}</p>
                  </div>
                )}

                <SetPasswordForm
                  email={email}
                  
                  onDone={() => { window.location.href = success.magicLink || '/sign-in' }}
                />
              </>
            )}

            <p className='mt-4 text-center text-xs text-atria-text-muted'>
              A copy of your sign-in link has been sent to your email.
            </p>
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

  const loading = agencyInfo === undefined

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[560px]'>
        <CardContent className='p-8'>
          <div className='mb-6 flex flex-col items-center text-center'>
            <AtriaLogo />
            <p className='mt-2 text-sm text-atria-text-secondary'>{agencyName}</p>
          </div>

          <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>Apply to join {agencyName}</h1>
          <p className='mb-6 text-base text-atria-text-secondary'>
            Fill in your details to start your application. It takes about 5 minutes.
          </p>

          {loading ? (
            <p className='text-sm text-atria-text-secondary'>Loading...</p>
          ) : (
            <form
              className='flex flex-col gap-5'
              onSubmit={(e) => {
                e.preventDefault()
                handleSubmit()
              }}
            >
              <FieldGroup label='FULL NAME' htmlFor='fullName' required>
                <Input
                  id='fullName'
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder='Jane Doe'
                />
              </FieldGroup>

              <FieldGroup label='EMAIL ADDRESS' htmlFor='email' required>
                <Input
                  id='email'
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='jane@example.com'
                />
              </FieldGroup>

              <FieldGroup label='PHONE NUMBER' htmlFor='phone' required>
                <Input
                  id='phone'
                  type='tel'
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder='(555) 555-5555'
                  inputMode='numeric'
                  maxLength={14}
                />
              </FieldGroup>

              {agencyInfo && agencyInfo.branches.length > 1 && (
                <div>
                  <p className='mb-3 text-sm font-semibold text-atria-ink'>Which branch are you applying to?</p>
                  <div className='flex flex-col gap-2'>
                    {agencyInfo.branches.map((branch) => (
                      <button
                        key={branch._id}
                        type='button'
                        onClick={() => {
                          setSelectedBranch(branch._id)
                          // Clear the position so a stale pick from another
                          // branch's option list can't be submitted.
                          setSelectedPosition('')
                        }}
                        className={cn(
                          'flex items-center gap-3 rounded-[var(--radius-atria-md)] border p-3 text-left text-sm transition-colors',
                          effectiveBranchId === branch._id
                            ? 'border-atria-accent bg-atria-accent-quiet text-atria-ink'
                            : 'border-atria-border bg-atria-surface-2 text-atria-text-secondary hover:bg-atria-surface-3',
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                            effectiveBranchId === branch._id
                              ? 'border-atria-accent bg-atria-accent'
                              : 'border-atria-border bg-atria-surface-3',
                          )}
                        >
                          {effectiveBranchId === branch._id && (
                            <svg className='h-3 w-3 text-white' viewBox='0 0 24 24' fill='currentColor' aria-hidden>
                              <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' />
                            </svg>
                          )}
                        </div>
                        {branch.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {needsPosition && (
                <FieldGroup label='WHICH POSITION ARE YOU APPLYING FOR?' htmlFor='applyPosition' required>
                  <Select
                    id='applyPosition'
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(e.target.value)}
                  >
                    <option value='' disabled>Select position</option>
                    {positionOptionsForBranch(branchType).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </FieldGroup>
              )}

              {error && <p className='text-sm text-atria-danger'>{error}</p>}

              <Button
                type='submit'
                variant='primary'
                size='lg'
                className='mt-2 w-full'
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? 'Creating your account...' : 'Start application \u2192'}
              </Button>
            </form>
          )}
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

function SetPasswordForm({ email, onDone }: { email: string; tempPassword?: string; onDone: () => void }) {
  const updateClerkPassword = useAction(api.candidates.updateClerkPassword)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSetting, setIsSetting] = useState(false)
  const [error, setError] = useState('')

  const isValid = newPassword.length >= 8 && newPassword === confirmPassword

  const handleSetPassword = async () => {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setIsSetting(true)
    setError('')
    try {
      // Use the Convex action to update the password server-side via Clerk Backend API
      await updateClerkPassword({ email, newPassword: newPassword })
      onDone()
    } catch (err) {
      // Convex wraps server errors with a '[Request ID: ...] Server Error' /
      // 'Uncaught ConvexError:' prefix and may append an 'at async handler…'
      // stack suffix — sanitize so the candidate sees only the friendly
      // message (e.g. 'Your password is not strong enough. …').
      const raw = err instanceof Error ? err.message : ''
      const cleaned = sanitizeConvexError(raw)
      setError(cleaned || 'Failed to set password. Please use the sign-in link instead.')
    }
    setIsSetting(false)
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='rounded-[var(--radius-atria-md)] border border-atria-info/30 bg-atria-info/5 p-4'>
        <p className='text-sm font-semibold text-atria-info'>Set your new password</p>
        <p className='mt-1 text-xs text-atria-text-secondary'>
          Set a password you will remember. You will use this along with your email to sign in.
        </p>
      </div>
      <FieldGroup label='NEW PASSWORD' htmlFor='newPassword' required>
        <Input
          id='newPassword'
          type='password'
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder='At least 8 characters'
          minLength={8}
        />
      </FieldGroup>
      <p className='-mt-2 text-xs text-atria-text-muted'>
        Use a strong, unique password. Common passwords will be rejected.
      </p>
      <FieldGroup label='CONFIRM PASSWORD' htmlFor='confirmPassword' required>
        <Input
          id='confirmPassword'
          type='password'
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder='Re-enter your password'
        />
      </FieldGroup>
      {error && <p className='text-sm text-atria-danger'>{error}</p>}
      <Button
        variant='primary'
        size='lg'
        className='w-full'
        disabled={!isValid || isSetting}
        onClick={handleSetPassword}
      >
        {isSetting ? 'Setting password...' : 'Set password and continue \u2192'}
      </Button>
      <button
        type='button'
        onClick={onDone}
        className='text-center text-xs text-atria-text-muted hover:underline'
      >
        Skip for now and use sign-in link instead
      </button>
    </div>
  )
}