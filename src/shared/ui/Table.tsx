import type { PropsWithChildren, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Table({ children, className, ...props }: PropsWithChildren<TableHTMLAttributes<HTMLTableElement>>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children, className, ...props }: PropsWithChildren<TableHTMLAttributes<HTMLTableSectionElement>>) {
  return <thead className={cn('bg-atria-surface-2 text-atria-ink', className)} {...props}>{children}</thead>
}

export function TableBody({ children, className, ...props }: PropsWithChildren<TableHTMLAttributes<HTMLTableSectionElement>>) {
  return <tbody className={cn('', className)} {...props}>{children}</tbody>
}

export function TableRow({ children, className, ...props }: PropsWithChildren<TableHTMLAttributes<HTMLTableRowElement>>) {
  return <tr className={cn('border-b border-atria-border hover:bg-atria-surface-2/50 transition-colors', className)} {...props}>{children}</tr>
}

export function TableHeader({ children, className, ...props }: PropsWithChildren<ThHTMLAttributes<HTMLTableHeaderCellElement>>) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-atria-text-secondary',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export function TableCell({ children, className, ...props }: PropsWithChildren<TdHTMLAttributes<HTMLTableCellElement>>) {
  return (
    <td className={cn('px-4 py-3 text-atria-ink', className)} {...props}>
      {children}
    </td>
  )
}
