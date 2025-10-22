import { ComponentPropsWithoutRef } from 'react';

import { cn } from './utils';

export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('h-4 w-full animate-pulse rounded-md bg-[color:var(--skeleton)]', className)}
      {...props}
    />
  );
}

interface SkeletonTextProps {
  rows?: number;
  widths?: string[];
  className?: string;
}

export function SkeletonText({ rows = 3, widths, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={`skeleton-text-${index}`} className={cn('h-3 rounded-full', widths?.[index])} />
      ))}
    </div>
  );
}

interface SkeletonTableProps {
  columns: number;
  rows?: number;
  className?: string;
}

export function SkeletonTable({ columns, rows = 5, className }: SkeletonTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface)] shadow-sm', className)}>
      <div className="border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-muted)] px-4 py-3">
        <Skeleton className="h-4 w-24 rounded-full" />
      </div>
      <div className="divide-y divide-[color:var(--border-subtle)]">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`skeleton-row-${rowIndex}`} className="flex flex-wrap items-center gap-4 px-4 py-4">
            {Array.from({ length: columns }).map((__, colIndex) => (
              <Skeleton key={`skeleton-cell-${rowIndex}-${colIndex}`} className="h-4 min-w-[96px] flex-1 rounded-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
