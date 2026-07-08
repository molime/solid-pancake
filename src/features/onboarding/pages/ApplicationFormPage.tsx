import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { FieldGroup } from '@/shared/ui/FieldGroup'
import { Select } from '@/shared/ui/Select'

const POSITION_OPTIONS = [
  { value: 'Home Care Aide', label: 'Home Care Aide' },
  { value: 'Caregiver', label: 'Caregiver' },
  { value: 'CNA', label: 'Certified Nursing Assistant' },
  { value: 'HHA', label: 'Home Health Aide' },
]

export function ApplicationFormPage() {
  const navigate = useNavigate()
  const { organization, isLoaded: orgLoaded } = useOrganization()
  const { user, isLoaded: userLoaded } = useUser()
  const clerkOrgId = organization?.id
  const candidate = useQuery(
    api.candidates.getCandidateProfile,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const submit = useMutation(api.candidates.submitApplication)

  const defaultName = useMemo(
    () => candidate?.displayName || user?.fullName || '',
    [candidate?.displayName, user?.fullName],
  )
  const defaultEmail = useMemo(
    () => candidate?.email || user?.primaryEmailAddress?.emailAddress || '',
    [candidate?.email, user?.primaryEmailAddress?.emailAddress],
  )
  const defaultPhone = useMemo(() => candidate?.phone || '', [candidate?.phone])

  const [fullName, setFullName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [phone, setPhone] = useState(defaultPhone)
  const [position, setPosition] = useState('Caregiver')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!orgLoaded || !userLoaded || !clerkOrgId) return null

  const isValid = fullName.trim() && email.trim() && phone.trim() && position

  const handleSubmit = async () => {
    if (!isValid) {
      setError('Please fill in all required fields.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      await submit({
        clerkOrgId,
        fields: {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          position,
        },
      })
      navigate('/onboarding/status', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-atria-bg px-4 py-8'>
      <Card className='w-full max-w-[560px]'>
        <CardContent className='p-8'>
          <div className='mb-6 flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-[var(--radius-atria-md)] bg-atria-accent text-atria-on-accent'>
              <span className='text-lg font-bold'>A</span>
            </div>
            <div>
              <p className='text-lg font-semibold leading-none text-atria-ink'>ATRIA-X</p>
              <p className='text-sm text-atria-text-secondary'>Caregiver Portal</p>
            </div>
          </div>

          <h1 className='mb-1 text-2xl font-semibold text-atria-ink'>Start your application 👋</h1>
          <p className='mb-6 text-base text-atria-text-secondary'>
            Fill in the details below. It takes about 5 minutes.
          </p>

          <form
            className='flex flex-col gap-5'
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
          >
            <div className='inline-flex w-fit items-center gap-1.5 rounded-full bg-atria-success/10 px-3 py-1 text-sm text-atria-success'>
              <svg className='h-4 w-4' viewBox='0 0 24 24' fill='currentColor' aria-hidden>
                <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' />
              </svg>
              All changes saved
            </div>

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
                onChange={(e) => setPhone(e.target.value)}
                placeholder='(555) 555-5555'
              />
            </FieldGroup>

            <FieldGroup label='POSITION APPLYING FOR' htmlFor='position' required>
              <Select id='position' value={position} onChange={(e) => setPosition(e.target.value)}>
                {POSITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </FieldGroup>

            {error && <p className='text-sm text-atria-danger'>{error}</p>}

            <Button
              type='submit'
              variant='primary'
              size='lg'
              className='mt-2 w-full'
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit application →'}
            </Button>
          </form>

          <button
            className='mt-4 block w-full text-center text-sm text-atria-text-secondary hover:text-atria-ink'
            onClick={() => navigate('/onboarding/status')}
          >
            Already applied? Check your status →
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
