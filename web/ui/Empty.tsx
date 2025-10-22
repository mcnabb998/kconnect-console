import { ReactNode } from 'react';

import { cn } from './utils';

interface EmptyProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export function Empty({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-muted)] px-8 py-16 text-center shadow-sm',
        className,
      )}
    >
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--surface)] text-2xl text-[color:var(--muted-foreground)] shadow-sm">
          {icon}
        </div>
      ) : null}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[color:var(--foreground-strong)]">{title}</h2>
        {description ? <p className="text-sm text-[color:var(--muted-foreground)]">{description}</p> : null}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
