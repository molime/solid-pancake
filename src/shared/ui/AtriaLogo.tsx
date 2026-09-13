import { cn } from '@/shared/lib/cn'

interface AtriaLogoProps {
  className?: string
}

export function AtriaLogo({ className }: AtriaLogoProps) {
  return (
    // Trimmed variant — the original PNG carries ~65% transparent padding,
    // which made the brand render tiny. The trimmed asset fills its box, so
    // the logo displays noticeably larger at the same class height.
    <img
      src="/atria-logo-horizontal-trim.png"
      alt="ATRIA-X"
      className={cn('h-28 w-auto object-contain', className)}
    />
  )
}
