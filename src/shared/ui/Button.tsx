import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-[6px] px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary:
          'bg-atria-accent text-white hover:bg-atria-accent-hover',
        secondary:
          'border border-atria-border bg-atria-surface text-atria-ink hover:bg-atria-bg',
        danger: 'bg-atria-danger text-white hover:bg-red-800',
        ghost: 'text-atria-muted hover:text-atria-ink hover:bg-atria-bg',
        sidebar:
          'text-atria-sidebar-text hover:text-atria-sidebar-active hover:bg-white/5 justify-start',
        sidebarActive:
          'bg-white/10 text-atria-sidebar-active justify-start',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-10 px-5',
        icon: 'h-9 w-9 px-0',
        sidebar: 'h-9 px-3',
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
