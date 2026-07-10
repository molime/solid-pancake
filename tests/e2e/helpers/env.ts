export function e2eCredentialsAvailable(): boolean {
  const base =
    process.env.E2E_CLERK_ORG_ID &&
    process.env.E2E_ADMIN_EMAIL &&
    process.env.E2E_ADMIN_PASSWORD &&
    process.env.E2E_COORDINATOR_EMAIL &&
    process.env.E2E_COORDINATOR_PASSWORD &&
    process.env.E2E_CAREGIVER_EMAIL &&
    process.env.E2E_CAREGIVER_PASSWORD

  const isFullRun = process.env.E2E_FULL === '1' || process.env.E2E_FULL === 'true'
  if (!isFullRun) return Boolean(base)

  return Boolean(
    base &&
      process.env.E2E_HR_EMAIL &&
      process.env.E2E_HR_PASSWORD &&
      process.env.E2E_CANDIDATE_EMAIL &&
      process.env.E2E_CANDIDATE_PASSWORD,
  )
}

export function isLocalConvexUrl(): boolean {
  const url = process.env.VITE_CONVEX_URL
  if (!url) return true
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return true
  }
}

export function mockE2EEnabled(): boolean {
  return (
    process.env.E2E_USE_MOCK === '1' || process.env.E2E_USE_MOCK === 'true'
  )
}
