import { useState } from 'react'
import { UserProfile, useUser } from '@clerk/react'
import { PlatformGate } from '../components/PlatformGate'
import { atriaClerkAppearance } from '@/shared/ui/clerkAppearance'

const primaryButtonClass =
  'rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0f10] transition-opacity hover:opacity-90 disabled:opacity-50'

const inputClass =
  'w-full rounded-lg border border-[#2a3437] bg-[#1e2629] px-3 py-2 text-[15px] text-[#f5f7f6] outline-none focus:border-[#22c55e]'

const labelClass = 'mb-1.5 block text-sm font-medium text-[#9aa6a8]'

const cardClass = 'rounded-2xl border border-[#2a3437] bg-[#151b1d] p-5'

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[#687173]">{label}</span>
      <span className="text-[15px] text-[#f5f7f6]">{value}</span>
    </div>
  )
}

// Account page for platform admins: name editing via Clerk user.update(),
// read-only email, and Clerk's UserProfile for password/MFA. The agency
// account page (/account) sits behind the tenant guard, so platform admins
// (Clerk users without an org) need their own embedded profile here.
export function PlatformAccountPage() {
  const { isLoaded, user } = useUser()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Keep the inputs in sync with the Clerk user by adjusting state during
  // render (avoids setState-in-effect).
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null)
  if (user && syncedUserId !== user.id) {
    setSyncedUserId(user.id)
    setFirstName(user.firstName ?? '')
    setLastName(user.lastName ?? '')
  }

  const handleSaveName = async () => {
    if (!user || !firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await user.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      })
      setMessage('Name updated.')
    } catch {
      setError('Failed to update your name. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PlatformGate>
      <div className="space-y-6">
        <h1 className="text-[26px] font-bold text-[#f5f7f6]">Account</h1>

        {!isLoaded || !user ? (
          <p className="py-12 text-center text-sm text-[#9aa6a8]">
            Loading account…
          </p>
        ) : (
          <>
            <div className={cardClass}>
              <h2 className="text-lg font-bold text-[#f5f7f6]">Profile</h2>
              <div className="mt-3 divide-y divide-[#2a3437]">
                <DetailRow
                  label="Email"
                  value={user.primaryEmailAddress?.emailAddress ?? '—'}
                />
              </div>
              <div className="mt-4 grid gap-4 border-t border-[#2a3437] pt-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>First name</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Last name</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              {error && <p className="mt-3 text-sm text-[#ef4444]">{error}</p>}
              {message && (
                <p className="mt-3 text-sm text-[#22c55e]">{message}</p>
              )}
              <div className="mt-4">
                <button
                  onClick={handleSaveName}
                  disabled={
                    busy || !firstName.trim() || !lastName.trim()
                  }
                  className={primaryButtonClass}
                >
                  {busy ? 'Saving…' : 'Save name'}
                </button>
              </div>
            </div>

            <div className={cardClass}>
              <h2 className="text-lg font-bold text-[#f5f7f6]">Security</h2>
              <p className="mt-2 text-sm text-[#9aa6a8]">
                Password, MFA, and other sign-in settings are managed below
                (powered by Clerk).
              </p>
              <div className="mt-4 flex justify-center overflow-x-auto">
                {/* API keys are an instance-level Clerk feature — not
                    something platform admins manage here. Email editing is
                    hidden for consistency with the agency account page. */}
                <UserProfile
                  routing="path"
                  path="/platform/account"
                  apiKeysProps={{ hide: true }}
                  appearance={{
                    ...atriaClerkAppearance,
                    elements: {
                      ...atriaClerkAppearance.elements,
                      profileSection__emailAddresses: { display: 'none' },
                    },
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </PlatformGate>
  )
}
