// Generate a short-lived Clerk sign-in ticket link for a user, against any
// environment (dev .env.local or prod .env.prod).
//
// Usage:
//   node scripts/gen-signin-link.cjs <envFile> <email> [baseUrl]
//   e.g. node scripts/gen-signin-link.cjs .env.prod diego.molina.sieiro+hrqa1@gmail.com https://individualschoice.atriaxsolutions.com
const fs = require('fs')
const path = require('path')

const envFile = process.argv[2] || '.env.local'
const email = process.argv[3]
const baseUrl = process.argv[4] || 'http://127.0.0.1:5174'
if (!email) {
  console.error('usage: node scripts/gen-signin-link.cjs <envFile> <email> [baseUrl]')
  process.exit(1)
}

const envText = fs.readFileSync(path.resolve(envFile), 'utf-8')
const env = {}
for (const line of envText.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const idx = line.indexOf('=')
  if (idx > 0) env[line.slice(0, idx)] = line.slice(idx + 1).replace(/^["']|["']$/g, '')
}
const secretKey = env.CLERK_SECRET_KEY
if (!secretKey) throw new Error(`CLERK_SECRET_KEY not found in ${envFile}`)

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

async function main() {
  const users = await clerk('GET', `/users?query=${encodeURIComponent(email)}&limit=10`)
  const user = users.find((u) =>
    u.email_addresses.some((e) => e.email_address.toLowerCase() === email.toLowerCase()),
  )
  if (!user) throw new Error(`User not found in ${envFile} instance: ${email}`)

  const tokenResp = await clerk('POST', '/sign_in_tokens', {
    user_id: user.id,
    expires_in_seconds: 600,
  })
  const url = new URL(baseUrl)
  url.pathname = '/sign-in'
  url.searchParams.set('__clerk_ticket', tokenResp.token)
  console.log(`user: ${user.id}`)
  console.log(`sign-in link (expires in 10 minutes):`)
  console.log(url.toString())
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
