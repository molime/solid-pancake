import { UserProfile, useUser } from '@clerk/react'
import { atriaClerkAppearance } from '@/shared/ui/clerkAppearance'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'

// Account self-service for every user type (admin, HR, coordinator, caregiver,
// candidate): view profile, change password, manage email and MFA. Backed
// entirely by Clerk's hosted user-profile UI — no custom backend needed.
export function AccountSettingsPage() {
  const { user } = useUser()
  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    ''

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-atria-ink">Account</h1>
        <p className="text-sm text-atria-text-secondary">
          Manage your profile, password, and sign-in security.
        </p>
      </div>
      {/* The email section inside Clerk's UserProfile is hidden (accounts are
          agency-provisioned), so show the assigned address here instead. */}
      <Card>
        <CardHeader>
          <CardTitle>Sign-in email</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base text-atria-ink" data-testid="account-email">
            {primaryEmail || '—'}
          </p>
          <p className="mt-1 text-sm text-atria-text-secondary">
            This is the email assigned to your account. To change it, contact
            your agency admin.
          </p>
        </CardContent>
      </Card>
      <div className="flex justify-center overflow-x-auto">
        {/* API keys are an instance-level Clerk feature for programmatic API
            access — not something agency staff should manage here. Email
            aliases are also hidden: accounts are agency-provisioned and a
            secondary email would let sign-in/password-reset escape to an
            unmanaged address. */}
        <UserProfile
          routing="path"
          path="/account"
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
  )
}
