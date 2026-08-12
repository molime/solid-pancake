import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

/** Dark-themed table primitives matching the platform design system. */

export function PlatformTable({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-[#2a3437] bg-[#151b1d]">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  )
}

export function PlatformTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-[#2a3437]">
      <tr>{children}</tr>
    </thead>
  )
}

export function PlatformTableHeader({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <th
      className={cn(
        'px-5 py-3.5 text-[13px] font-bold uppercase tracking-wide text-[#687173]',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function PlatformTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[#2a3437]">{children}</tbody>
}

export function PlatformTableRow({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        onClick && 'cursor-pointer transition-colors hover:bg-[#1e2629]',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function PlatformTableCell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <td className={cn('px-5 py-4 text-[15px] text-[#f5f7f6]', className)}>
      {children}
    </td>
  )
}
