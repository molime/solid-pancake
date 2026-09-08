// One-off: create test caregiver and HR accounts for Golden Ages in PRODUCTION
// Clerk and add them to the Golden Ages organization. Reads credentials from .env.prod.
// Usage: node scripts/provision-golden-ages-test-accounts.cjs
const fs = require('fs')
const path = require('path')

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

const caregiverPassword = env.GOLDEN_CAREGIVER_PASSWORD
const hrPassword = env.GOLDEN_HR_PASSWORD
if (!caregiverPassword) throw new Error(`GOLDEN_CAREGIVER_PASSWORD not found in ${envFile}`)
if (!hrPassword) throw new Error(`GOLDEN_HR_PASSWORD not found in ${envFile}`)

const ORG_ID = 'org_3IkBP9c1VqEDvjRbXFjPBCmAdc8'
const ORG_NAME = 'Golden Ages Home Care'

const USERS = [
  {
    email: 'diego.molina.sieiro+goldencaregiver@gmail.com',
    password: caregiverPassword,
    role: 'org:caregiver',
    first: 'Golden',
    last: 'Caregiver Test',
  },
  {
    email: 'hello+goldenhr@atriaxsolutions.com',
    password: hrPassword,
    role: 'org:hr',
    first: 'Maria',
    last: 'HR Test',
  },
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
  const { data: memberships } = await clerk('GET', `/organizations/${orgId}/memberships?limit=100`)
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
  const org = await clerk('GET', `/organizations/${ORG_ID}`)
  console.log(`org: ${org.id} (${org.name})`)

  const results = []
  for (const spec of USERS) {
    let user = await findUser(spec.email)
    let created = false
    if (user) {
      console.log(`user ${spec.email}: exists ${user.id}`)
      // Update password to the requested one.
      await clerk('PATCH', `/users/${user.id}`, { password: spec.password, skip_password_checks: true })
      console.log(`user ${spec.email}: password updated`)
    } else {
      user = await clerk('POST', '/users', {
        email_address: [spec.email],
        password: spec.password,
        first_name: spec.first,
        last_name: spec.last,
        skip_password_checks: true,
        public_metadata: { accountType: spec.role },
      })
      created = true
      console.log(`user ${spec.email}: created ${user.id}`)
    }
    await ensureMembership(org.id, user.id, spec.role)
    results.push({
      email: spec.email,
      password: spec.password,
      role: spec.role,
      clerkUserId: user.id,
      created,
    })
  }

  return results
}

main()
  .then((results) => {
    console.log('\nDone.')
    console.log(JSON.stringify(results, null, 2))
  })
  .catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
