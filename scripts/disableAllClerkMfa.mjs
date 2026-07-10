import { readFileSync } from 'fs'
import { config } from 'dotenv'

config({ path: '.env.local' })

const secretKey = process.env.CLERK_SECRET_KEY
if (!secretKey) {
  console.error('CLERK_SECRET_KEY is not set in .env.local')
  process.exit(1)
}

async function* listUsers() {
  let offset = ''
  while (true) {
    const url = new URL('https://api.clerk.com/v1/users')
    url.searchParams.set('limit', '100')
    if (offset) url.searchParams.set('offset', offset)
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    if (!res.ok) {
      throw new Error(`Clerk list users failed: ${res.status} ${await res.text()}`)
    }
    const data = await res.json()
    for (const user of data) yield user
    if (!data.length || data.length < 100) break
    offset = data[data.length - 1].id
  }
}

async function disableMfaForUser(userId) {
  for (const endpoint of ['totp', 'backup_codes']) {
    const res = await fetch(`https://api.clerk.com/v1/users/${userId}/${endpoint}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    if (!res.ok && res.status !== 404) {
      console.warn(`  ${endpoint} DELETE failed: ${res.status}`)
    }
  }
}

async function main() {
  let count = 0
  for await (const user of listUsers()) {
    if (user.mfa_enabled) {
      console.log(`Disabling MFA for ${user.email_addresses[0]?.email_address ?? user.id}`)
      await disableMfaForUser(user.id)
      count++
    }
  }
  console.log(`Processed ${count} users with MFA enabled`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
