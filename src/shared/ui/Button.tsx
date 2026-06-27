import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-atria-md)] px-4 text-base font-medium transition-colors disabled:pointer-events-none disabled:bg-atria-surface-2 disabled:text-atria-text-disabled disabled:border-atria-border disabled:opacity-100 focus:outline-none focus:ring-2 focus:ring-atria-accent/60 focus:ring-offset-2 focus:ring-offset-atria-bg',
  {
    variants: {
      variant: {
        primary:
          'rounded-full bg-atria-accent text-atria-on-accent hover:bg-atria-accent-hover',
        secondary:
          'border border-atria-border bg-atria-surface text-atria-ink hover:bg-atria-surface-2',
        danger:
          'bg-atria-danger text-white hover:bg-atria-danger/90',
        ghost:
          'text-atria-text-secondary hover:text-atria-ink hover:bg-atria-surface-2',
        sidebar:
          'justify-start rounded-[var(--radius-atria-md)] text-atria-sidebar-text hover:text-atria-sidebar-active hover:bg-white/5',
        sidebarActive:
          'justify-start rounded-[var(--radius-atria-md)] bg-white/10 text-atria-sidebar-active',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-[52px] px-6 text-base',
        icon: 'h-10 w-10 px-0',
        sidebar: 'h-10 px-3',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>
>

export function Button({
  children,
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonStyles({ variant, size }), className)}
      type="button"
      {...props}
    >
      {children}
    </button>
  )
}
