import { useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'

// The course player is hard to use on a phone held in portrait (slide text
// and navigation buttons get cramped). Per client request, block the player
// with a rotate prompt on narrow portrait viewports. Landscape tablets and
// desktops never see this. iOS Safari does not support the orientation-lock
// API, so a blocking overlay is the portable equivalent.
function isNarrowPortrait(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768 && window.innerHeight > window.innerWidth
}

export function RotateToLandscape() {
  const [blocking, setBlocking] = useState(isNarrowPortrait)

  useEffect(() => {
    const check = () => setBlocking(isNarrowPortrait())
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  if (!blocking) return null

  return (
    <div
      role="alert"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-atria-bg p-8 text-center"
    >
      <Smartphone
        className="h-14 w-14 rotate-90 text-atria-accent"
        aria-hidden
      />
      <h2 className="text-lg font-bold text-atria-ink">
        Rotate your device
      </h2>
      <p className="max-w-xs text-sm text-atria-text-secondary">
        This training is best viewed in landscape mode. Please rotate your
        phone sideways to continue.
      </p>
    </div>
  )
}
