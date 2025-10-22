import { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from './utils';

type DataTableProps = ComponentPropsWithoutRef<'div'> & {
  children: ReactNode;
};

function DataTableRoot({ children, className, ...props }: DataTableProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface)] shadow-sm',
        className,
      )}
      {...props}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">{children}</table>
      </div>
    </div>
  );
}

type TableSectionProps = ComponentPropsWithoutRef<'thead'> & {
  children: ReactNode;
};

function DataTableHeader({ children, className, ...props }: TableSectionProps) {
  return (
    <thead
      className={cn(
        'sticky top-0 z-10 bg-[color:var(--surface-muted)] text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)] backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

function DataTableBody({ children, className, ...props }: ComponentPropsWithoutRef<'tbody'> & { children: ReactNode }) {
  return (
    <tbody
      className={cn('divide-y divide-[color:var(--border-subtle)] text-[color:var(--foreground-muted)]', className)}
      {...props}
    >
      {children}
    </tbody>
  );
}

type DataTableRowProps = ComponentPropsWithoutRef<'tr'> & {
  selected?: boolean;
  interactive?: boolean;
};

function DataTableRow({ selected = false, interactive = true, className, ...props }: DataTableRowProps) {
  return (
    <tr
      data-selected={selected ? 'true' : undefined}
      className={cn(
        'transition-colors duration-150 odd:bg-[color:var(--surface-muted)] even:bg-[color:var(--surface)]',
        interactive && 'hover:bg-[color:var(--surface-muted)]',
        'data-[selected=true]:bg-indigo-50/60 data-[selected=true]:hover:bg-indigo-50/60 dark:data-[selected=true]:bg-indigo-500/10',
        className,
      )}
      {...props}
    />
  );
}

type HeadCellProps = ComponentPropsWithoutRef<'th'>;

function DataTableHeadCell({ className, ...props }: HeadCellProps) {
  return (
    <th
      scope="col"
      className={cn('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide', className)}
      {...props}
    />
  );
}

type CellProps = ComponentPropsWithoutRef<'td'>;

function DataTableCell({ className, ...props }: CellProps) {
  return <td className={cn('px-4 py-3 align-middle text-sm text-[color:var(--foreground-strong)]', className)} {...props} />;
}

function DataTableCheckboxCell({ className, ...props }: CellProps) {
  return (
    <td
      className={cn(
        'w-[3.25rem] px-4 py-3 align-middle text-sm text-[color:var(--foreground-strong)]',
        className,
      )}
      {...props}
    />
  );
}

function DataTableActionCell({ className, ...props }: CellProps) {
  return (
    <td
      className={cn(
        'w-0 whitespace-nowrap px-2 py-3 text-right text-sm text-[color:var(--muted-foreground)]',
        className,
      )}
      {...props}
    />
  );
}

export const DataTable = Object.assign(DataTableRoot, {
  Header: DataTableHeader,
  Body: DataTableBody,
  Row: DataTableRow,
  HeadCell: DataTableHeadCell,
  Cell: DataTableCell,
  CheckboxCell: DataTableCheckboxCell,
  ActionCell: DataTableActionCell,
});
