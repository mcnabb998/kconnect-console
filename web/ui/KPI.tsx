import { ReactNode } from 'react';

import { cn } from './utils';

type KPITone = 'default' | 'positive' | 'warn' | 'danger';

const toneAccent: Record<KPITone, string> = {
  default: 'text-indigo-500',
  positive: 'text-emerald-500',
  warn: 'text-amber-500',
  danger: 'text-rose-500',
};

interface KPIProps {
  label: string;
  value: ReactNode;
  changeLabel?: string;
  changeValue?: ReactNode;
  icon?: ReactNode;
  tone?: KPITone;
  className?: string;
}

export function KPI({
  label,
  value,
  changeLabel,
  changeValue,
  icon,
  tone = 'default',
  className,
}: KPIProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-muted)] p-4 shadow-sm',
        className,
      )}
    >
      {icon ? <div className={cn('mt-1 text-base', toneAccent[tone])}>{icon}</div> : null}
      <div className="space-y-2">
        <div className="text-sm font-medium text-[color:var(--muted-foreground)]">{label}</div>
        <div className="text-2xl font-semibold text-[color:var(--foreground-strong)]">{value}</div>
        {changeLabel && changeValue ? (
          <div className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
            <span className={cn('font-medium', toneAccent[tone])}>{changeValue}</span>
            <span>{changeLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
