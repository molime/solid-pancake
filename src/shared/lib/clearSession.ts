// Wipes all client-side session state: localStorage, sessionStorage, and
// every cookie reachable from this document (across common path/domain
// combinations). Use before sign-out and on public entry pages so stale
// state from a previous session can't leak into the next one.
export function clearSessionData() {
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // Storage might be restricted in some contexts
  }
  document.cookie.split(';').forEach((c) => {
    const eq = c.indexOf('=')
    const name = eq > -1 ? c.substring(0, eq).trim() : c.trim()
    if (!name) return
    // Set expiry to past to delete, for multiple path/domain combinations
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.' + window.location.hostname
  })
}
