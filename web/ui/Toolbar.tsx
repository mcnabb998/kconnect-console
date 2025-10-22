import { ComponentPropsWithoutRef } from 'react';

import { cn } from './utils';

type ToolbarProps = ComponentPropsWithoutRef<'div'>;

export function Toolbar({ className, ...props }: ToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 [--button-gap:0.5rem]',
        className,
      )}
      {...props}
    />
  );
}
