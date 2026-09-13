import { UserProfile } from '@clerk/react'

// Account self-service for every user type (admin, HR, coordinator, caregiver,
// candidate): view profile, change password, manage email and MFA. Backed
// entirely by Clerk's hosted user-profile UI — no custom backend needed.
export function AccountSettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-atria-ink">Account</h1>
        <p className="text-sm text-atria-text-secondary">
          Manage your profile, password, and sign-in security.
        </p>
      </div>
      <div className="flex justify-center overflow-x-auto">
        <UserProfile routing="path" path="/account" />
      </div>
    </div>
  )
}
