import { ReactNode } from 'react';

import { cn } from './utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, className, children }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-6 border-b border-[color:var(--border-muted)] pb-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[color:var(--foreground-strong)]">{title}</h1>
          {subtitle ? <p className="text-sm text-[color:var(--muted-foreground)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="flex flex-col gap-6">{children}</div> : null}
    </div>
  );
}
