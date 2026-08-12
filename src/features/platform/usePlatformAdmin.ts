import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

/**
 * Platform admin gate hook. Returns:
 * - undefined while the check is loading
 * - true/false once resolved
 * Pages pass the result to PlatformGate to render loading/denied states.
 */
export function usePlatformAdmin() {
  const isAdmin = useQuery(api.platform.isAdmin)
  return isAdmin
}
