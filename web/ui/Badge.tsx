import { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from './utils';

export type BadgeTone = 'positive' | 'warn' | 'danger' | 'neutral' | 'info';

const toneClassNames: Record<BadgeTone, string> = {
  positive:
    'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30',
  warn:
    'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30',
  danger:
    'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30',
  neutral:
    'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-500/40',
  info:
    'bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/30',
};

type BadgeProps = ComponentPropsWithoutRef<'span'> & {
  tone?: BadgeTone;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function Badge({
  children,
  className,
  tone = 'neutral',
  leadingIcon,
  trailingIcon,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide',
        toneClassNames[tone],
        className,
      )}
      {...props}
    >
      {leadingIcon ? <span aria-hidden="true" className="text-sm">{leadingIcon}</span> : null}
      <span>{children}</span>
      {trailingIcon ? <span aria-hidden="true" className="text-sm">{trailingIcon}</span> : null}
    </span>
  );
}
