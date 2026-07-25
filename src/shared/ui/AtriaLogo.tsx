import { cn } from '@/shared/lib/cn'

interface AtriaLogoProps {
  className?: string
}

export function AtriaLogo({ className }: AtriaLogoProps) {
  return (
    <img
      src="/atria-logo.png"
      alt="ATRIA-X"
      className={cn('h-8 w-auto object-contain', className)}
    />
  )
}
