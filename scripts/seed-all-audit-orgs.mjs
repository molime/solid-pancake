import { execSync } from 'child_process'
import fs from 'fs'

const roleUsersRaw = JSON.parse(
  fs.readFileSync('C:/Users/pinol/Downloads/atriax-role-users.json', 'utf-8'),
)

const roleUsers = {
  platformAdmin: {
    clerkUserId: roleUsersRaw.platform_admin.clerkUserId,
    email: roleUsersRaw.platform_admin.email,
    displayName: 'Platform Admin',
  },
  admin: {
    clerkUserId: roleUsersRaw.agency_admin.clerkUserId,
    email: roleUsersRaw.agency_admin.email,
    displayName: 'QA Agency Admin',
  },
  hr: {
    clerkUserId: roleUsersRaw.hr.clerkUserId,
    email: roleUsersRaw.hr.email,
    displayName: 'QA HR',
  },
  coordinator: {
    clerkUserId: roleUsersRaw.coordinator.clerkUserId,
    email: roleUsersRaw.coordinator.email,
    displayName: 'QA Coordinator',
  },
  caregiver: {
    clerkUserId: roleUsersRaw.caregiver.clerkUserId,
    email: roleUsersRaw.caregiver.email,
    displayName: 'QA Caregiver One',
  },
  candidate: {
    clerkUserId: roleUsersRaw.candidate.clerkUserId,
    email: roleUsersRaw.candidate.email,
    displayName: 'QA Candidate',
  },
}

const orgs = [
  'org_3Dz8teqlLdIf7bWcDrAN4DtVKWA',
  'org_3HVpIs1zJlejyYQ4Z1MMSP8HkZO',
  'org_3GII008i2F6bzk1HbgkY8qODZad',
]

for (const clerkOrgId of orgs) {
  const payload = JSON.stringify({ clerkOrgId, roleUsers })
  console.log(`\nSeeding ${clerkOrgId}...`)
  try {
    const output = execSync(`npx convex run seedAuditFixtures:seedFullAuditOrg '${payload}'`, {
      stdio: 'pipe',
      encoding: 'utf-8',
      shell: 'C:/Program Files/Git/bin/bash.exe',
    })
    console.log(output)
  } catch (err) {
    console.error(`Failed to seed ${clerkOrgId}:`)
    console.error(err.stderr || err.message)
  }
}
