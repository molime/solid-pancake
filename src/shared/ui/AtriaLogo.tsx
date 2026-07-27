import { cn } from '@/shared/lib/cn'

interface AtriaLogoProps {
  className?: string
  hideCaption?: boolean
}

export function AtriaLogo({ className, hideCaption = false }: AtriaLogoProps) {
  return (
    <div className='flex flex-col items-center'>
      <img
        src="/atria-logo-horizontal.png"
        alt="ATRIA-X"
        className={cn('h-12 w-auto object-contain', className)}
      />
      {!hideCaption && (
        <p className='mt-1 text-xs text-atria-text-muted text-center'>
          Powered by ATRIA-X Digital Solutions
        </p>
      )}
    </div>
  )
}
