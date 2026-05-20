interface AppLoaderProps {
  label?: string
  fullScreen?: boolean
}

export function AppLoader({
  label = 'Preparing ATRIA-X',
  fullScreen = false,
}: AppLoaderProps) {
  return (
    <div
      className={`flex items-center justify-center bg-atria-bg ${
        fullScreen ? 'min-h-screen' : 'h-full min-h-[280px]'
      }`}
    >
      <div className="flex flex-col items-center gap-4 rounded-[8px] border border-atria-border bg-atria-surface px-8 py-7 shadow-[0_18px_50px_rgba(16,24,40,0.08)]">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-atria-accent/15" />
          <div className="absolute inset-1 rounded-full border-2 border-atria-accent/20 border-t-atria-accent animate-spin" />
          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-atria-sidebar text-sm font-bold text-white">
            A
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-atria-ink">{label}</p>
          <p className="mt-1 text-xs text-atria-muted">
            Securing agency workspace
          </p>
        </div>
      </div>
    </div>
  )
}
