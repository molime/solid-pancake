/**
 * Role-appropriate home path used when redirecting users into the app.
 * Shared by the route guards and SelectAgencyPage so no-org users land
 * directly on a page their role can access instead of re-entering '/'.
 */
export function roleHomePath(role: string | undefined): string {
  if (role === 'org:caregiver') return '/caregiver/today'
  if (role === 'org:candidate') return '/onboarding'
  return '/'
}
