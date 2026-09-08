import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

/**
 * Platform admin gate hook. Returns:
 * - undefined while the check is loading (including the brief hard-reload
 *   window before the Clerk token attaches — the query returns null then)
 * - true/false once resolved
 * Pages pass the result to PlatformGate to render loading/denied states.
 */
export function usePlatformAdmin() {
  const isAdmin = useQuery(api.platform.isAdmin)
  return isAdmin === null ? undefined : isAdmin
}
