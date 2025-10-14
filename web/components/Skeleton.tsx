import { ReactNode } from 'react';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

interface SkeletonSurfaceProps {
  className?: string;
  animate?: boolean;
  children: ReactNode;
}

export function SkeletonSurface({ className, animate = true, children }: SkeletonSurfaceProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-gray-200/80 bg-white/70 shadow-card backdrop-blur-sm dark:border-gray-700/60 dark:bg-slate-900/50',
        animate && 'animate-pulse',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface SkeletonLineProps {
  width?: string;
  height?: string;
  rounded?: string;
  className?: string;
}

export function SkeletonLine({
  width = 'w-full',
  height = 'h-3',
  rounded = 'rounded-full',
  className,
}: SkeletonLineProps) {
  return (
    <div
      className={cn(
        'bg-gray-200/80 dark:bg-gray-700/70',
        width,
        height,
        rounded,
        className,
      )}
    />
  );
}

interface SkeletonCardProps {
  lines?: number;
  className?: string;
  children?: ReactNode;
}

export function SkeletonCard({ lines = 3, className, children }: SkeletonCardProps) {
  return (
    <SkeletonSurface className={cn('p-6', className)}>
      {children ?? (
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, index) => (
            <SkeletonLine
              key={index}
              width={index === 0 ? 'w-1/2' : index === lines - 1 ? 'w-5/6' : 'w-full'}
            />
          ))}
        </div>
      )}
    </SkeletonSurface>
  );
}

interface SkeletonTableRowProps {
  columns: number;
  widths?: string[];
  className?: string;
}

export function SkeletonTableRow({ columns, widths = [], className }: SkeletonTableRowProps) {
  return (
    <tr className={cn('animate-pulse', className)}>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-4 py-4 sm:px-6">
          <SkeletonLine
            height="h-4"
            rounded="rounded-pill"
            width={widths[index] ?? 'w-3/4'}
            className="mx-auto"
          />
        </td>
      ))}
    </tr>
  );
}

interface SkeletonBadgeProps {
  width?: string;
  className?: string;
}

export function SkeletonBadge({ width = 'w-24', className }: SkeletonBadgeProps) {
  return (
    <SkeletonLine
      width={width}
      height="h-6"
      rounded="rounded-pill"
      className={cn('bg-gray-200 dark:bg-gray-600', className)}
    />
  );
}

