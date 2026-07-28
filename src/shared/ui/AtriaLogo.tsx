import { cn } from '@/shared/lib/cn'

interface AtriaLogoProps {
  className?: string
}

export function AtriaLogo({ className }: AtriaLogoProps) {
  return (
    <img
      src="/atria-logo-horizontal.png"
      alt="ATRIA-X"
      className={cn('h-28 w-auto object-contain', className)}
    />
  )
}
