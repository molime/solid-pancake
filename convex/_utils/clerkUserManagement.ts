
interface ClerkUser {
  id: string
  mfa_enabled: boolean
  email_addresses: Array<{
    id: string
    email_address: string
    verification: { status: string } | null
  }>
}

export async function findClerkUserByEmail(
  secretKey: string,
  email: string,
): Promise<ClerkUser | null> {
  const res = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretKey}` },
    },
  )
  if (!res.ok) return null
  const users = (await res.json()) as ClerkUser[]
  return users[0] ?? null
}

export async function disableClerkUserMfa(secretKey: string, userId: string) {
  // Best-effort removal of common MFA factors. Not all endpoints exist in every
  // environment; ignore 404s so the action succeeds even if only some are
  // configured.
  const endpoints = [
    `https://api.clerk.com/v1/users/${userId}/totp`,
    `https://api.clerk.com/v1/users/${userId}/backup_codes`,
  ]
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${secretKey}` },
      })
      if (!res.ok && res.status !== 404) {
        const payload = await res.json().catch(() => ({}))
        console.error('Clerk MFA disable failed for', url, payload)
      }
    } catch (err) {
      console.error('Clerk MFA disable network error for', url, err)
    }
  }
}

export async function verifyClerkUserEmail(
  secretKey: string,
  userId: string,
  emailAddressId: string,
) {
  const res = await fetch(
    `https://api.clerk.com/v1/users/${userId}/email_addresses/${emailAddressId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ verified: true }),
    },
  )
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    console.error('Clerk email verify failed', payload)
  }
}
