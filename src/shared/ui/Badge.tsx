import type { PropsWithChildren } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

const badgeStyles = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-atria-surface-2 text-atria-text-secondary',
        success: 'bg-atria-success-bg text-atria-success',
        warning: 'bg-atria-warning-bg text-atria-warning',
        danger: 'bg-atria-danger-bg text-atria-danger',
        info: 'bg-atria-info-bg text-atria-info',
        neutral: 'bg-atria-neutral-bg text-atria-neutral',
        accent: 'bg-atria-accent-quiet text-atria-accent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type BadgeProps = PropsWithChildren<
  React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeStyles>
>

export function Badge({ children, className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeStyles({ variant }), className)} {...props}>{children}</span>
  )
}
