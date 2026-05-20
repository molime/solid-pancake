const RELOAD_KEY = 'atria_x_stale_asset_reload_at'
const RELOAD_COOLDOWN_MS = 10_000

export function isStaleAssetError(reason: unknown) {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : String(reason ?? '')

  return [
    'Failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'dynamically imported module',
    'Importing a module script failed',
    'ChunkLoadError',
    'Loading chunk',
    'not a valid JavaScript MIME type',
    'Expected a JavaScript',
    'text/html',
  ].some((pattern) => message.includes(pattern))
}

export function registerStaleAssetReload() {
  if (typeof window === 'undefined') return

  const reloadOnce = () => {
    const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - lastReload < RELOAD_COOLDOWN_MS) return

    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    window.location.reload()
  }

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    reloadOnce()
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (!isStaleAssetError(event.reason)) return
    event.preventDefault()
    reloadOnce()
  })

  window.addEventListener('error', (event) => {
    if (!isStaleAssetError(event.error) && !isStaleAssetError(event.message)) {
      return
    }
    event.preventDefault()
    reloadOnce()
  })
}
