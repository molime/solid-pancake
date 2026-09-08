// One-off: provision the Golden Ages organization in the PRODUCTION Clerk
// instance (credentials from .env.prod) and print the ids needed for the
// Convex tenant provisioning. Idempotent: finds existing org/users by name.
//
// Usage: node scripts/provision-golden-ages-clerk.cjs <envFile>
//   e.g. node scripts/provision-golden-ages-clerk.cjs .env.prod
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const envFile = process.argv[2] || '.env.prod'
const envText = fs.readFileSync(path.resolve(envFile), 'utf-8')
const env = {}
for (const line of envText.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const idx = line.indexOf('=')
  if (idx > 0) env[line.slice(0, idx)] = line.slice(idx + 1).replace(/^["']|["']$/g, '')
}

const secretKey = env.CLERK_SECRET_KEY
if (!secretKey) throw new Error(`CLERK_SECRET_KEY not found in ${envFile}`)

const ORG_NAME = 'Golden Ages Home Care'
const USERS = [
  { email: 'diego.molina.sieiro+gaadmin@gmail.com', role: 'org:admin', first: 'Diego', last: 'Molina (GA Admin)' },
  { email: 'diego.molina.sieiro+hrqa1@gmail.com', role: 'org:hr', first: 'Diego', last: 'Molina (GA HR)' },
]

async function clerk(method, p, body) {
  const resp = await fetch(`https://api.clerk.com/v1${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`Clerk ${method} ${p} failed: ${resp.status} ${text}`)
  return text ? JSON.parse(text) : {}
}

async function findUser(email) {
  const users = await clerk('GET', `/users?query=${encodeURIComponent(email)}&limit=10`)
  return users.find((u) =>
    u.email_addresses.some((e) => e.email_address.toLowerCase() === email.toLowerCase()),
  )
}

async function ensureMembership(orgId, userId, atriaRole) {
  const { data: memberships } = await clerk(
    'GET',
    `/organizations/${orgId}/memberships?limit=100`,
  )
  const existing = memberships.find((m) => m.public_user_data?.user_id === userId)
  if (existing) {
    if (existing.public_metadata?.atriaRole !== atriaRole) {
      await clerk('PATCH', `/organizations/${orgId}/memberships/${userId}/metadata`, {
        public_metadata: { ...(existing.public_metadata || {}), atriaRole },
      })
      console.log(`membership ${userId}: updated atriaRole -> ${atriaRole}`)
    } else {
      console.log(`membership ${userId}: already ${atriaRole}`)
    }
    return
  }
  await clerk('POST', `/organizations/${orgId}/memberships`, {
    user_id: userId,
    role: 'org:member',
  })
  await clerk('PATCH', `/organizations/${orgId}/memberships/${userId}/metadata`, {
    public_metadata: { atriaRole },
  })
  console.log(`membership ${userId}: created with atriaRole ${atriaRole}`)
}

async function main() {
  // 1. Org
  const { data: orgs } = await clerk('GET', `/organizations?query=${encodeURIComponent(ORG_NAME)}&limit=10`)
  let org = orgs.find((o) => o.name === ORG_NAME)
  if (org) {
    console.log(`org: exists ${org.id}`)
  } else {
    org = await clerk('POST', '/organizations', { name: ORG_NAME })
    console.log(`org: created ${org.id}`)
  }

  // 2. Users + memberships
  const credentials = [`Golden Ages production provisioning`, `org: ${org.id} (${ORG_NAME})`, '']
  for (const spec of USERS) {
    let user = await findUser(spec.email)
    let password = null
    if (user) {
      console.log(`user ${spec.email}: exists ${user.id}`)
    } else {
      password = 'GA-' + crypto.randomBytes(9).toString('base64url')
      user = await clerk('POST', '/users', {
        email_address: [spec.email],
        password,
        first_name: spec.first,
        last_name: spec.last,
        skip_password_checks: true,
        public_metadata: { accountType: spec.role },
      })
      const primary = user.email_addresses.find(
        (e) => e.email_address.toLowerCase() === spec.email.toLowerCase(),
      )
      // Verify all of the user's identifiers (email) in one call.
      await clerk('POST', `/users/${user.id}/verify`)
      console.log(`user ${spec.email}: created ${user.id} (verified: ${primary.verification?.status ?? 'n/a'})`)
    }
    await ensureMembership(org.id, user.id, spec.role)
    credentials.push(
      `${spec.role}: ${spec.email}`,
      `  clerkUserId: ${user.id}`,
      password ? `  temp password: ${password}` : '  password: (existing account — use sign-in ticket or password reset)',
      '',
    )
  }

  const outFile = 'C:/Users/pinol/Downloads/golden-ages-prod-credentials.txt'
  fs.writeFileSync(outFile, credentials.join('\n'))
  console.log('')
  console.log(`credentials written to ${outFile}`)
  console.log(`CLERK_ORG_ID=${org.id}`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
