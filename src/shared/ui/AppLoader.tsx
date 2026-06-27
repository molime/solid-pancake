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
      <div className="flex flex-col items-center gap-4 rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface px-8 py-7 shadow-[var(--shadow-atria-pop)]">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-atria-accent/15" />
          <div className="absolute inset-1 rounded-full border-2 border-atria-accent/20 border-t-atria-accent animate-spin" />
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-atria-md)] bg-atria-sidebar text-sm font-bold text-white">
            A
          </div>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-atria-ink">{label}</p>
          <p className="mt-1 text-sm text-atria-text-secondary">
            Securing agency workspace
          </p>
        </div>
      </div>
    </div>
  )
}
