import { ComponentPropsWithoutRef } from 'react';

import { cn } from './utils';

type CardProps = ComponentPropsWithoutRef<'div'> & {
  hoverable?: boolean;
};

export function Card({ className, hoverable = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-6 shadow-sm transition-shadow duration-200',
        hoverable && 'hover:shadow-md',
        className,
      )}
      {...props}
    />
  );
}
